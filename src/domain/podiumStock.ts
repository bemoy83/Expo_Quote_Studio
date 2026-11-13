// Standard counters in Disker og podier (Byggeregel K22, Bjørn 13.11.2026): a counter in stock, as Bardisk 6560, is a
// preset of sections built exactly as the counter in stock. While a counter of Disker og podier is exactly a preset, in
// any turn and place, it is that stock product: the catalog price, picked whole as one piece. Colour (K6), print and
// decals (K20), turning, moving and standing against a wall or another counter keep it; another size, height or shelf,
// a sliding door, another open side or a fusion makes it built on site (K13). Pure, mm in the counter's frame.
import { RECIPES } from '../foga/recipes';
import { layoutOf, piecesOf } from './counterShape';
import { prunedSides, turnedSides } from './podiumFaces';
import { bounds, EPS } from './podiumSections';
import type { CounterLight, CounterSection, PlacedObject, Point, SectionSide } from './types';

const R = RECIPES.counter;

/** A standard counter: its art.nr (the catalog has its name and price) and its sections. */
export interface StockCounter {
  artnr: string;
  sections: readonly CounterSection[];
}

/** The standard counters, in the order the pen offers them. 6560: one section 1000 × 500 c/c, CC 1000, a shelf at CC
 *  750, open at the back (z−) in both light openings (K1–K5). */
export const STOCK_COUNTERS: readonly StockCounter[] = [
  {
    artnr: '6560',
    sections: [{ x: [-R.module.whole / 2, R.module.whole / 2], z: [-R.module.half / 2, R.module.half / 2], h: R.top, shelves: [R.middle], sides: { 'z-': { lights: ['open', 'open'] } } }],
  },
];

/** The sections of a standard counter, to place. */
export const stockSections = (artnr = STOCK_COUNTERS[0].artnr): CounterSection[] => structuredClone([...(STOCK_COUNTERS.find((s) => s.artnr === artnr) ?? STOCK_COUNTERS[0]).sections]);

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
export const isStock = (artnr: string): boolean => STOCK_COUNTERS.some((s) => s.artnr === artnr);

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
