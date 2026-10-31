import { groupItems, resolveGroup } from '../catalog/groups';
import { displayName, indexCatalog } from '../catalog/lookup';
import type { Catalog, Unit } from '../catalog/types';
import { CELL, openSides, parseCellKey } from '../domain/grid';
import type { Point, Variant } from '../domain/types';
import { builtModules, wallPoints } from '../domain/walls';
import { structureOf } from '../foga/fromVariant';
import type { FogaStructure } from '../foga/structure';
import type { Rules } from '../rules/rules';
import { layoutBeams, type BeamLayout } from './beams';
import { production, type Production } from './production';

export interface CalcLine {
  name: string;
  meta?: string;
  qty: number;
  unit: Unit;
  price: number;
  sum: number;
  artnr: string;
  /** Example or unknown price: * on the quote. */
  placeholder: boolean;
  /** Subgroup id (catalog/groups.ts), from the product. */
  group: string;
  /** Built from Foga parts: the picking list shows the parts (foga/engine.ts) instead of this line. */
  foga?: true;
}

/** One main group of the product grouping, lines in subgroup order. */
export interface CalcGroup {
  id: string;
  name: string;
  lines: CalcLine[];
  sum: number;
}

export interface KeyFigures {
  area: number;
  openSides: number;
  /** Wall modules that are wall, not opening. Shared walls count once. */
  wallLm: number;
  /** Part of wallLm that rooms build themselves (sides shared with other walls not included). */
  roomWallLm: number;
  openings: number;
  beamLm: number;
  beamLengths: number;
  posts: number;
  /** Posts that exist only because of the beams. */
  beamPosts: number;
  topRails: number;
  bottomRails: number;
  /** m² per floor art.nr. */
  floor: Record<string, number>;
  floorTotal: number;
  textileM2: number;
  textileLm: number;
  foilM2: number;
  /** Estimated assembly hours. Included in the unit prices; on the quote only if Montering is counted. */
  hours: number;
  /** The hour rates are not approved yet. */
  hoursPreliminary: boolean;
}

export interface CalcResult {
  groups: CalcGroup[];
  sum: number;
  keyFigures: KeyFigures;
  beams: BeamLayout;
  posts: Point[];
  production: Production;
  /** What is built, in Foga terms: the quote counts from it and the picking list lists its parts. */
  foga: FogaStructure;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Pure: the quote lines and key figures of one variant. */
export function calc(v: Variant, rules: Rules, catalog: Catalog): CalcResult {
  const idx = indexCatalog(catalog);
  const sys = catalog.system;

  const line = (artnr: string, qty: number, extra: Partial<CalcLine> = {}): CalcLine => {
    const hit = idx.byArtnr.get(artnr);
    const price = hit?.variant.price ?? 0;
    const q = hit?.product.unit === 'stk' ? qty : r1(qty);
    return {
      name: hit ? displayName(hit) : artnr,
      qty: q,
      unit: hit?.product.unit ?? 'stk',
      price,
      sum: q * price,
      artnr,
      placeholder: !hit || !!hit.variant.placeholder,
      group: resolveGroup(hit?.product.group).subgroup.id,
      ...extra,
    };
  };

  // Walls and frame
  const mods = builtModules(v);
  const points = wallPoints(mods);
  const keys = new Set(mods.map((m) => m.key));
  const beams = layoutBeams(v.stand, keys, points, rules.beam.max);
  const allPosts = new Map(points);
  let beamPosts = 0;
  for (const [k, p] of beams.posts) {
    if (!allPosts.has(k)) {
      allPosts.set(k, p);
      beamPosts++;
    }
  }
  const walled = mods.filter((m) => !m.opening);
  const roomWalls = new Set(v.walls.filter((w) => w.room).map((w) => w.id));
  const prod = production(v, rules.textile.inFrame, '');
  // Foga structure: posts, walled modules, headers and beam lengths are counted from it
  const foga = structureOf({ mods, posts: allPosts.size, beams, production: prod });
  const fogaWalls = foga.modules.filter((m) => !m.opening);
  const headers = foga.modules.length - fogaWalls.length;
  const beamLm = foga.beams.reduce((a, b) => a + b.lengthMm, 0) / 1000;
  const plates = countBy(fogaWalls.map((m) => m.plate));
  const plateSize = `${rules.wall.plate.width} × ${rules.wall.plate.height} mm`;

  const lines: CalcLine[] = [];
  const add = (...ls: CalcLine[]) => lines.push(...ls.filter((l) => l.qty > 0));
  const built = { foga: true } as const;

  add(
    ...[...plates].map(([ral, n]) => {
      const hit = idx.plateByRal.get(ral);
      return hit ? line(hit.variant.artnr, n, { ...built, meta: `RAL ${ral} · ${plateSize}` }) : line(`RAL ${ral}`, n, { ...built, group: 'vegg.plater' });
    }),
    line(sys.post, foga.posts, { ...built, ...(beamPosts ? { meta: `${points.size} vegg, ${beamPosts} takdrager` } : {}) }),
    // An opening's rails belong to its header (overstykke), priced with the header
    line(sys.topRail, fogaWalls.length, built),
    line(sys.bottomRail, fogaWalls.length, built),
  );
  const nLengths = foga.beams.length;
  add(line(sys.beam, beamLm, { ...built, meta: `${nLengths} ${nLengths === 1 ? 'lengde' : 'lengder'}` }));

  const openingCounts = countBy(mods.flatMap((m) => (m.opening ? [m.opening.product] : [])));
  add(...[...openingCounts].map(([a, n]) => line(a, n)), line(sys.header, headers, built));

  // Textile walls: quantities from the InFrame production rules
  const nFrames = prod.pieces.length;
  const blank = prod.pieces.filter((p) => !p.motif).reduce((a, p) => a + p.area, 0);
  add(
    line(sys.frame, prod.lm, { ...built, meta: `${nFrames} ${nFrames === 1 ? 'ramme' : 'rammer'} · inkl. stag` }),
    line(sys.print, prod.area, { meta: blank > 0 ? `inkl. bleed · ${(Math.round(blank * 10) / 10).toString().replace('.', ',')} m² uten motiv` : 'inkl. bleed' }),
  );

  // Foil
  const wallIds = new Set(v.walls.map((w) => w.id));
  const fullFelt = (rules.wall.plate.width * rules.wall.plate.height) / 1e6;
  const foils = v.foils.filter((f) => wallIds.has(f.wallId));
  const foilFull = foils.filter((f) => f.full).length * fullFelt;
  const foilDecal = foils.filter((f) => !f.full).reduce((a, f) => a + f.width * f.height, 0);
  add(
    line(sys.foil, foilDecal, { meta: 'innenfor ett veggfelt' }),
    line(sys.foilFull, foilFull, { meta: `${foils.filter((f) => f.full).length} felt · ${plateSize}` }),
  );

  // Floor: cells × 0,25 m² per product. Waste is ours and not counted.
  const floor = floorAreas(v);
  const floorTotal = Object.values(floor).reduce((a, b) => a + b, 0);
  add(
    ...Object.entries(floor).map(([a, m2]) => line(a, m2, { meta: `${a} · ferdig lagt` })),
    line(sys.floorProtection, v.floor.protection ? floorTotal : 0),
  );

  // Placed objects and counted items (Montering too: hours counted in the panel), in catalog order
  const objectCounts = countBy(v.objects.map((o) => o.product));
  for (const c of v.counted) objectCounts.set(c.product, (objectCounts.get(c.product) ?? 0) + c.qty);
  add(...[...objectCounts].map(([a, n]) => line(a, n)));

  add(
    ...v.loose.map((l) => ({
      name: l.name,
      qty: l.qty,
      unit: 'stk' as const,
      price: l.price,
      sum: l.qty * l.price,
      artnr: '',
      placeholder: false,
      group: 'tjen.lose',
      meta: l.price ? undefined : 'pris settes i tilbudet',
    })),
  );

  const groups: CalcGroup[] = groupItems(lines, (l) => l.group).map(({ group, subgroups }) => {
    const ls = subgroups.flatMap((x) => x.items);
    return { id: group.id, name: group.name, lines: ls, sum: ls.reduce((a, l) => a + l.sum, 0) };
  });

  // Labour: an estimate only. It is included in the unit prices; the quote gets Montering when it is counted.
  const L = rules.labour;
  const textileM2 = prod.area;
  const raw =
    L.perModule * mods.length +
    L.perLmBeam * beamLm +
    L.perBeamPost * beamPosts +
    L.perM2Textile * textileM2 +
    L.perM2Foil * (foilFull + foilDecal);
  const hours = mods.length + beamLm > 0 ? Math.max(L.min, Math.round(raw / L.round) * L.round) : 0;

  return {
    groups,
    sum: groups.reduce((a, g) => a + g.sum, 0),
    keyFigures: {
      area: v.stand.width * v.stand.depth,
      openSides: openSides(v.stand).length,
      wallLm: walled.length,
      roomWallLm: walled.filter((m) => roomWalls.has(m.wallId)).length,
      openings: headers,
      beamLm,
      beamLengths: nLengths,
      posts: allPosts.size,
      beamPosts,
      topRails: foga.modules.length,
      bottomRails: foga.modules.length,
      floor,
      floorTotal,
      textileM2,
      textileLm: prod.lm,
      foilM2: foilFull + foilDecal,
      hours,
      hoursPreliminary: L.status === 'foreløpig',
    },
    beams,
    posts: [...allPosts.values()],
    production: prod,
    foga,
  };
}

/** m² per floor product. Cells outside the stand are ignored. */
export function floorAreas(v: Variant): Record<string, number> {
  const nx = Math.round(v.stand.width / CELL);
  const ny = Math.round(v.stand.depth / CELL);
  const out: Record<string, number> = {};
  for (const [k, a] of Object.entries(v.floor.cells)) {
    const c = parseCellKey(k);
    if (!c || c[0] >= nx || c[1] >= ny || !a) continue;
    out[a] = (out[a] ?? 0) + CELL * CELL;
  }
  return out;
}

function countBy(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return m;
}
