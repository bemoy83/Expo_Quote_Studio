// Byggeregel X13: one textile wall, moved on and off a system wall (Bjørn 20.11.2026: «en frittstående vegg skal kunne
// flyttes til en vegg og bli veggmontert og motsatt»). The frame is the same product either way (X1): mounted is a
// coupling, not another product (Bjørn 21.11.2026), and «Løsne» takes it off as it takes walls apart. Dragged parallel
// to a system wall within the magnet (M4, 300 mm), a free-standing textile wall is caught and mounted on the face it
// stands by, as a stroke along the wall would be (brush.ts); dragged out past the magnet, or loosened, a mounted one
// stands free on foot plates. The face that looks out keeps its print, white or the customer's own textile and its motif; the face
// toward the wall is kept and comes back when it is taken off again. Pure.
import type { Rules } from '../../rules/rules';
import { faceAt, faceNormal, sideOf, type FaceSide } from '../faces';
import { moduleCount, moduleStart, pointAlong, wallDirection, wallLength } from '../grid';
import { groupOf, groupSize, MAGNET } from '../joints';
import type { FreeTextile, Point, TextileFace, TextileWall, Variant, Wall } from '../types';
import { addFreeTextile, blocked, removeFreeTextile, runNormal, textileStep, wallClearance, type FaceKey } from './free';
import { addTextileSpan, freeSpans, fullTextileHeight } from './inFrame';
import { MOUNT_OFFSET, freeTextiles, mountedOn, wallTextiles, withOnWall } from './mounts';
import { cornerEnds, same } from './corners';

const EPS = 1e-6;

type Seg = Pick<FreeTextile, 'from' | 'to'>;

/** The face of a run that looks out to face `s` of the wall. */
function outward(t: Seg, w: Wall, s: FaceSide): FaceKey {
  const n = faceNormal(w, s);
  const a = runNormal(t, 'a');
  return a[0] * n[0] + a[1] * n[1] >= 0 ? 'a' : 'b';
}

const other = (k: FaceKey): FaceKey => (k === 'a' ? 'b' : 'a');
const hasFace = (f?: TextileFace): f is TextileFace => !!f && Object.keys(f).length > 0;

/**
 * The system wall a run lies parallel to within `reach` across (on its line when 0), overlapping along: the nearest,
 * then the most overlap; with the stretch t0–t1 along it and the signed distance out to its left normal.
 */
function wallNear(v: Variant, run: Seg, reach: number): { wall: Wall; t0: number; t1: number; off: number } | null {
  let best: { wall: Wall; t0: number; t1: number; off: number } | null = null;
  for (const w of v.walls) {
    const [dx, dy] = wallDirection(w);
    const across = (p: Point) => (p[0] - w.from[0]) * -dy + (p[1] - w.from[1]) * dx;
    const off = across(run.from);
    if (Math.abs(off - across(run.to)) > EPS || Math.abs(off) > reach + EPS) continue;
    const along = (p: Point) => (p[0] - w.from[0]) * dx + (p[1] - w.from[1]) * dy;
    const t0 = Math.max(0, Math.min(along(run.from), along(run.to)));
    const t1 = Math.min(wallLength(w), Math.max(along(run.from), along(run.to)));
    if (t1 - t0 <= EPS) continue;
    const better = !best || Math.abs(off) < Math.abs(best.off) - EPS || (Math.abs(Math.abs(off) - Math.abs(best.off)) <= EPS && t1 - t0 > best.t1 - best.t0);
    if (better) best = { wall: w, t0, t1, off };
  }
  return best;
}

/**
 * Byggeregel X13: the free-standing textile wall `id` dragged by (dx, dy) on the textile grid to lie parallel to a
 * system wall within the magnet (M4, 300 mm): caught and mounted on that wall, on the face it stands by (the face it
 * came from when it lands on the line), over the free span it covers most. `loose` («Løsne» or Alt, M5) moves it alone
 * and past the magnet: then only a drag right onto the wall's line mounts it, as that is the only way it can stand
 * there. Null when no wall catches it (then it moves as M2 says), or when it is in a 92LTX corner (unless `loose`).
 */
export function mountDrag(v: Variant, rules: Rules, id: string, dx: number, dy: number, loose = false): { v: Variant; id: string } | { error: string } | null {
  const t = freeTextiles(v).find((x) => x.id === id);
  if (!t) return null;
  if (!loose && groupSize(groupOf(v, { kind: 'textile', id })) > 1) return null;
  const [ox, oy] = [textileStep(rules, dx), textileStep(rules, dy)];
  const run: Seg = { from: [t.from[0] + ox, t.from[1] + oy], to: [t.to[0] + ox, t.to[1] + oy] };
  const near = wallNear(v, run, loose ? 0 : MAGNET);
  if (!near) return null;
  const w = near.wall;
  // The face it stands by; on the line, the one it came from
  const [ux, uy] = wallDirection(w);
  const mid = Math.abs(near.off) > EPS ? { x: w.from[0] - uy * near.off, y: w.from[1] + ux * near.off } : { x: (t.from[0] + t.to[0]) / 2, y: (t.from[1] + t.to[1]) / 2 };
  return mountFree(v, rules, id, w, faceAt(v, w, mid), near.t0, near.t1);
}

/** The free-standing textile wall `id` mounted on face `s` of wall `w` over t0–t1, its faces kept (X13). */
export function mountFree(v: Variant, rules: Rules, id: string, w: Wall, s: FaceSide, t0: number, t1: number): { v: Variant; id: string } | { error: string } {
  const t = freeTextiles(v).find((x) => x.id === id);
  if (!t) return { error: 'Tekstilveggen finnes ikke' };
  const r = addTextileSpan(removeFreeTextile(v, id), rules, w.id, s, t0, t1);
  if ('error' in r) return r;
  const key = outward(t, w, s);
  const out = t[key];
  const back = t[other(key)];
  const m: TextileWall = { ...wallTextiles(r.v).find((x) => x.id === r.id)!, id };
  if (out?.fill) m.fill = out.fill;
  if (out?.motif) m.motif = out.motif;
  if (hasFace(back)) m.back = back;
  return { v: withOnWall(r.v, wallTextiles(r.v).map((x) => (x.id === r.id ? m : x))), id };
}

/**
 * Byggeregel X13: the mounted textile wall `id` taken off its wall and moved by (dx, dy) on the textile grid, standing
 * free on foot plates where it is let go, the same length. It must come out past the magnet (M4, 300 mm) on its own
 * face; closer, the magnet holds it on the wall. `heightKept` is false when it had a height or a place up the wall a
 * free-standing one cannot have yet (2540 from the floor, X5). Null when it does not come out that far.
 */
export function unmountDrag(v: Variant, rules: Rules, id: string, dx: number, dy: number): Unmounted | { error: string } | null {
  const t = wallTextiles(v).find((x) => x.id === id);
  const w = t && v.walls.find((x) => x.id === t.wallId);
  if (!t || !w) return null;
  const n = faceNormal(w, sideOf(v, t));
  const [ox, oy] = [textileStep(rules, dx), textileStep(rules, dy)];
  if (ox * n[0] + oy * n[1] <= MAGNET + EPS) return null;
  return cornerGroup(v, id).length > 1 ? groupOff(v, rules, id, ox, oy) : takeOff(v, rules, id, ox, oy);
}

/** The textile walls joined to `id` through 92LTX corners, mounted or not, `id` first (X7). */
function cornerGroup(v: Variant, id: string): string[] {
  const corners = cornerEnds(v);
  const out = [id];
  for (let i = 0; i < out.length; i++) {
    const t = v.textiles.find((x) => x.id === out[i])!;
    const ends = [t.from, t.to].filter((_, k) => corners.get(t.id)?.[k ? 'to' : 'from']);
    for (const o of v.textiles) if (!out.includes(o.id) && ends.some((p) => same(o.from, p) || same(o.to, p))) out.push(o.id);
  }
  return out;
}

/**
 * Byggeregler X13, M4: a frame on a wall in a 92LTX corner dragged out past the magnet takes the textile walls it is
 * joined to with it, the corners kept: each moves (ox, oy) and stands where it lands, free on foot plates or still
 * along a wall (read from where it stands). A frame that comes off spans what it did on the wall, its free ends to the
 * posts its span ended at. Free-standing ones are 2540 from the floor for now (X5).
 */
function groupOff(v: Variant, rules: Rules, id: string, ox: number, oy: number): Unmounted | { error: string } {
  const ids = cornerGroup(v, id);
  const corners = cornerEnds(v);
  const views = new Map(wallTextiles(v).map((t) => [t.id, t]));
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  let heightKept = true;
  const moved = ids.map((tid): FreeTextile => {
    const t = v.textiles.find((x) => x.id === tid)!;
    const m = mountedOn(v, tid);
    const view = views.get(tid);
    let { from, to } = t;
    if (m && view) {
      // A free end out to where its span ended, on the frame's centre line
      const [ux, uy] = wallDirection(m.wall);
      const along = (p: Point) => (p[0] - m.wall.from[0]) * ux + (p[1] - m.wall.from[1]) * uy;
      const out = (p: Point) => (along(p) < (along(t.from) + along(t.to)) / 2 ? view.from : view.from + view.width);
      const n = faceNormal(m.wall, m.side);
      const line = (u: number): Point => [m.wall.from[0] + ux * u + n[0] * MOUNT_OFFSET, m.wall.from[1] + uy * u + n[1] * MOUNT_OFFSET];
      if (!corners.get(tid)?.from) from = line(out(t.from));
      if (!corners.get(tid)?.to) to = line(out(t.to));
    }
    if (t.bottom || (t.height !== undefined && Math.abs(t.height - fullTextileHeight(rules)) > EPS)) heightKept = false;
    const { fit: _f, height: _h, bottom: _b, ...rest } = t;
    const shift = (p: Point): Point => [r3(p[0] + ox), r3(p[1] + oy)];
    return { ...rest, from: shift(from), to: shift(to) };
  });
  const next: Variant = { ...v, textiles: [...v.textiles.filter((t) => !ids.includes(t.id)), ...moved] };
  // Each one that stands free must have room (F1, F2)
  for (const t of freeTextiles(next).filter((x) => ids.includes(x.id))) {
    const why = blocked(next, rules, t, freeTextiles(next).filter((x) => x.id !== t.id && !ids.includes(x.id)));
    if (why) return { error: why };
  }
  return { v: next, id, heightKept };
}

/**
 * Byggeregler X13, F2: «Løsne» on a mounted textile wall: it comes off the wall and stands free on foot plates right in
 * front of it, as close as its plates let it (clear of the wall's adjustable feet), the same length, its faces kept.
 */
export function loosenMounted(v: Variant, rules: Rules, id: string): Unmounted | { error: string } {
  const t = wallTextiles(v).find((x) => x.id === id);
  const w = t && v.walls.find((x) => x.id === t.wallId);
  if (!t || !w) return { error: 'Tekstilveggen finnes ikke' };
  const n = faceNormal(w, sideOf(v, t));
  const out = wallClearance({ from: pointAlong(w, t.from), to: pointAlong(w, t.from + t.width) });
  return takeOff(v, rules, id, n[0] * out, n[1] * out);
}

/** Said when a textile wall taken off its wall had a height or place up the wall that foot plates cannot have yet (X5, X13). */
export const onFeetHeight = (rules: Rules) =>
  `Tekstilveggen står nå på fotplater i full høyde, ${Math.round(fullTextileHeight(rules) * 1000)}: andre høyder på fotplater kommer senere`;

export interface Unmounted {
  v: Variant;
  id: string;
  heightKept: boolean;
}

/** The mounted textile wall `id` taken off and stood free on foot plates moved (ox, oy) from its place on the wall. */
function takeOff(v: Variant, rules: Rules, id: string, ox: number, oy: number): Unmounted | { error: string } {
  const t = wallTextiles(v).find((x) => x.id === id)!;
  const w = v.walls.find((x) => x.id === t.wallId)!;
  const s = sideOf(v, t);
  const shift = (p: Point): Point => [Math.round((p[0] + ox) * 1000) / 1000, Math.round((p[1] + oy) * 1000) / 1000];
  const a = shift(pointAlong(w, t.from));
  const b = shift(pointAlong(w, t.from + t.width));
  const r = addFreeTextile({ ...v, textiles: v.textiles.filter((x) => x.id !== id) }, rules, a, b);
  if ('error' in r) return r;
  // A new run keeps the id and place it had on the wall; one that joined a standing run in line is part of it (X13)
  const fresh = !v.textiles.some((x) => x.id === r.id);
  // The run goes the wall's way, so face s of the wall is its face A when s = 1
  const run = freeTextiles(r.v).find((x) => x.id === r.id)!;
  const key = outward(run, w, s);
  const out: TextileFace = { ...(t.fill && t.fill !== 'print' ? { fill: t.fill } : {}), ...(t.motif ? { motif: t.motif } : {}) };
  const placed: FreeTextile = { ...run, ...(fresh ? { id } : {}) };
  delete placed.a;
  delete placed.b;
  if (hasFace(out)) placed[key] = out;
  if (hasFace(t.back)) placed[other(key)] = t.back;
  const heightKept = !t.bottom && (t.height === undefined || Math.abs(t.height - fullTextileHeight(rules)) < EPS);
  const textiles = fresh ? v.textiles.map((x) => (x.id === id ? placed : x)) : r.v.textiles.map((x) => (x.id === r.id ? placed : x));
  return { v: { ...r.v, textiles }, id: placed.id, heightKept };
}

/**
 * Byggeregler X13, M4: a group of free-standing textile walls joined at 92LTX corners (no inner walls in it), dragged by
 * (dx, dy) on the textile grid so that a run lies parallel to a system wall within the magnet: the magnet takes the
 * whole group across onto that wall's face, and each run that then stands along a wall is mounted there; into a corner
 * of system walls both arms are. A mounted run spans what it covers on its wall, its free ends on the nearest module
 * post, an end in a corner on the other run's line, so the 92LTX stays (X7); runs that stand out into the stand keep
 * their length and meet the frame at its end (joinFreeToFrames). Null when no wall catches it, or it is not such a
 * group; then it moves as M2 says. The error says why when the walls it would go on have no room for it.
 */
export function groupMountDrag(v: Variant, rules: Rules, id: string, dx: number, dy: number): { v: Variant; id: string } | { error: string } | null {
  const g = groupOf(v, { kind: 'textile', id });
  if (g.walls.length || g.textiles.length < 2) return null;
  const runs = freeTextiles(v).filter((t) => g.textiles.includes(t.id));
  const [ox, oy] = [textileStep(rules, dx), textileStep(rules, dy)];
  let moved: FreeTextile[] = runs.map((t) => ({ ...t, from: [t.from[0] + ox, t.from[1] + oy], to: [t.to[0] + ox, t.to[1] + oy] }));
  // Across onto a wall face: the nearest catch for runs along x, and on its own for runs along y
  let caught = false;
  for (const h of [true, false]) {
    let best: { shift: number; off: number } | null = null;
    for (const t of moved) {
      if ((Math.abs(t.from[1] - t.to[1]) < EPS) !== h) continue;
      const near = wallNear(v, t, MAGNET);
      if (!near) continue;
      const [ux, uy] = wallDirection(near.wall);
      // On the line: the face it came from
      const was = runs.find((r) => r.id === t.id)!;
      const side = Math.abs(near.off) > EPS ? Math.sign(near.off) : Math.sign((was.from[0] - near.wall.from[0]) * -uy + (was.from[1] - near.wall.from[1]) * ux) || 1;
      const shift = side * MOUNT_OFFSET - near.off;
      if (!best || Math.abs(near.off) < Math.abs(best.off)) best = { shift: shift * (h ? ux : -uy), off: near.off };
    }
    if (!best) continue;
    caught = true;
    // The left normal of a wall along x is (0, ux), of one along y (−uy, 0): `shift` is along that axis
    moved = moved.map((t) => (h ? { ...t, from: [t.from[0], r6(t.from[1] + best!.shift)], to: [t.to[0], r6(t.to[1] + best!.shift)] } : { ...t, from: [r6(t.from[0] + best!.shift), t.from[1]], to: [r6(t.to[0] + best!.shift), t.to[1]] }));
  }
  if (!caught) return null;
  const placed = { ...v, textiles: [...v.textiles.filter((t) => !g.textiles.includes(t.id)), ...moved] };
  const on = moved.filter((t) => mountedOn(placed, t.id));
  if (!on.length) return null;
  // Each mounted run over what it covers: an end in a corner on the other run's line, a free end on the nearest post
  const views = wallTextiles(placed).map((view) => {
    const t = on.find((x) => x.id === view.id);
    if (!t) return view;
    const w = v.walls.find((x) => x.id === view.wallId)!;
    const [ux, uy] = wallDirection(w);
    const along = (p: Point) => (p[0] - w.from[0]) * ux + (p[1] - w.from[1]) * uy;
    const posts = [...Array.from({ length: moduleCount(w) }, (_, i) => moduleStart(w, i)), wallLength(w)];
    const end = (p: Point) => {
      const partner = moved.find((o) => o.id !== t.id && (same(o.from, p) || same(o.to, p)));
      if (!partner) return posts.reduce((a, b) => (Math.abs(b - along(p)) < Math.abs(a - along(p)) ? b : a));
      // The other run's line along this wall: a wall's own line when that run goes on a wall too
      const pm = mountedOn(placed, partner.id);
      return r6(along(p) + (pm ? lineOffset(w, pm.wall, p) : 0));
    };
    const [a, b] = [end(t.from), end(t.to)];
    const { fit: _f, ...rest } = view;
    return { ...rest, from: Math.min(a, b), width: r6(Math.abs(b - a)) };
  });
  // Room on the walls for them (X4)
  for (const view of views.filter((x) => on.some((t) => t.id === x.id))) {
    const s = sideOf(placed, view);
    const others = views.filter((x) => x.id !== view.id && x.wallId === view.wallId && sideOf(placed, x) === s);
    const free = freeSpans(placed, rules, view.wallId, s, others);
    if (view.width < rules.textile.minWidth - EPS || !free.some(([a, b]) => view.from >= a - EPS && view.from + view.width <= b + EPS)) return { error: 'Ikke plass til tekstilveggene på veggen her' };
  }
  return { v: withOnWall(placed, views), id };
}

/** How far along wall w the line of wall o lies from point p, when o crosses w at a right angle. */
function lineOffset(w: Wall, o: Wall, p: Point): number {
  const [ux, uy] = wallDirection(w);
  return (o.from[0] - p[0]) * ux + (o.from[1] - p[1]) * uy;
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6 + 0;
