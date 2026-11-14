// Standard counters and podier in Disker og podier (Byggeregel K22, Bjørn 13. and 14.11.2026): a counter in stock, as
// Bardisk 6560 or Podie 50 × 50 in one of its heights, is a preset of sections built exactly as the one in stock. Drawn
// freely and built exactly so, it is that product too. While a counter of Disker og podier is exactly a preset, in
// any turn and place, it is that stock product: the catalog price, picked whole as one piece. Colour (K6), print and
// decals (K20), turning, moving and standing against a wall or another counter keep it; another size, height or shelf,
// a sliding door, another open side or a fusion makes it built on site (K13). Pure, mm in the counter's frame.
import { RECIPES } from '../foga/recipes';
import { layoutOf, piecesOf } from './counterShape';
import { prunedSides, turnedSides } from './podiumFaces';
import { bounds, EPS } from './podiumSections';
import type { CounterLight, CounterSection, PlacedObject, Point, SectionSide } from './types';

const R = RECIPES.counter;

/** A standard counter: its art.nr (the variant's; the catalog has its name and price), the catalog product it is a
 *  variant of, its function (the subgroup of Disker og podier it serves: `disker` a place visitors seek a person,
 *  `podier` one that carries a product shown), and its sections. */
export interface StockCounter {
  artnr: string;
  product: string;
  func: string;
  sections: readonly CounterSection[];
}

/** Podie 50 × 50 per height (Bjørn 14.11.2026): one tight section 500 × 500 c/c, no shelf (K10–K12), each height its
 *  own variant with its own price. 25 cm came last, so it has the last number: an art.nr never changes meaning. */
const PODIE_HEIGHTS: readonly [artnr: string, h: number][] = [
  ['5450-4', 250],
  ['5450-1', 500],
  ['5450-2', 750],
  ['5450-3', 1000],
];
const HALF = R.module.half / 2;

/** The standard counters, in catalog order. 6560: one section 1000 × 500 c/c, CC 1000, a shelf at CC 750, open at the
 *  back (z−) in both light openings (K1–K5). Podie 50 × 50 in its four heights. */
export const STOCK_COUNTERS: readonly StockCounter[] = [
  {
    artnr: '6560',
    product: '6560',
    func: 'disker',
    sections: [{ x: [-R.module.whole / 2, R.module.whole / 2], z: [-HALF, HALF], h: R.top, shelves: [R.middle], sides: { 'z-': { lights: ['open', 'open'] } } }],
  },
  ...PODIE_HEIGHTS.map(([artnr, h]): StockCounter => ({ artnr, product: '5450', func: 'podier', sections: [{ x: [-HALF, HALF], z: [-HALF, HALF], h }] })),
];

/** A standard counter's outer size, mm: length and depth out to the faces, and its height CC (K10, K12). */
export function stockSize(s: StockCounter): { length: number; depth: number; h: number } {
  const b = bounds(s.sections);
  const length = b.x[1] - b.x[0] + 2 * R.face;
  const depth = b.z[1] - b.z[0] + 2 * R.face;
  return { length: Math.max(length, depth), depth: Math.min(length, depth), h: Math.max(...s.sections.map((x) => x.h)) };
}

/** The standard counter with this art.nr. */
export const stockByArtnr = (artnr: string): StockCounter | undefined => STOCK_COUNTERS.find((s) => s.artnr === artnr);

/** The sections of a standard counter, to place. */
export const stockSections = (artnr = STOCK_COUNTERS[0].artnr): CounterSection[] => structuredClone([...(stockByArtnr(artnr) ?? STOCK_COUNTERS[0]).sections]);

/** What a counter is built as, whatever its turn, place, colour or decor: its sections turned by `rot`, moved to start
 *  at 0, in order, each side with only what it is (light openings). */
function shapeKey(sections: readonly CounterSection[], rot: number): string {
  const t = (rot / 90) % 4;
  const turned = sections.map((s) => {
    let x: [number, number] = [...s.x];
    let z: [number, number] = [...s.z];
    // (x, z) → (−z, x) per quarter turn, as turnedSides
    for (let i = 0; i < t; i++) [x, z] = [[-z[1], -z[0]], x];
    return { ...s, x, z, sides: turnedSides(s.sides, rot) };
  });
  const b = bounds(turned);
  const bare = (side: SectionSide | undefined) => (side?.lights?.some((k) => k) ? side.lights : undefined);
  return JSON.stringify(
    turned
      .map((s) => ({
        x: [s.x[0] - b.x[0], s.x[1] - b.x[0]],
        z: [s.z[0] - b.z[0], s.z[1] - b.z[0]],
        h: s.h,
        shelves: s.shelves ?? [],
        sides: Object.fromEntries(Object.entries(s.sides ?? {}).flatMap(([k, side]) => (bare(side) ? [[k, bare(side)]] : [])).sort()),
      }))
      .sort((p, q) => p.x[0] - q.x[0] || p.z[0] - q.z[0]),
  );
}

/** The standard counter these sections are exactly (K22), if any. */
export function stockOf(sections: readonly CounterSection[] | undefined): StockCounter | undefined {
  if (!sections?.length) return undefined;
  const keys = new Set([0, 90, 180, 270].map((r) => shapeKey(sections, r)));
  return STOCK_COUNTERS.find((s) => s.sections.length === sections.length && keys.has(shapeKey(s.sections, 0)));
}

/** The product an object is sold as: a standard counter's art.nr while it is one (K22), else its own. */
export const soldAs = (o: Pick<PlacedObject, 'product' | 'sections'>): string => stockOf(o.sections)?.artnr ?? o.product;

/** This art.nr is a standard counter (K22). */
export const isStock = (artnr: string): boolean => !!stockByArtnr(artnr);

/**
 * A counter from before Disker og podier took over Disker (Bjørn 13.11.2026) as sections (K22): the counter in stock as
 * its standard counter, a drawn counter (K7) one section per whole or half metre, open at its back in both light
 * openings, with the shelf at CC 750 as in 6560. Built the same, so it costs and is picked the same; colour and place
 * kept. `product`: the product of Disker og podier. Other objects as they are.
 */
export function asSections(o: PlacedObject, product: string): PlacedObject {
  const stock = !o.pieces && !o.sections && STOCK_COUNTERS.find((s) => s.artnr === o.product);
  if (!o.pieces && !stock) return o;
  const l = layoutOf(piecesOf(o));
  const onOpen = (a: Point, b: Point) =>
    l.open.some(([p, q]) => [a, b].every(([x, z]) => x > Math.min(p[0], q[0]) - EPS && x < Math.max(p[0], q[0]) + EPS && z > Math.min(p[1], q[1]) - EPS && z < Math.max(p[1], q[1]) + EPS));
  const open = { lights: ['open', 'open'] as CounterLight[] };
  const sections = stock
    ? stockSections(stock.artnr)
    : l.cells.map((c): CounterSection => {
        const sides: CounterSection['sides'] = {};
        if (onOpen([c.x[0], c.z[0]], [c.x[0], c.z[1]])) sides['x-'] = open;
        if (onOpen([c.x[1], c.z[0]], [c.x[1], c.z[1]])) sides['x+'] = open;
        if (onOpen([c.x[0], c.z[0]], [c.x[1], c.z[0]])) sides['z-'] = open;
        if (onOpen([c.x[0], c.z[1]], [c.x[1], c.z[1]])) sides['z+'] = open;
        return { x: [c.x[0], c.x[1]], z: [c.z[0], c.z[1]], h: R.top, shelves: [R.middle], ...(Object.keys(sides).length && { sides }) };
      });
  const { pieces: _, ...rest } = o;
  return { ...rest, product, sections: prunedSides(sections) };
}
