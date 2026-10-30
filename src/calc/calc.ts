import { displayName, indexCatalog } from '../catalog/lookup';
import type { Catalog, Unit } from '../catalog/types';
import { CELL, openSides, parseCellKey } from '../domain/grid';
import type { Point, Variant } from '../domain/types';
import { builtModules, wallPoints } from '../domain/walls';
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
  /** Rate not yet approved: † on the quote. */
  preliminary?: boolean;
}

export type GroupId = 'walls' | 'frame' | 'beams' | 'openings' | 'textile' | 'foil' | 'floor' | 'loose' | 'labour' | `cat:${string}`;

export interface CalcGroup {
  id: GroupId;
  name: string;
  lines: CalcLine[];
  sum: number;
}

export interface KeyFigures {
  area: number;
  openSides: number;
  /** Wall modules that are wall, not opening. Shared walls count once. */
  wallLm: number;
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
  hours: number;
}

export interface CalcResult {
  groups: CalcGroup[];
  sum: number;
  keyFigures: KeyFigures;
  beams: BeamLayout;
  posts: Point[];
  production: Production;
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
  const plates = new Map<string, number>();
  for (const m of walled) plates.set(m.plate, (plates.get(m.plate) ?? 0) + 1);
  const plateSize = `${rules.wall.plate.width} × ${rules.wall.plate.height} mm`;

  const groups: CalcGroup[] = [];
  const push = (id: GroupId, name: string, lines: CalcLine[]) => {
    const kept = lines.filter((l) => l.qty > 0);
    if (kept.length) groups.push({ id, name, lines: kept, sum: kept.reduce((a, l) => a + l.sum, 0) });
  };

  push(
    'walls',
    'Standvegger',
    [...plates].map(([ral, n]) => {
      const hit = idx.plateByRal.get(ral);
      return hit ? line(hit.variant.artnr, n, { meta: `RAL ${ral} · ${plateSize}` }) : line(`RAL ${ral}`, n);
    }),
  );
  push('frame', 'Stolper og profiler', [
    line(sys.post, allPosts.size, beamPosts ? { meta: `${points.size} vegg, ${beamPosts} takdrager` } : {}),
    line(sys.topRail, mods.length),
    line(sys.bottomRail, walled.length),
  ]);
  const nLengths = beams.segments.length;
  push('beams', 'Takdrager', [line(sys.beam, beams.lm, { meta: `${nLengths} ${nLengths === 1 ? 'lengde' : 'lengder'}` })]);

  const openingCounts = countBy(mods.flatMap((m) => (m.opening ? [m.opening.product] : [])));
  const nOpenings = mods.filter((m) => m.opening).length;
  push('openings', 'Dører og forheng', [...[...openingCounts].map(([a, n]) => line(a, n)), line(sys.header, nOpenings)]);

  // Textile walls: quantities from the InFrame production rules
  const prod = production(v, rules.textile.inFrame, '');
  const nFrames = prod.pieces.length;
  push('textile', 'Tekstilvegger', [
    line(sys.frame, prod.lm, { meta: `${nFrames} ${nFrames === 1 ? 'ramme' : 'rammer'} · inkl. stag` }),
    line(sys.print, prod.area, { meta: 'inkl. bleed' }),
  ]);

  // Foil
  const wallIds = new Set(v.walls.map((w) => w.id));
  const fullFelt = (rules.wall.plate.width * rules.wall.plate.height) / 1e6;
  const foils = v.foils.filter((f) => wallIds.has(f.wallId));
  const foilFull = foils.filter((f) => f.full).length * fullFelt;
  const foilDecal = foils.filter((f) => !f.full).reduce((a, f) => a + f.width * f.height, 0);
  push('foil', 'Profilering', [
    line(sys.foil, foilDecal, { meta: 'innenfor ett veggfelt' }),
    line(sys.foilFull, foilFull, { meta: `${foils.filter((f) => f.full).length} felt · ${plateSize}` }),
  ]);

  // Floor: cells × 0,25 m² per product. Waste is ours and not counted.
  const floor = floorAreas(v);
  const floorTotal = Object.values(floor).reduce((a, b) => a + b, 0);
  push('floor', 'Gulv', [
    ...Object.entries(floor).map(([a, m2]) => line(a, m2, { meta: `${a} · ferdig lagt` })),
    line(sys.floorProtection, v.floor.protection ? floorTotal : 0),
  ]);

  // Placed objects and counted items, grouped by product category in catalog order
  const objectCounts = countBy(v.objects.map((o) => o.product));
  for (const c of v.counted) objectCounts.set(c.product, (objectCounts.get(c.product) ?? 0) + c.qty);
  const byCategory = new Map<string, CalcLine[]>();
  for (const [a, n] of objectCounts) {
    const cat = idx.byArtnr.get(a)?.product.category ?? 'Annet';
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), line(a, n)]);
  }
  const catOrder = [...new Set(catalog.products.map((p) => p.category)), 'Annet'];
  [...byCategory].sort(([a], [b]) => catOrder.indexOf(a) - catOrder.indexOf(b)).forEach(([cat, lines]) => push(`cat:${cat}`, cat, lines));

  push(
    'loose',
    'Løse linjer',
    v.loose.map((l) => ({
      name: l.name,
      qty: l.qty,
      unit: 'stk' as const,
      price: l.price,
      sum: l.qty * l.price,
      artnr: '',
      placeholder: false,
      meta: l.price ? undefined : 'pris settes i tilbudet',
    })),
  );

  // Labour
  const L = rules.labour;
  const textileM2 = prod.area;
  const raw =
    L.perModule * mods.length +
    L.perLmBeam * beams.lm +
    L.perBeamPost * beamPosts +
    L.perM2Textile * textileM2 +
    L.perM2Foil * (foilFull + foilDecal);
  const hours = mods.length + beams.lm > 0 ? Math.max(L.min, Math.round(raw / L.round) * L.round) : 0;
  const prelim = L.status === 'foreløpig';
  push('labour', 'Montering', [line(sys.labour, hours, prelim ? { meta: 'foreløpig sats', preliminary: true } : {})]);

  return {
    groups,
    sum: groups.reduce((a, g) => a + g.sum, 0),
    keyFigures: {
      area: v.stand.width * v.stand.depth,
      openSides: openSides(v.stand).length,
      wallLm: walled.length,
      openings: nOpenings,
      beamLm: beams.lm,
      beamLengths: nLengths,
      posts: allPosts.size,
      beamPosts,
      topRails: mods.length,
      bottomRails: walled.length,
      floor,
      floorTotal,
      textileM2,
      textileLm: prod.lm,
      foilM2: foilFull + foilDecal,
      hours,
    },
    beams,
    posts: [...allPosts.values()],
    production: prod,
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
