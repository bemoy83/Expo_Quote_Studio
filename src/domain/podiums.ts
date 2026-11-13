// Disker og podier (Byggeregler K10–K13): a counter or podium drawn of sections on a 250 mm grid, every side closed,
// built on site. It is a PlacedObject with `sections` (counterShape.ts builds it tight, K11), beside the counters of
// Disker (6560 and drawn pieces, counters.ts), which stay as they are. The pen: pointing shows one section 500 × 500
// under the pointer, moved in against a wall, counter or the stand edge within 10 cm; a click stores it; a press and drag
// grows it from the section pressed, which stays put, each way on its own in 500 steps (K10: whole metres from the
// section pressed, the rest last). Pointed by the side of a counter of its own, the section lies against that side and
// becomes part of the counter when stored (påbygg, PR 3). Pure, plan in m, sections in mm.
import { RECIPES } from '../foga/recipes';
import { counterBuildOf, snap, toLocal, toPlan } from './counterShape';
import { prunedSides } from './podiumFaces';
import { snapShift } from './counters';
import { nextId } from './ids';
import { blockers, COUNTER_STOCK_RAL, footprintBox, hitsAny, objectBoxes, objectFootprint, type PlaceContext } from './objects';
import { bounds, covered, edgeRuns, EPS, GRID, overlaps, type EdgeRun, type Range } from './podiumSections';
import type { CounterSection, PlacedObject, Point, Variant } from './types';

const R = RECIPES.counter;
export { GRID };
/** The largest section each way, mm c/c (K10). */
export const SECTION_MAX = R.module.whole;
/** The section the pen shows and a click stores, mm c/c; a drag grows the counter in steps of this (250 with Shift). */
const START = 500;
/** Heights a section can have, CC mm (K12): Høyde in the quick picks; the highest when none is picked. */
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

/** One way of a drag without Shift (the order's reference): the section pressed spans lo–hi, and the pointer at `v` past
 *  an edge grows it on that side by whole steps of 500, rounded; inside the section nothing changes. mm. */
export function dragSpan(lo: number, hi: number, v: number): [number, number] {
  const [a, b] = axisSpan({ lo: lo / GRID, hi: hi / GRID, v0: 0, g: 0 }, v / GRID, false);
  return [a * GRID, b * GRID];
}

/** Which edge a press takes hold of, one way (PR 2, CAD: what you hold is where you press, never which way you drag):
 *  −1 the low edge, 1 the high, 0 the middle third. Grid units. */
export type Grab = -1 | 0 | 1;
export function grabOf(lo: number, hi: number, v: number): Grab {
  const t = (v - (lo + hi) / 2) / (hi - lo);
  return Math.abs(t) < 1 / 6 ? 0 : t < 0 ? -1 : 1;
}

/** One way of a drag, in grid units (250 mm): the span lo–hi it started from, the pointer at the press `v0`, and the
 *  edge taken hold of `g`. */
export interface PodiumAxis {
  lo: number;
  hi: number;
  v0: number;
  g: Grab;
  /** The edge that never moves (påbygg: the one against the counter), −1 low or 1 high. */
  fix?: -1 | 1;
}

/** Below this (grid units, 75 mm) a press in the middle with Shift changes nothing yet. */
const STILL = 0.3;

/**
 * The span one way of a drag gives with the pointer at `v` (the order's reference, grid units). Without Shift (`fine`
 * false) it grows past an edge in steps of two. With Shift, an edge taken hold of moves by the pointer's travel in steps
 * of one, out or in down to one, the other edge still; from the middle it is a rectangle from the grid line through the
 * press to the one nearest the pointer, at least one, after the first 75 mm.
 */
export function axisSpan(a: PodiumAxis, v: number, fine: boolean): [number, number] {
  const [x, y] = freeSpan(a, v, fine);
  return a.fix === -1 ? [a.lo, Math.max(a.lo + 1, y)] : a.fix === 1 ? [Math.min(a.hi - 1, x), a.hi] : [x, y];
}

function freeSpan(a: PodiumAxis, v: number, fine: boolean): [number, number] {
  const { lo, hi, v0, g } = a;
  const r = Math.round;
  const grow = (step: number): [number, number] => (v > hi ? [lo, hi + r((v - hi) / step) * step] : v < lo ? [lo - r((lo - v) / step) * step, hi] : [lo, hi]);
  if (!fine) return grow(2);
  const d = r(v - v0);
  if (g > 0) return [lo, Math.max(lo + 1, hi + d)];
  if (g < 0) return [Math.min(hi - 1, lo + d), hi];
  if (Math.abs(v - v0) < STILL) return [lo, hi];
  if (hi - lo === 1) return grow(1);
  const A = Math.min(Math.max(r(v0), lo + 1), hi - 1);
  return v < v0 ? [Math.min(A - 1, r(v)), A] : [A, Math.max(A + 1, r(v))];
}

/** A påbygg (PR 3): the counter `id` it becomes part of, and the side of it the påbygg lies against. */
export interface PodiumOnto {
  id: string;
  side: PodiumSide;
}

/** A drag of Disker og podier under way: `o`, the section the pen showed at the press (its frame: centred on its own
 *  origin, or for a påbygg turned as the counter with nodes on whole grid units), and each way's axis. `fine`: Shift
 *  held, or «Fin» on. */
export interface PodiumDrag {
  o: PlacedObject;
  x: PodiumAxis;
  z: PodiumAxis;
  fine: boolean;
  onto?: PodiumOnto;
}

/** A plan point in grid units of the section's frame. */
const unitsOf = (o: PlacedObject, q: Point): Point => {
  const [u, w] = toLocal(o, q);
  return [u / GRID, w / GRID];
};

/** Which edges of the section `o` a press at q takes hold of (with Shift): each way −1, 0 or 1; on a påbygg always the
 *  edge away from the counter across the side. */
export function podiumGrab(o: PlacedObject, q: Point, onto?: PodiumOnto): { x: Grab; z: Grab } {
  const s = o.sections![0];
  const [u, w] = unitsOf(o, q);
  const g = { x: grabOf(s.x[0] / GRID, s.x[1] / GRID, u), z: grabOf(s.z[0] / GRID, s.z[1] / GRID, w) };
  return onto ? { ...g, [onto.side.axis]: onto.side.out } : g;
}

/** A drag pressed at q on the section `o` the pen shows. Without Shift a press is always in the middle (the section
 *  stands round the pointer); with Shift it takes the edge it is by. On a påbygg the edge against the counter stays. */
export function startDrag(o: PlacedObject, q: Point, fine: boolean, onto?: PodiumOnto): PodiumDrag {
  const s = o.sections![0];
  const [u, w] = unitsOf(o, q);
  const g = fine ? podiumGrab(o, q, onto) : { x: 0 as Grab, z: 0 as Grab };
  const fix = (a: 'x' | 'z') => (onto?.side.axis === a ? { fix: (-onto.side.out) as -1 | 1 } : {});
  const x: PodiumAxis = { lo: s.x[0] / GRID, hi: s.x[1] / GRID, v0: u, g: g.x, ...fix('x') };
  const z: PodiumAxis = { lo: s.z[0] / GRID, hi: s.z[1] / GRID, v0: w, g: g.z, ...fix('z') };
  return { o, fine, x, z, ...(onto && { onto }) };
}

/** The spans a drag gives with the pointer at q, grid units. */
export function dragSpans(d: PodiumDrag, q: Point): { x: [number, number]; z: [number, number] } {
  const [u, w] = unitsOf(d.o, q);
  return { x: axisSpan(d.x, u, d.fine), z: axisSpan(d.z, w, d.fine) };
}

/** Shift pressed or let go during a drag, the pointer at q: what is drawn now is where it goes on from, measured from q,
 *  with Shift the edge nearest the pointer taken hold of. The key alone never changes the size. */
export function rebaseDrag(d: PodiumDrag, q: Point, fine: boolean): PodiumDrag {
  const span = dragSpans(d, q);
  const [u, w] = unitsOf(d.o, q);
  const axis = ([lo, hi]: [number, number], v: number, a: PodiumAxis): PodiumAxis => {
    const g: Grab = !fine ? 0 : a.fix ? (-a.fix as Grab) : Math.abs(v - lo) < Math.abs(v - hi) ? -1 : 1;
    return { lo, hi, v0: v, g, ...(a.fix && { fix: a.fix }) };
  };
  return { ...d, fine, x: axis(span.x, u, d.x), z: axis(span.z, w, d.z) };
}

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

/** The counter with its sections centred on its own origin, (x, y) moved to match, turned as it is; sides that are no
 *  longer outside lose their choice (K16). */
export function centred(o: PlacedObject, sections: CounterSection[]): PlacedObject {
  const b = bounds(sections);
  const cx = (b.x[0] + b.x[1]) / 2;
  const cz = (b.z[0] + b.z[1]) / 2;
  const t = (n: number) => snap(n) + 0;
  const moved = prunedSides(sections).map((s): CounterSection => ({ ...s, x: [t(s.x[0] - cx), t(s.x[1] - cx)], z: [t(s.z[0] - cz), t(s.z[1] - cz)] }));
  const [x, y] = toPlan(o, [cx, cz]);
  return { ...o, x: snap(x), y: snap(y), sections: moved };
}

/**
 * What the pen stores or a drag draws (K10): stored as `v`, the counter `o` (with a påbygg, the whole counter after),
 * or refused with the reason. `cell`: what is added, in the frame a drag goes on in (a free counter is all of it);
 * `onto`: the counter and side a påbygg lies against (PR 3).
 */
export type PodiumDraw = ({ v: Variant; id: string } | { error: string }) & { o: PlacedObject; cell: PlacedObject; onto?: PodiumOnto };

/** Whether a counter of Disker og podier has room where it stands (K10): inside the stand, clear of everything but
 *  itself (an earlier version of it, by id). */
export function hasRoom(v: Variant, ctx: PlaceContext, o: PlacedObject): boolean {
  const f = objectFootprint(ctx, o);
  if (!f) return false;
  const b = footprintBox(o, f);
  const inside = b.x0 > -EPS && b.y0 > -EPS && b.x1 < v.stand.width + EPS && b.y1 < v.stand.depth + EPS;
  return inside && !hitsAny(objectBoxes(ctx, o), blockers(v, ctx, o.id));
}

/** No room for the counter here (K10). */
export const NO_ROOM = 'Ikke plass til disken her';

/** Stored where it stands, or refused where it has no room (K10); with `onto`, in place of the counter it builds on. */
function placed(v: Variant, ctx: PlaceContext, o: PlacedObject, cell: PlacedObject, onto?: PodiumOnto): PodiumDraw {
  const at = { o, cell, ...(onto && { onto }) };
  if (!hasRoom(v, ctx, o)) return { error: NO_ROOM, ...at };
  const objects = onto ? v.objects.map((x) => (x.id === o.id ? o : x)) : [...v.objects, o];
  return { v: { ...v, objects }, id: o.id, ...at };
}

/** A straight run of a counter's outline (PR 3), in its own frame, mm: across `axis` at the node line `at`, facing
 *  `out`, from `a` to `b` along. */
export type PodiumSide = EdgeRun & { out: -1 | 1 };

/** The sides of a counter's outline: every edge of a section with no section outside it, joined where they run on. */
export const podiumSides = (sections: readonly CounterSection[]): PodiumSide[] => edgeRuns(sections, [-1, 1], ([x, z]) => !covered(sections, x, z));

/** How near a side (mm, from its outer face) the pen lies against it (PR 3). */
export const ONTO = 300;

/** The section a counter's grid lines run through: nodes on whole grid units from here. */
const originOf = (c: PlacedObject): Point => [c.sections![0].x[0], c.sections![0].z[0]];

/**
 * What the pen shows by a counter of its own at q (PR 3): one section of START × START against the nearest side within
 * ONTO of it, in the counter's grid, slid along in `step`s from the side's end and at most GRID past either end; it takes
 * the height of the section it lies against. Null when q is by no side.
 */
function ontoAt(v: Variant, q: Point, step: number): { c: PlacedObject; side: PodiumSide; cell: CounterSection } | null {
  let best: { c: PlacedObject; side: PodiumSide; d: number; t: number } | null = null;
  for (const c of v.objects) {
    if (!c.sections?.length) continue;
    const [u, w] = toLocal(c, q);
    for (const side of podiumSides(c.sections)) {
      const [across, t] = side.axis === 'x' ? [u, w] : [w, u];
      const d = (across - side.at) * side.out - R.face;
      if (d <= 0 || d > ONTO || t < side.a - GRID || t > side.b + GRID) continue;
      if (!best || d < best.d) best = { c, side, d, t };
    }
  }
  if (!best) return null;
  const { c, side, t } = best;
  const a0 = Math.min(Math.max(side.a + Math.round((t - START / 2 - side.a) / step) * step, side.a - GRID), side.b - GRID);
  const along: [number, number] = [a0, a0 + START];
  const off: [number, number] = side.out > 0 ? [side.at, side.at + START] : [side.at - START, side.at];
  const h = against(c.sections!, side, along);
  return { c, side, cell: side.axis === 'x' ? { x: off, z: along, h } : { x: along, z: off, h } };
}

/** The height of the section a påbygg from `along` lies against on `side` (the one it shares most with). */
function against(sections: readonly CounterSection[], side: PodiumSide, along: Range): number {
  let h = HEIGHT;
  let most = 0;
  for (const s of sections) {
    const [edge, run] = side.axis === 'x' ? [s.x, s.z] : [s.z, s.x];
    if (Math.abs((side.out > 0 ? edge[1] : edge[0]) - side.at) > EPS) continue;
    const shared = Math.min(run[1], along[1]) - Math.max(run[0], along[0]);
    if (shared > most) [most, h] = [shared, s.h];
  }
  return h;
}

/** A section in the counter's frame as one in the frame a påbygg's drag goes on in (`cell`, nodes on whole units). */
function cellOf(c: PlacedObject, s: CounterSection): PlacedObject {
  const [ox, oz] = originOf(c);
  const [x, y] = toPlan(c, [ox, oz]);
  return { ...c, x, y, sections: [{ x: [s.x[0] - ox, s.x[1] - ox], z: [s.z[0] - oz, s.z[1] - oz], h: s.h }] };
}

/** `added`, in the counter's frame, stored as part of counter `c` (PR 3): refused over itself, loose, or with no room. */
function addOnto(v: Variant, ctx: PlaceContext, c: PlacedObject, added: CounterSection[], cell: PlacedObject, onto: PodiumOnto): PodiumDraw {
  const at = { o: c, cell, onto };
  const { side } = onto;
  if (overlaps(added, c.sections!)) return { error: 'Disken kan ikke gå over seg selv', ...at };
  const run = (s: CounterSection) => (side.axis === 'x' ? s.z : s.x);
  const shared = Math.max(...added.map((s) => Math.min(run(s)[1], side.b) - Math.max(run(s)[0], side.a)));
  if (shared < GRID - EPS) return { error: 'En del ville stått løst', ...at };
  return placed(v, ctx, centred(c, [...c.sections!, ...added]), cell, onto);
}

/** What the pen shows and a click at q stores: one section of START × START round q, kept inside the stand and moved in
 *  against a wall, counter or the stand edge within 10 cm (K10). Refused where it has no room. */
export function podiumAt(v: Variant, ctx: PlaceContext, pen: { product: string; ral?: string; h?: number }, q: Point, fine = false): PodiumDraw {
  const by = ontoAt(v, q, fine ? GRID : START);
  if (by) {
    const { c, side, cell } = by;
    return addOnto(v, ctx, c, [cell], cellOf(c, cell), { id: c.id, side });
  }
  const id = nextId(v.objects.map((o) => o.id), 'i');
  const colour = pen.ral && pen.ral !== COUNTER_STOCK_RAL ? { ral: pen.ral } : {};
  const half = START / 2;
  const o: PlacedObject = { id, product: pen.product, x: q[0], y: q[1], rot: 0, ...colour, sections: [{ x: [-half, half], z: [-half, half], h: pen.h ?? HEIGHT }] };
  const w = (half + R.face) / 1000;
  const clamp = (n: number, hi: number) => Math.min(Math.max(n, w), hi - w);
  const kept = { ...o, x: clamp(o.x, v.stand.width), y: clamp(o.y, v.stand.depth) };
  const f = objectFootprint(ctx, kept);
  if (!f) return { error: 'Ukjent disk', o, cell: o };
  const s = snapShift(v, footprintBox(kept, f), blockers(v, ctx, id));
  const at = { ...kept, x: snap(kept.x + s.x), y: snap(kept.y + s.y) };
  return placed(v, ctx, at, at);
}

/**
 * The counter a drag draws (K10), from `d.o`, the section the pen showed at the press, with the pointer at q (axisSpan
 * each way; both ways make a rectangle). Split in sections with the rest farthest from the edge that stayed.
 */
export function drawPodium(v: Variant, ctx: PlaceContext, d: PodiumDrag, q: Point): PodiumDraw {
  const s = d.o.sections?.[0];
  if (!s) return { error: 'Ukjent disk', o: d.o, cell: d.o };
  const span = dragSpans(d, q);
  const mm = ([a, b]: [number, number]): [number, number] => [a * GRID, b * GRID];
  const from = { x: span.x[0] === d.x.lo ? ('lo' as const) : ('hi' as const), z: span.z[0] === d.z.lo ? ('lo' as const) : ('hi' as const) };
  const drawn = rectSections(mm(span.x), mm(span.z), from, s.h);
  if (!d.onto) {
    const o = centred(d.o, drawn);
    return placed(v, ctx, o, o);
  }
  const c = v.objects.find((x) => x.id === d.onto!.id);
  if (!c?.sections) return { error: 'Ukjent disk', o: d.o, cell: d.o };
  const cell = { ...d.o, sections: drawn };
  const [ox, oz] = originOf(c);
  const added = drawn.map((t): CounterSection => ({ x: [t.x[0] + ox, t.x[1] + ox], z: [t.z[0] + oz, t.z[1] + oz], h: t.h }));
  return addOnto(v, ctx, c, added, cell, d.onto);
}


/** The outer heights of a counter of Disker og podier, mm, low to high (K12: CC + 40). */
export const podiumHeights = (o: Pick<PlacedObject, 'sections'>): number[] => [...new Set((o.sections ?? []).map((s) => s.h + R.railHeight))].sort((a, b) => a - b);

/** Outer size of a counter of Disker og podier, mm: length × depth × height (K10, K12). */
export function podiumSize(o: Pick<PlacedObject, 'sections'>): { length: number; depth: number; height: number } {
  const b = counterBuildOf(o);
  return { length: b.length, depth: b.depth, height: Math.max(...b.profiles.map((p) => p.box.y[1])) };
}

/** The sketch with the sections `which` (by index) of counter `id` at CC `h`, one of HEIGHTS (Byggeregel K18); the step
 *  between two heights is built by K12. */
export function setSectionHeight(v: Variant, id: string, which: readonly number[], h: number): Variant {
  const o = v.objects.find((x) => x.id === id);
  if (!o?.sections || !(HEIGHTS as readonly number[]).includes(h)) return v;
  const pick = new Set(which);
  if (!o.sections.some((s, i) => pick.has(i) && s.h !== h)) return v;
  const sections = o.sections.map((s, i) => (pick.has(i) ? { ...s, h } : s));
  return { ...v, objects: v.objects.map((x) => (x.id === id ? { ...x, sections } : x)) };
}
