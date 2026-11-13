// Disker og podier (Byggeregler K10–K13): a counter or podium drawn of sections on a 250 mm grid, every side closed,
// built on site. It is a PlacedObject with `sections` (counterShape.ts builds it tight, K11), beside the counters of
// Disker (6560 and drawn pieces, counters.ts), which stay as they are. The pen: pointing shows one section 500 × 500
// under the pointer, moved in against a wall, counter or the stand edge within 10 cm; a click stores it; a press and drag
// grows it from the section pressed, which stays put, each way on its own in 500 steps (K10: whole metres from the
// section pressed, the rest last). Pure, plan in m, sections in mm.
import { RECIPES } from '../foga/recipes';
import { counterBuildOf, snap } from './counterShape';
import { snapShift } from './counters';
import { nextId } from './ids';
import { blockers, COUNTER_STOCK_RAL, footprintBox, hitsAny, objectBoxes, objectFootprint, type PlaceContext } from './objects';
import type { CounterSection, PlacedObject, Point, Variant } from './types';

const R = RECIPES.counter;
const EPS = 1e-6;
type Range = readonly [number, number];

/** The grid sections are drawn on, mm (K10). */
export const GRID = 250;
/** The largest section each way, mm c/c (K10). */
export const SECTION_MAX = R.module.whole;
/** The section the pen shows and a click stores, mm c/c. */
export const START = 500;
/** A drag grows the counter in steps of this, mm (twice the grid; 250 with Shift is PR 2). */
export const DRAG_STEP = 2 * GRID;
/** Heights a section can have, CC mm (K12); everything drawn is the highest until the quick picks get Høyde (PR 6). */
export const HEIGHTS = [250, 500, 750, 1000] as const;
export const HEIGHT = 1000;

/** Where the nodes of a run from `a` to `b` fall (K10): whole metres from the side it starts from, the rest last. */
export function runNodes(a: number, b: number, from: 'lo' | 'hi' = 'lo'): number[] {
  const steps = [0];
  for (let at = 0; b - a - at > EPS; ) {
    at += Math.min(SECTION_MAX, b - a - at);
    steps.push(at);
  }
  return from === 'lo' ? steps.map((t) => a + t) : steps.map((t) => b - t).reverse();
}

/** A rectangle from `x` to `z` as sections (K10): each way whole metres from the side the drag started, the rest last. */
export function rectSections(x: Range, z: Range, from: { x: 'lo' | 'hi'; z: 'lo' | 'hi' }, h = HEIGHT): CounterSection[] {
  const xs = runNodes(x[0], x[1], from.x);
  const zs = runNodes(z[0], z[1], from.z);
  const out: CounterSection[] = [];
  for (let j = 1; j < zs.length; j++) for (let i = 1; i < xs.length; i++) out.push({ x: [xs[i - 1], xs[i]], z: [zs[j - 1], zs[j]], h });
  return out;
}

/** One way of a drag (the order's reference): the section pressed spans lo–hi, and the pointer at `v` past an edge
 *  grows it on that side by whole steps of 500, rounded; inside the section nothing changes. mm. */
export function dragSpan(lo: number, hi: number, v: number): [number, number] {
  if (v > hi) return [lo, hi + Math.round((v - hi) / DRAG_STEP) * DRAG_STEP];
  if (v < lo) return [lo - Math.round((lo - v) / DRAG_STEP) * DRAG_STEP, hi];
  return [lo, hi];
}

/** The box round some sections, node to node, mm. */
function bounds(sections: readonly CounterSection[]) {
  return {
    x: [Math.min(...sections.map((s) => s.x[0])), Math.max(...sections.map((s) => s.x[1]))] as const,
    z: [Math.min(...sections.map((s) => s.z[0])), Math.max(...sections.map((s) => s.z[1]))] as const,
  };
}

/** Whether a point (mm) lies inside one of the sections. */
const covered = (sections: readonly CounterSection[], x: number, z: number) => sections.some((s) => x > s.x[0] && x < s.x[1] && z > s.z[0] && z < s.z[1]);

/** The inner corners of the outline (K13, time per corner): the nodes with three of their four quarters covered. */
export function innerCorners(sections: readonly CounterSection[]): number {
  const nodes = new Map<string, Point>();
  for (const s of sections) for (const x of s.x) for (const z of s.z) nodes.set(`${x},${z}`, [x, z]);
  let n = 0;
  for (const [x, z] of nodes.values()) {
    const q = [covered(sections, x - 1, z - 1), covered(sections, x + 1, z - 1), covered(sections, x - 1, z + 1), covered(sections, x + 1, z + 1)];
    if (q.filter(Boolean).length === 3) n++;
  }
  return n;
}

/** «Disk» when the shape is no deeper than 500 anywhere (no 750 × 750 fits in it), else «Podium» (K13). */
export function podiumName(sections: readonly CounterSection[]): 'Disk' | 'Podium' {
  const b = bounds(sections);
  const g = GRID;
  for (let x = b.x[0]; x + 3 * g <= b.x[1] + EPS; x += g)
    for (let z = b.z[0]; z + 3 * g <= b.z[1] + EPS; z += g) {
      let all = true;
      for (let i = 0; i < 3 && all; i++) for (let k = 0; k < 3 && all; k++) all = covered(sections, x + (i + 0.5) * g, z + (k + 0.5) * g);
      if (all) return 'Podium';
    }
  return 'Disk';
}

/** The counter with its sections centred on its own origin, (x, y) moved to match (an unturned counter). */
function centred(o: PlacedObject, sections: CounterSection[]): PlacedObject {
  const b = bounds(sections);
  const cx = (b.x[0] + b.x[1]) / 2;
  const cz = (b.z[0] + b.z[1]) / 2;
  const t = (n: number) => snap(n) + 0;
  const moved = sections.map((s): CounterSection => ({ x: [t(s.x[0] - cx), t(s.x[1] - cx)], z: [t(s.z[0] - cz), t(s.z[1] - cz)], h: s.h }));
  return { ...o, x: snap(o.x + cx / 1000), y: snap(o.y + cz / 1000), sections: moved };
}

export type PodiumDraw = { v: Variant; id: string; o: PlacedObject } | { error: string; o: PlacedObject };

/** Stored where it stands, or refused where it has no room (K10). `was`: the counter it replaces. */
function placed(v: Variant, ctx: PlaceContext, o: PlacedObject, was?: PlacedObject): PodiumDraw {
  const f = objectFootprint(ctx, o);
  if (!f) return { error: 'Ukjent disk', o };
  const b = footprintBox(o, f);
  const inside = b.x0 > -EPS && b.y0 > -EPS && b.x1 < v.stand.width + EPS && b.y1 < v.stand.depth + EPS;
  if (!inside || hitsAny(objectBoxes(ctx, o), blockers(v, ctx, was?.id ?? o.id))) return { error: 'Ikke plass til disken her', o };
  const objects = was ? v.objects.map((x) => (x.id === was.id ? o : x)) : [...v.objects, o];
  return { v: { ...v, objects }, id: o.id, o };
}

/** What the pen shows and a click at q stores: one section of START × START round q, kept inside the stand and moved in
 *  against a wall, counter or the stand edge within 10 cm (K10). Refused where it has no room. */
export function podiumAt(v: Variant, ctx: PlaceContext, pen: { product: string; ral?: string }, q: Point): PodiumDraw {
  const id = nextId(v.objects.map((o) => o.id), 'i');
  const colour = pen.ral && pen.ral !== COUNTER_STOCK_RAL ? { ral: pen.ral } : {};
  const half = START / 2;
  const o: PlacedObject = { id, product: pen.product, x: q[0], y: q[1], rot: 0, ...colour, sections: [{ x: [-half, half], z: [-half, half], h: HEIGHT }] };
  const w = (half + R.face) / 1000;
  const clamp = (n: number, hi: number) => Math.min(Math.max(n, w), hi - w);
  const kept = { ...o, x: clamp(o.x, v.stand.width), y: clamp(o.y, v.stand.depth) };
  const f = objectFootprint(ctx, kept);
  if (!f) return { error: 'Ukjent disk', o };
  const s = snapShift(v, footprintBox(kept, f), blockers(v, ctx, id));
  return placed(v, ctx, { ...kept, x: snap(kept.x + s.x), y: snap(kept.y + s.y) });
}

/**
 * The counter a press and drag draws (K10): from `start`, the section the pen showed at the press (podiumAt), which stays
 * put. Each way on its own, the pointer at q past an edge of it grows the counter on that side in 500 steps; both ways
 * make a rectangle. Split in sections with the rest farthest from the section pressed.
 */
export function drawPodium(v: Variant, ctx: PlaceContext, start: PlacedObject, q: Point): PodiumDraw {
  const s = start.sections?.[0];
  if (!s) return { error: 'Ukjent disk', o: start };
  const px = (q[0] - start.x) * 1000;
  const pz = (q[1] - start.y) * 1000;
  const x = dragSpan(s.x[0], s.x[1], px);
  const z = dragSpan(s.z[0], s.z[1], pz);
  const from = { x: x[0] < s.x[0] - EPS ? ('hi' as const) : ('lo' as const), z: z[0] < s.z[0] - EPS ? ('hi' as const) : ('lo' as const) };
  return placed(v, ctx, centred(start, rectSections(x, z, from, s.h)));
}

/** Outer size of a counter of Disker og podier, mm: length × depth × height (K10, K12). */
export function podiumSize(o: Pick<PlacedObject, 'sections'>): { length: number; depth: number; height: number } {
  const b = counterBuildOf(o);
  return { length: b.length, depth: b.depth, height: Math.max(...b.profiles.map((p) => p.box.y[1])) };
}
