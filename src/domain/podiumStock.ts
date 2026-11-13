// Standard counters in Disker og podier (Byggeregel K22, Bjørn 13.11.2026): a counter in stock, as Bardisk 6560, is a
// preset of sections built exactly as the counter in stock. While a counter of Disker og podier is exactly a preset, in
// any turn and place, it is that stock product: the catalog price, picked whole as one piece. Colour (K6), print and
// decals (K20), turning, moving and standing against a wall or another counter keep it; another size, height or shelf,
// a sliding door, another open side or a fusion makes it built on site (K13). Pure, mm in the counter's frame.
import { RECIPES } from '../foga/recipes';
import { turnedSides } from './podiumFaces';
import { bounds } from './podiumSections';
import type { CounterSection, SectionSide } from './types';

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
