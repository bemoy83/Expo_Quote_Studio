import { groupItems, resolveGroup } from '../catalog/groups';
import { displayName, indexCatalog } from '../catalog/lookup';
import type { Catalog, Unit } from '../catalog/types';
import { CELL, openSides, parseCellKey } from '../domain/grid';
import type { Point, Variant } from '../domain/types';
import { builtModules, wallPoints } from '../domain/walls';
import { bom, type Bom } from '../foga/engine';
import { bomSizes, structureOf } from '../foga/fromVariant';
import { RECIPES } from '../foga/recipes';
import type { FogaStructure } from '../foga/structure';
import { fogaPart } from '../foga/parts';
import { DEFAULT_PRICING, ITEM, type PricingData } from '../pricing/data';
import { dgOf, priceLine, type Strategy, type Transfer, type Use } from '../pricing/model';
import type { Rules } from '../rules/rules';
import { layoutBeams, type BeamLayout } from './beams';
import { production, type Production } from './production';

export interface CalcLine {
  name: string;
  meta?: string;
  qty: number;
  unit: Unit;
  /** Sales price per unit eks. mva.: from cost and target DG (sum) or the catalog price (fast). */
  price: number;
  sum: number;
  artnr: string;
  /** Example or unknown price: * on the quote. */
  placeholder: boolean;
  /** Subgroup id (catalog/groups.ts), from the product. */
  group: string;
  /** Built from Foga parts: the picking list shows the parts (foga/engine.ts) instead of this line. */
  foga?: true;
  /** Internal, never on the quote. Cost of the whole line, null when not known (no cost data). */
  cost: number | null;
  /** Dekningsgrad of the line, null when the cost is not known. */
  dg: number | null;
  /** How the price was set. `fast` also when a sum product lacks cost data. */
  strategy: Strategy;
  transfer: Transfer | 'blandet' | null;
  /** Shown to the customer when the product is part rental, part sale. */
  terms?: string;
  /** Montør hours in the line's items (handling and montering on site). */
  hours: number;
}

/** One main group of the product grouping, lines in subgroup order. */
export interface CalcGroup {
  id: string;
  name: string;
  lines: CalcLine[];
  sum: number;
  /** Cost of the lines with known cost. */
  cost: number;
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
  /** Wall modules including those with a door or curtain (each gets top and bottom rail, in its header if an opening). */
  modules: number;
  /** m² per floor art.nr. */
  floor: Record<string, number>;
  floorTotal: number;
  textileM2: number;
  foilM2: number;
  /** Montør hours in the products priced as a sum (handling and montering on site). In the prices, not a line. */
  hours: number;
}

/** Internal margin of the whole variant. Never on the quote. */
export interface Margin {
  /** Cost of the lines with known cost. */
  cost: number;
  /** Sales sum of those lines. */
  sum: number;
  /** Dekningsbidrag and dekningsgrad over the lines with known cost. */
  db: number;
  dg: number;
  /** Lines without cost data: their price is the catalog price and they are not in the margin. */
  unknown: number;
}

export interface CalcResult {
  groups: CalcGroup[];
  sum: number;
  margin: Margin;
  keyFigures: KeyFigures;
  beams: BeamLayout;
  posts: Point[];
  production: Production;
  /** What is built, in Foga terms: the quote counts from it and the picking list lists its parts. */
  foga: FogaStructure;
  /** Level 2 and 3: the Foga parts list of `foga`. The picking list and the kalkyle's articles show it. */
  bom: Bom;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Pure: the quote lines, their cost and margin, and the key figures of one variant. */
export function calc(v: Variant, rules: Rules, catalog: Catalog, pricing: PricingData = DEFAULT_PRICING): CalcResult {
  const idx = indexCatalog(catalog);
  const sys = catalog.system;
  const sizes = bomSizes(rules);
  const items = pricing.items;

  /**
   * One quote line. `uses` is what the line is built from (all of it, not per unit), each at its OMS price: a product
   * priced as a sum gets its price from them. Otherwise the variant's own price (from the OMS); `own` overrides it.
   */
  const line = (artnr: string, qty: number, extra: Partial<CalcLine> = {}, uses: Use[] | null = null, own?: number): CalcLine => {
    const hit = idx.byArtnr.get(artnr);
    const q = hit?.product.unit === 'stk' ? qty : r1(qty);
    const cost = hit?.variant.cost;
    const p = priceLine(q, hit?.product.pricing ?? 'fast', { price: own ?? hit?.variant.price ?? 0, ...(cost !== undefined && own === undefined ? { cost } : {}) }, uses, items);
    return {
      name: hit ? displayName(hit) : artnr,
      qty: q,
      unit: hit?.product.unit ?? 'stk',
      price: p.price,
      sum: q * p.price,
      artnr,
      // A summed price is from OMS item prices, not a placeholder (the example price list is flagged in the kalkyle)
      placeholder: !hit || (p.strategy === 'fast' && !!hit.variant.placeholder),
      group: resolveGroup(hit?.product.group).subgroup.id,
      cost: p.cost,
      dg: p.dg,
      strategy: p.strategy,
      transfer: p.transfer,
      ...(p.transfer === 'blandet' ? { terms: pricing.terms[hit?.product.id ?? ''] ?? 'Delvis leie, delvis kjøp' } : {}),
      hours: p.hours,
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
  const wallMetres = countBy(fogaWalls.map((m) => m.plate));
  const plateSize = `${rules.wall.plate.width} × ${rules.wall.plate.height} mm`;
  // Wall posts are shared between modules: each module (door and curtain included) carries an equal share of them
  const postShare = mods.length ? (allPosts.size - beamPosts) / mods.length : 0;
  const rail = (code: string) => ITEM.rail(code, sizes.cc - (fogaPart(RECIPES.wall.post).section?.[0] ?? 0));
  const moduleUses = (n: number): Use[] => [
    { id: rail(RECIPES.wall.topRail), qty: n },
    { id: rail(RECIPES.wall.bottomRail), qty: n },
    { id: ITEM.post, qty: n * postShare },
    { id: ITEM.module, qty: n },
  ];

  // Level 1 only: what the customer buys. The articles behind wall, takdrager and textile (plates, posts, rails,
  // profiles) are on the picking list, counted from the same Foga structure; `foga` marks the lines they replace there.
  // Each line's cost is the sum of what is actually built for it.
  const lines: CalcLine[] = [];
  const add = (...ls: CalcLine[]) => lines.push(...ls.filter((l) => l.qty > 0));
  const built = { foga: true } as const;

  // Walls per metre and colour. A module with a door or curtain is never wall: it is in the opening product.
  add(
    ...[...wallMetres].map(([ral, n]) => {
      const hit = idx.wallByRal.get(ral);
      const lm = n * rules.wall.cc;
      const uses = [{ id: ITEM.plate, qty: n }, ...moduleUses(n)];
      return hit
        ? line(hit.variant.artnr, lm, { ...built, meta: `RAL ${ral}` }, uses)
        : line(`${sys.wall}-${ral}`, lm, { ...built, group: 'vegg.vegger' }, uses);
    }),
  );
  // Takdrager per metre, its own posts included in the price
  const nLengths = foga.beams.length;
  const beamMeta = [`${nLengths} ${nLengths === 1 ? 'lengde' : 'lengder'}`, ...(beamPosts ? [`${beamPosts} ${beamPosts === 1 ? 'stolpe' : 'stolper'} inkludert`] : [])];
  const beamUses: Use[] = [
    ...foga.beams.map((b) => ({ id: ITEM.beam(b.lengthMm - 40), qty: 1 })),
    { id: ITEM.post, qty: beamPosts },
    { id: ITEM.beamLm, qty: beamLm },
    { id: ITEM.beamPost, qty: beamPosts },
  ];
  add(line(sys.beam, beamLm, { ...built, meta: beamMeta.join(' · ') }, beamUses));

  // Door or curtain with header (overstykke), one product each
  const openingCounts = countBy(mods.flatMap((m) => (m.opening ? [m.opening.product] : [])));
  add(
    ...[...openingCounts].map(([a, n]) => {
      const leaf = idx.byArtnr.get(a)?.product.opening === 'curtain' ? ITEM.curtain : ITEM.door;
      return line(a, n, {}, [{ id: leaf, qty: n }, { id: ITEM.headerPlate, qty: n }, ...moduleUses(n)]);
    }),
  );

  // Textile walls: one product per frame (frame rental + print), by size B × H. Sizes from InFrame rules. Cost: the
  // loose frame parts (43TX at 2W + 2H, 613, 520), braces and the print incl. bleed. Fast price: m² rate × B × H.
  const bySize = new Map<string, typeof prod.pieces>();
  for (const p of prod.pieces) bySize.set(`${p.W}×${p.H}`, [...(bySize.get(`${p.W}×${p.H}`) ?? []), p]);
  const textile = idx.byArtnr.get(sys.textile);
  add(
    ...[...bySize].map(([size, pieces]) => {
      const [W, H] = size.split('×').map(Number);
      const n = pieces.length;
      const braces = pieces.reduce((a, p) => a + (p.braces?.qty ?? 0), 0);
      const uses: Use[] = [
        { id: ITEM.frameProfileM, qty: (n * (2 * W + 2 * H)) / 1000 },
        { id: ITEM.corner, qty: 4 * n },
        { id: ITEM.wallFixing, qty: RECIPES.frame.wallFixing.perFrame * n },
        { id: ITEM.braceM, qty: pieces.reduce((a, p) => a + ((p.braces?.qty ?? 0) * (p.braces?.length ?? 0)) / 1000, 0) },
        { id: ITEM.bracePiece, qty: braces },
        { id: ITEM.print, qty: pieces.reduce((a, p) => a + (p.pw * p.ph) / 1e6, 0) },
        { id: ITEM.frame, qty: n },
        { id: ITEM.textileM2, qty: (n * W * H) / 1e6 },
      ];
      const fast = Math.round((textile?.variant.price ?? 0) * ((W * H) / 1e6));
      const name = `${textile ? displayName(textile) : sys.textile}, ${W} × ${H} mm`;
      return { ...line(sys.textile, n, built, uses, fast), name, unit: 'stk' as const };
    }),
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

  // Placed objects and counted items (Arbeidstimer too: hours counted in the panel), in catalog order
  const objectCounts = countBy(v.objects.map((o) => o.product));
  for (const c of v.counted) objectCounts.set(c.product, (objectCounts.get(c.product) ?? 0) + c.qty);
  add(...[...objectCounts].map(([a, n]) => line(a, n)));

  add(
    ...v.loose.map((l): CalcLine => ({
      name: l.name,
      qty: l.qty,
      unit: 'stk',
      price: l.price,
      sum: l.qty * l.price,
      artnr: '',
      placeholder: false,
      group: 'tjen.lose',
      meta: l.price ? undefined : 'pris settes i tilbudet',
      cost: null,
      dg: null,
      strategy: 'fast',
      transfer: null,
      hours: 0,
    })),
  );

  const groups: CalcGroup[] = groupItems(lines, (l) => l.group).map(({ group, subgroups }) => {
    const ls = subgroups.flatMap((x) => x.items);
    return { id: group.id, name: group.name, lines: ls, sum: ls.reduce((a, l) => a + l.sum, 0), cost: ls.reduce((a, l) => a + (l.cost ?? 0), 0) };
  });

  const known = lines.filter((l) => l.cost !== null);
  const knownSum = known.reduce((a, l) => a + l.sum, 0);
  const knownCost = known.reduce((a, l) => a + l.cost!, 0);

  return {
    groups,
    sum: groups.reduce((a, g) => a + g.sum, 0),
    margin: { cost: knownCost, sum: knownSum, db: knownSum - knownCost, dg: dgOf(knownSum, knownCost), unknown: lines.length - known.length },
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
      modules: foga.modules.length,
      floor,
      floorTotal,
      textileM2: prod.area,
      foilM2: foilFull + foilDecal,
      hours: lines.reduce((a, l) => a + l.hours, 0),
    },
    beams,
    posts: [...allPosts.values()],
    production: prod,
    foga,
    bom: bom(foga, RECIPES, sizes),
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
