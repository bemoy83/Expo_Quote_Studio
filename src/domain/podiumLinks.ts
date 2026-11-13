// Fusjon og lenker (Byggeregel K15, PR 5): a counter of Disker og podier dragged with Velg within 300 mm of another
// lies against it in its grid and, on release, the two become one (the one that stood still keeps its colour and
// place). A joint, a straight line where sections meet inside a counter, is a link: broken, the counter becomes two
// standing against each other; two counters standing against each other are linked into one. Pure, mm in a counter's
// own frame, m on the plan.
import { RECIPES } from '../foga/recipes';
import { toLocal, toPlan, turn } from './counterShape';
import { nextId } from './ids';
import type { PlaceContext } from './objects';
import { centred, GRID, hasRoom, NO_ROOM, ONTO, podiumSides, type PodiumSide } from './podiums';
import type { CounterSection, PlacedObject, Point, Variant } from './types';

const EPS = 1e-6;
const FACE = RECIPES.counter.face;
/** Node lines of two counters standing against each other: face against face. */
const APART = 2 * FACE;
type Range = [number, number];
type Axis = 'x' | 'z';

const shared = (p: Range, q: Range) => Math.min(p[1], q[1]) - Math.max(p[0], q[0]);
const mm = (n: number) => Math.round(n * 1000) / 1000 + 0;
const isPodium = (o: PlacedObject) => !!o.sections?.length;

/** The sections of `o` in the frame of `c`, mm. */
export function inFrame(c: PlacedObject, o: PlacedObject): CounterSection[] {
  return (o.sections ?? []).map((s) => {
    const p = toLocal(c, toPlan(o, [s.x[0], s.z[0]]));
    const q = toLocal(c, toPlan(o, [s.x[1], s.z[1]]));
    return { x: [mm(Math.min(p[0], q[0])), mm(Math.max(p[0], q[0]))], z: [mm(Math.min(p[1], q[1])), mm(Math.max(p[1], q[1]))], h: s.h };
  });
}

const overlapping = (p: readonly CounterSection[], q: readonly CounterSection[]) => p.some((s) => q.some((t) => shared(s.x, t.x) > EPS && shared(s.z, t.z) > EPS));

/** Each side of `c` with a side of `os` (in c's frame) facing it, node lines `d` apart (mm, out from c), sharing at least
 *  some length: the side of c, how far apart, and the length they share. */
function facing(cs: readonly CounterSection[], os: readonly CounterSection[]) {
  const out: { side: PodiumSide; other: PodiumSide; d: number; along: Range }[] = [];
  const theirs = podiumSides(os);
  for (const side of podiumSides(cs))
    for (const other of theirs) {
      if (other.axis !== side.axis || other.out !== -side.out) continue;
      out.push({ side, other, d: (other.at - side.at) * side.out, along: [Math.max(side.a, other.a), Math.min(side.b, other.b)] });
    }
  return out;
}

/** Where `o`, dragged, lies against another counter of Disker og podier within ONTO of it (K15): moved so the two stand
 *  face against face, its nodes in the other's grid, sharing at least GRID along. Null when it is by none. */
export function snapBeside(v: Variant, ctx: PlaceContext, o: PlacedObject): { o: PlacedObject; onto: string } | null {
  if (!isPodium(o)) return null;
  let best: { o: PlacedObject; onto: string; cost: number } | null = null;
  for (const c of v.objects) {
    if (c.id === o.id || !isPodium(c)) continue;
    const os = inFrame(c, o);
    const [gx, gz] = [c.sections![0].x[0], c.sections![0].z[0]];
    for (const { side, other, d } of facing(c.sections!, os)) {
      const gap = d - APART;
      if (gap > ONTO + EPS || gap < -GRID) continue;
      const grid = side.axis === 'x' ? gz : gx;
      const off = other.a - grid;
      const along = Math.round(off / GRID) * GRID - off;
      if (shared([other.a + along, other.b + along], [side.a, side.b]) < GRID - EPS) continue;
      const cost = Math.abs(gap) + Math.abs(along);
      if (best && cost >= best.cost) continue;
      const delta: Point = side.axis === 'x' ? [-gap * side.out, along] : [along, -gap * side.out];
      const [dx, dy] = turn(delta, c.rot);
      const at = { ...o, x: mm(o.x + dx / 1000), y: mm(o.y + dy / 1000) };
      const moved = inFrame(c, at);
      if (overlapping(moved, c.sections!) || !hasRoom({ ...v, objects: v.objects.filter((x) => x.id !== c.id) }, ctx, at)) continue;
      best = { o: at, onto: c.id, cost };
    }
  }
  return best && { o: best.o, onto: best.onto };
}

/** `b` made part of `a`, the two standing face against face (K15): b's sections laid in a's frame on a's node line, a
 *  keeping its colour and place, b gone; each section keeps its height, a step where two meet (K12). Refused with the reason, and nothing changed, where it cannot be. */
export function fusePodiums(v: Variant, ctx: PlaceContext, aId: string, bId: string): { v: Variant; id: string } | { error: string } {
  const a = v.objects.find((x) => x.id === aId);
  const b = v.objects.find((x) => x.id === bId);
  if (!a || !b || !isPodium(a) || !isPodium(b)) return { error: 'Ukjent disk' };
  const bs = inFrame(a, b);
  const pair = facing(a.sections!, bs).find((f) => Math.abs(f.d - APART) < 1 && f.along[1] - f.along[0] >= GRID - EPS);
  if (!pair) return { error: 'Diskene står ikke inntil hverandre' };
  const { side } = pair;
  const shift = -APART * side.out;
  const laid = bs.map((s): CounterSection => (side.axis === 'x' ? { ...s, x: [s.x[0] + shift, s.x[1] + shift] } : { ...s, z: [s.z[0] + shift, s.z[1] + shift] }));
  if (overlapping(laid, a.sections!)) return { error: 'Disken kan ikke gå over seg selv' };
  const o = centred(a, [...a.sections!, ...laid]);
  const rest = { ...v, objects: v.objects.filter((x) => x.id !== b.id) };
  if (!hasRoom(rest, ctx, o)) return { error: NO_ROOM };
  return { v: { ...rest, objects: rest.objects.map((x) => (x.id === a.id ? o : x)) }, id: a.id };
}

/** A joint: a straight line inside a counter where sections meet, across `axis` at `at`, from `a` to `b` along. */
export interface PodiumJoint {
  axis: Axis;
  at: number;
  a: number;
  b: number;
}

const covered = (sections: readonly CounterSection[], x: number, z: number) => sections.some((s) => x > s.x[0] && x < s.x[1] && z > s.z[0] && z < s.z[1]);

/** The joints of a counter: every edge between two sections, joined where they run on in a straight line. */
export function podiumJoints(sections: readonly CounterSection[]): PodiumJoint[] {
  const bits = new Map<string, { axis: Axis; at: number; t: number[] }>();
  for (const s of sections)
    for (const axis of ['x', 'z'] as const) {
      const at = s[axis][1];
      const run = axis === 'x' ? s.z : s.x;
      for (let t = run[0]; t < run[1] - EPS; t += GRID) {
        const mid = t + GRID / 2;
        if (!(axis === 'x' ? covered(sections, at + 1, mid) : covered(sections, mid, at + 1))) continue;
        const key = `${axis}:${at}`;
        const j = bits.get(key) ?? { axis, at, t: [] };
        j.t.push(t);
        bits.set(key, j);
      }
    }
  const out: PodiumJoint[] = [];
  for (const { axis, at, t } of bits.values()) {
    t.sort((p, q) => p - q);
    let a = t[0];
    for (let i = 1; i <= t.length; i++)
      if (i === t.length || t[i] - t[i - 1] > GRID + EPS) {
        out.push({ axis, at, a, b: t[i - 1] + GRID });
        a = t[i];
      }
  }
  return out;
}

/** A joint that does not part the counter on its own (K15). */
export const NOT_ALONE = 'Skjøten deler ikke disken alene: bryt også skjøten ved siden av';

/** The groups of sections that hang together with the joint `cut` broken (edges of at least GRID, K10). */
function parts(sections: readonly CounterSection[], cut: PodiumJoint): CounterSection[][] {
  const across = (p: CounterSection, q: CounterSection, axis: Axis) => {
    const other = axis === 'x' ? 'z' : 'x';
    const at = Math.abs(p[axis][1] - q[axis][0]) < EPS ? p[axis][1] : Math.abs(q[axis][1] - p[axis][0]) < EPS ? p[axis][0] : null;
    if (at === null || shared(p[other], q[other]) < GRID - EPS) return false;
    const broken = cut.axis === axis && Math.abs(at - cut.at) < EPS && shared([Math.max(p[other][0], q[other][0]), Math.min(p[other][1], q[other][1])], [cut.a, cut.b]) > EPS;
    return !broken;
  };
  const seen = new Set<number>();
  const out: CounterSection[][] = [];
  for (let k = 0; k < sections.length; k++) {
    if (seen.has(k)) continue;
    const group = [k];
    seen.add(k);
    for (let i = 0; i < group.length; i++)
      sections.forEach((s, j) => {
        if (!seen.has(j) && (across(sections[group[i]], s, 'x') || across(sections[group[i]], s, 'z'))) {
          seen.add(j);
          group.push(j);
        }
      });
    out.push(group.map((i) => sections[i]));
  }
  return out;
}

/** `o` parted at the joint (K15): the biggest part stays where it is, with o's id; each other part becomes a counter of
 *  its own, moved off the joint so the two stand face against face. Refused when the joint does not part it alone. */
export function breakJoint(v: Variant, ctx: PlaceContext, id: string, joint: PodiumJoint): { v: Variant; ids: string[] } | { error: string } {
  const o = v.objects.find((x) => x.id === id);
  if (!o?.sections) return { error: 'Ukjent disk' };
  const groups = parts(o.sections, joint);
  if (groups.length < 2) return { error: NOT_ALONE };
  const area = (g: CounterSection[]) => g.reduce((n, s) => n + (s.x[1] - s.x[0]) * (s.z[1] - s.z[0]), 0);
  groups.sort((p, q) => area(q) - area(p));
  const [keep, ...rest] = groups;
  const ids: string[] = [o.id];
  let objects = v.objects.map((x) => (x.id === o.id ? centred(o, keep) : x));
  for (const g of rest) {
    // Away from the joint, on the side the part lies
    const side = g.reduce((n, s) => n + Math.sign((s[joint.axis][0] + s[joint.axis][1]) / 2 - joint.at) * area([s]), 0) >= 0 ? 1 : -1;
    const shift = side * APART;
    const moved = g.map((s): CounterSection => (joint.axis === 'x' ? { ...s, x: [s.x[0] + shift, s.x[1] + shift] } : { ...s, z: [s.z[0] + shift, s.z[1] + shift] }));
    const nid = nextId(objects.map((x) => x.id), 'i');
    objects = [...objects, centred({ ...o, id: nid }, moved)];
    ids.push(nid);
  }
  const after = { ...v, objects };
  for (const x of ids) if (!hasRoom(after, ctx, objects.find((y) => y.id === x)!)) return { error: NO_ROOM };
  return { v: after, ids };
}

/** A link on the plan (K15): a joint of the chosen counter, a click breaks it; or a counter standing against it, a click
 *  links the two. `at`: where its icon is drawn, m. */
export type PodiumLink = { kind: 'joint'; joint: PodiumJoint; at: Point } | { kind: 'neighbour'; id: string; at: Point };

/** The links of a counter of Disker og podier: its joints, and the counters standing face against face with it. */
export function podiumLinks(v: Variant, o: PlacedObject): PodiumLink[] {
  if (!isPodium(o)) return [];
  const joints = podiumJoints(o.sections!).map((joint): PodiumLink => {
    const mid = (joint.a + joint.b) / 2;
    return { kind: 'joint', joint, at: toPlan(o, joint.axis === 'x' ? [joint.at, mid] : [mid, joint.at]) };
  });
  const near: PodiumLink[] = [];
  for (const n of v.objects) {
    if (n.id === o.id || !isPodium(n)) continue;
    for (const { side, d, along } of facing(o.sections!, inFrame(o, n))) {
      if (Math.abs(d - APART) > 1 || along[1] - along[0] < GRID - EPS) continue;
      const mid = (along[0] + along[1]) / 2;
      const across = side.at + side.out * FACE;
      near.push({ kind: 'neighbour', id: n.id, at: toPlan(o, side.axis === 'x' ? [across, mid] : [mid, across]) });
    }
  }
  return [...joints, ...near];
}
