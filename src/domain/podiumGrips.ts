// Grep på valgt disk (Byggeregel K14, PR 4): a chosen counter of Disker og podier shows a grip in the middle of each
// straight side of its outline and one in each corner of the box round it. A grip moves its side (a corner: the two box
// sides that meet there) in 500 steps, 250 with Shift. Out, the section by the side is stretched to 1000 before a new
// one is laid; in, the sections are shrunk and taken away, and what is left joined again where two fit in one. Pure,
// sections in the counter's own frame, mm.
import { RECIPES } from '../foga/recipes';
import { toLocal, toPlan } from './counterShape';
import type { PlaceContext } from './objects';
import { centred, hasRoom, NO_ROOM, podiumSides, runNodes, SECTION_MAX, type PodiumSide } from './podiums';
import { along, bounds as box, EPS, GRID, groups, meet, overlaps, shared, withAlong, withAxis, type Axis } from './podiumSections';
import type { CounterSection, PlacedObject, Point, Variant } from './types';

const FACE = RECIPES.counter.face;
type Range = readonly [number, number];

/** A grip: a side of the outline, or a corner of the box round it (the box's x side `x` and z side `z`, −1 low, 1 high). */
export type PodiumGrip = { kind: 'side'; side: PodiumSide } | { kind: 'corner'; x: -1 | 1; z: -1 | 1 };

/** A line of the outline a grip moves: across `axis` at `at` facing `out`, along from `a` to `b` (a box side: all of it). */
type Line = Omit<PodiumSide, 'a' | 'b'> & { a: number; b: number };

const len = (r: Range) => r[1] - r[0];

/** Each grip of a counter and where it is drawn on the plan (m): on the outer face, a side's in its middle. */
export function podiumGrips(o: PlacedObject): { grip: PodiumGrip; at: Point }[] {
  const sections = o.sections ?? [];
  if (!sections.length) return [];
  const sides = podiumSides(sections).map((side) => {
    const across = side.at + side.out * FACE;
    const mid = (side.a + side.b) / 2;
    return { grip: { kind: 'side', side } as PodiumGrip, at: toPlan(o, side.axis === 'x' ? [across, mid] : [mid, across]) };
  });
  const b = box(sections);
  const corners = ([-1, 1] as const).flatMap((x) =>
    ([-1, 1] as const).map((z) => ({
      grip: { kind: 'corner', x, z } as PodiumGrip,
      at: toPlan(o, [(x < 0 ? b.x[0] : b.x[1]) + x * FACE, (z < 0 ? b.z[0] : b.z[1]) + z * FACE]),
    })),
  );
  return [...sides, ...corners];
}

/** The line a grip moves on one axis, if it moves that way. */
function linesOf(sections: readonly CounterSection[], grip: PodiumGrip): Line[] {
  if (grip.kind === 'side') return [grip.side];
  const b = box(sections);
  const line = (axis: Axis, out: -1 | 1): Line => ({ axis, out, at: out < 0 ? b[axis][0] : b[axis][1], a: -Infinity, b: Infinity });
  return [line('x', grip.x), line('z', grip.z)];
}

/** The line `l` moved out by `d` (mm, > 0): each section on it stretched to SECTION_MAX, then new sections laid on beyond,
 *  whole metres first and the rest last (K10). A section only partly on the line is not stretched. */
function moveOut(sections: readonly CounterSection[], l: Line, d: number): CounterSection[] {
  const out: CounterSection[] = [];
  const added: CounterSection[] = [];
  for (const s of sections) {
    const run = along(s, l.axis);
    const edge = l.out > 0 ? s[l.axis][1] : s[l.axis][0];
    const on: Range = [Math.max(run[0], l.a), Math.min(run[1], l.b)];
    if (Math.abs(edge - l.at) > EPS || len(on) < EPS) {
      out.push(s);
      continue;
    }
    const whole = on[0] - run[0] < EPS && run[1] - on[1] < EPS;
    const grow = whole ? Math.min(d, Math.max(0, SECTION_MAX - len(s[l.axis]))) : 0;
    const r = s[l.axis];
    out.push(grow ? withAxis(s, l.axis, l.out > 0 ? [r[0], r[1] + grow] : [r[0] - grow, r[1]]) : s);
    const rest = d - grow;
    if (rest < EPS) continue;
    const from = l.at + l.out * grow;
    const nodes = runNodes(0, rest).map((t) => from + l.out * t);
    for (let i = 1; i < nodes.length; i++) {
      const span: Range = l.out > 0 ? [nodes[i - 1], nodes[i]] : [nodes[i], nodes[i - 1]];
      added.push(withAlong(withAxis(s, l.axis, span), l.axis, on));
    }
  }
  return [...out, ...added];
}

/** The line `l` moved in by `d` (mm, > 0): everything within `d` of it, along it, taken away; a section cut there is
 *  shrunk, or split where only part of it lies along the line. `gone`: what is taken away. */
function moveIn(sections: readonly CounterSection[], l: Line, d: number): { sections: CounterSection[]; gone: CounterSection[] } {
  const cut: Range = l.out > 0 ? [l.at - d, l.at] : [l.at, l.at + d];
  const keep: CounterSection[] = [];
  const gone: CounterSection[] = [];
  for (const s of sections) {
    const run = along(s, l.axis);
    const r = s[l.axis];
    if (shared(r, cut) < EPS || shared(run, [l.a, l.b]) < EPS) {
      keep.push(s);
      continue;
    }
    // Along: the part outside the line stays whole
    const inner: Range = [Math.max(run[0], l.a), Math.min(run[1], l.b)];
    if (inner[0] - run[0] > EPS) keep.push(withAlong(s, l.axis, [run[0], inner[0]]));
    if (run[1] - inner[1] > EPS) keep.push(withAlong(s, l.axis, [inner[1], run[1]]));
    const mid = withAlong(s, l.axis, inner);
    // Across: what lies outside the cut stays
    if (cut[0] - r[0] > EPS) keep.push(withAxis(mid, l.axis, [r[0], cut[0]]));
    if (r[1] - cut[1] > EPS) keep.push(withAxis(mid, l.axis, [cut[1], r[1]]));
    gone.push(withAxis(mid, l.axis, [Math.max(r[0], cut[0]), Math.min(r[1], cut[1])]));
  }
  return { sections: keep, gone };
}

/** Two sections side by side with the same span the other way, the same height, and together no longer than
 *  SECTION_MAX, joined into one (K10: whole metres first); again until none are left. */
export function joined(sections: readonly CounterSection[]): CounterSection[] {
  const out = [...sections];
  for (let again = true; again; ) {
    again = false;
    for (let i = 0; i < out.length && !again; i++)
      for (let j = 0; j < out.length && !again; j++) {
        const [p, q] = [out[i], out[j]];
        if (i === j || p.h !== q.h) continue;
        for (const axis of ['x', 'z'] as const) {
          const other = axis === 'x' ? 'z' : 'x';
          const same = Math.abs(p[other][0] - q[other][0]) < EPS && Math.abs(p[other][1] - q[other][1]) < EPS;
          if (!same || Math.abs(p[axis][1] - q[axis][0]) > EPS || q[axis][1] - p[axis][0] > SECTION_MAX + EPS) continue;
          out.splice(j, 1);
          out[j < i ? i - 1 : i] = withAxis(p, axis, [p[axis][0], q[axis][1]]);
          again = true;
          break;
        }
      }
  }
  return out;
}

/** Whether the sections hang together along edges of at least GRID (K10). */
export const connected = (sections: readonly CounterSection[]): boolean =>
  sections.length > 0 && groups(sections, (p, q) => meet(p, q, 'x') !== null || meet(p, q, 'z') !== null).length === 1;

/** The step a grip moves in (K14): 500, 250 with Shift. */
export const gripStep = (fine: boolean) => (fine ? GRID : 2 * GRID);

/** How far (mm, + out) a grip on each line has moved with the pointer gone from p0 to q, in whole steps. */
function shifts(o: PlacedObject, lines: Line[], p0: Point, q: Point, fine: boolean): number[] {
  const [u0, w0] = toLocal(o, p0);
  const [u, w] = toLocal(o, q);
  const step = gripStep(fine);
  return lines.map((l) => Math.round((((l.axis === 'x' ? u - u0 : w - w0) * l.out) / step)) * step);
}

/** A grip of `o` dragged (K14): the counter after, and `gone`, what is taken away (in o's frame), or the reason it is
 *  refused. The size goes no smaller than one section of GRID × GRID. */
export type PodiumGripDraw = { v: Variant; o: PlacedObject; gone: PlacedObject | null } | { error: string; o: PlacedObject; gone: PlacedObject | null };

const SMALLEST = 'Minste disk er 250 × 250';

/** The sections of o with each line moved by its amount: the result, what was taken away, or why it cannot be. */
function moved(sections: readonly CounterSection[], lines: Line[], ds: number[]): { sections: CounterSection[]; gone: CounterSection[] } | { error: string; gone: CounterSection[] } {
  let now = [...sections];
  const gone: CounterSection[] = [];
  for (let i = 0; i < lines.length; i++) {
    const d = ds[i];
    if (!d) continue;
    // A box side is found again on what the other way left
    const l = lines[i];
    const at = l.a === -Infinity ? { ...l, at: box(now)[l.axis][l.out < 0 ? 0 : 1] } : l;
    if (d > 0) now = moveOut(now, at, d);
    else {
      const r = moveIn(now, at, -d);
      now = r.sections;
      gone.push(...r.gone);
    }
  }
  if (!now.length) return { error: SMALLEST, gone };
  if (overlaps(now)) return { error: 'Disken kan ikke gå over seg selv', gone };
  if (!connected(now)) return { error: 'En del ville stått løst', gone };
  return { sections: joined(now), gone };
}

/**
 * `o` with `grip` dragged from p0 to q (plan m, K14). Inward it stops at the smallest step that leaves something (one
 * section of GRID × GRID at the least).
 */
export function gripPodium(v: Variant, ctx: PlaceContext, o: PlacedObject, grip: PodiumGrip, p0: Point, q: Point, fine: boolean): PodiumGripDraw {
  const sections = o.sections ?? [];
  const lines = linesOf(sections, grip);
  const step = gripStep(fine);
  let ds = shifts(o, lines, p0, q, fine);
  let r = moved(sections, lines, ds);
  while ('error' in r && r.error === SMALLEST && ds.some((d) => d < 0)) {
    ds = ds.map((d) => (d < 0 ? d + step : d));
    r = moved(sections, lines, ds);
  }
  const gone = r.gone.length ? { ...o, sections: r.gone } : null;
  if ('error' in r) return { error: r.error, o, gone };
  const after = centred(o, r.sections);
  if (!hasRoom(v, ctx, after)) return { error: NO_ROOM, o: after, gone };
  return { v: { ...v, objects: v.objects.map((x) => (x.id === o.id ? after : x)) }, o: after, gone };
}
