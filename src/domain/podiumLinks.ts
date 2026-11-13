// Fusjon og lenker (Byggeregel K15, PR 5): a counter of Disker og podier dragged with Velg within 300 mm of another
// lies against it in its grid and, on release, the two become one (the one that stood still keeps its colour and
// place). A joint, a straight line where sections meet inside a counter, is a link: broken, the counter becomes two
// standing against each other; two counters standing against each other are linked into one. Pure, mm in a counter's
// own frame, m on the plan.
import { RECIPES } from '../foga/recipes';
import { toLocal, toPlan, turn } from './counterShape';
import { nextId } from './ids';
import type { PlaceContext } from './objects';
import { centred, hasRoom, NO_ROOM, ONTO, podiumSides, type PodiumSide } from './podiums';
import { covered, edgeRuns, EPS, GRID, groups, meet, overlaps, shared, shifted, type EdgeRun, type Range } from './podiumSections';
import type { CounterSection, PlacedObject, Point, Variant } from './types';

const FACE = RECIPES.counter.face;
/** Node lines of two counters standing against each other: face against face. */
const APART = 2 * FACE;
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
      if (overlaps(moved, c.sections!) || !hasRoom({ ...v, objects: v.objects.filter((x) => x.id !== c.id) }, ctx, at)) continue;
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
  const laid = bs.map((s) => shifted(s, side.axis, shift));
  if (overlaps(laid, a.sections!)) return { error: 'Disken kan ikke gå over seg selv' };
  const o = centred(a, [...a.sections!, ...laid]);
  const rest = { ...v, objects: v.objects.filter((x) => x.id !== b.id) };
  if (!hasRoom(rest, ctx, o)) return { error: NO_ROOM };
  return { v: { ...rest, objects: rest.objects.map((x) => (x.id === a.id ? o : x)) }, id: a.id };
}

/** A joint: a straight line inside a counter where sections meet, across `axis` at `at`, from `a` to `b` along. */
export type PodiumJoint = EdgeRun;

/** The joints of a counter: every edge between two sections, joined where they run on in a straight line. */
export const podiumJoints = (sections: readonly CounterSection[]): PodiumJoint[] =>
  edgeRuns(sections, [1], ([x, z]) => covered(sections, x, z)).map(({ axis, at, a, b }) => ({ axis, at, a, b }));

/** A joint that does not part the counter on its own (K15). */
export const NOT_ALONE = 'Skjøten deler ikke disken alene: bryt også skjøten ved siden av';

/** The groups of sections that hang together with the joint `cut` broken (edges of at least GRID, K10). */
function parts(sections: readonly CounterSection[], cut: PodiumJoint): CounterSection[][] {
  const broken = (p: CounterSection, q: CounterSection, at: number) => {
    const run: Range = cut.axis === 'x' ? [Math.max(p.z[0], q.z[0]), Math.min(p.z[1], q.z[1])] : [Math.max(p.x[0], q.x[0]), Math.min(p.x[1], q.x[1])];
    return Math.abs(at - cut.at) < EPS && shared(run, [cut.a, cut.b]) > EPS;
  };
  return groups(sections, (p, q) =>
    (['x', 'z'] as const).some((axis) => {
      const at = meet(p, q, axis);
      return at !== null && !(axis === cut.axis && broken(p, q, at));
    }),
  );
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
    const moved = g.map((s) => shifted(s, joint.axis, shift));
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
