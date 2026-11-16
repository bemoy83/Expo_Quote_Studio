// A counter's shape: the sections of Disker og podier (`PlacedObject.sections`, K10–K12, mm, front toward +y unturned)
// as parts and open stretches, the build of every piece of it, its footprint, and the way between its own coordinates
// and the plan's. Its pen is in podiums.ts. A counter without sections is the counter in stock, 6560 (K1, K22).
import { layoutBuild, type CounterBuild, type CounterLayout } from '../foga/counter';
import { RECIPES } from '../foga/recipes';
import type { Footprint } from '../catalog/types';
import { podiumLights } from './podiumFaces';
import { stockSections } from './podiumStock';
import type { CounterSection, PlacedObject, Point } from './types';

const R = RECIPES.counter;

/** A counter's sections: its own, or those of the counter in stock (K22). */
const sectionsOf = (o: Pick<PlacedObject, 'sections'>): readonly CounterSection[] => o.sections ?? STOCK;
const STOCK = stockSections();

/** Sections of Disker og podier as parts (K10, K11): each its own cell with its height, open or with a sliding door
 *  where a side is (K16, K17). */
function sectionsLayout(sections: readonly CounterSection[]): CounterLayout {
  return { cells: sections.map((c) => ({ x: c.x, z: c.z, h: c.h, ...(c.shelves?.length && { shelves: c.shelves }) })), ...podiumLights(sections) };
}

/** The parts and open stretches of a counter (K10, K16). */
export const counterLayoutOf = (o: Pick<PlacedObject, 'sections'>): CounterLayout => sectionsLayout(sectionsOf(o));

const built = new Map<string, CounterBuild>();
/** Every piece of a counter (K1–K5, K10–K12, K16), built once per shape. */
export function counterBuildOf(o: Pick<PlacedObject, 'sections'>): CounterBuild {
  const sections = sectionsOf(o);
  const key = JSON.stringify(sections);
  let b = built.get(key);
  if (!b) {
    b = layoutBuild(R, sectionsLayout(sections));
    built.set(key, b);
  }
  return b;
}

/** What a counter of Disker og podier covers, one rectangle per section in its own coordinates, mm: node to node and out
 *  to the outer faces (K10). Sections that meet overlap by twice the face, which is the same counter. */
export function sectionRects(o: Pick<PlacedObject, 'sections'>): { x0: number; y0: number; x1: number; y1: number }[] {
  return (o.sections ?? []).map((c) => ({ x0: c.x[0] - R.face, x1: c.x[1] + R.face, y0: c.z[0] - R.face, y1: c.z[1] + R.face }));
}

/** A counter's footprint: the box round its sections, m; the catalog's for the counter in stock. */
export function counterFootprint(o: Pick<PlacedObject, 'sections'>, f: Footprint): Footprint {
  if (!o.sections) return f;
  const b = counterBuildOf(o);
  return { ...f, w: b.length / 1000, d: b.depth / 1000 };
}

// Between a counter's own coordinates (mm, front toward +y unturned) and the plan's (m), in quarter turns

/** Plan direction of a local one, for a counter turned `rot` degrees (SVG rotate: clockwise with y down). */
export function turn(p: Point, rot: number): Point {
  const t = (rot * Math.PI) / 180;
  const c = Math.round(Math.cos(t));
  const s = Math.round(Math.sin(t));
  return [p[0] * c - p[1] * s + 0, p[0] * s + p[1] * c + 0];
}
export const unturn = (p: Point, rot: number) => turn(p, -rot);

/** A local point (mm) in the plan (m). */
export const toPlan = (o: Pick<PlacedObject, 'x' | 'y' | 'rot'>, p: Point): Point => {
  const q = turn(p, o.rot);
  return [o.x + q[0] / 1000, o.y + q[1] / 1000];
};
/** A plan point (m) in a counter's own coordinates (mm). */
export const toLocal = (o: Pick<PlacedObject, 'x' | 'y' | 'rot'>, p: Point): Point => unturn([(p[0] - o.x) * 1000, (p[1] - o.y) * 1000], o.rot);

/** To whole mm in m, or whole µm in mm. */
export const snap = (n: number) => Math.round(n * 1000) / 1000;
