// Støtteplater: foot plates under a system wall that stands free, by the shared support rule (calc/supports.ts) on
// the wall's posts. The rules are byggeregler S1–S3, S5–S7, T15 (docs/byggeregler.md); a long stand wall is held by a
// støttedrager instead (calc/beams/supportBeams.ts).
import { pointKey } from '../domain/grid';
import type { Point } from '../domain/types';
import type { BuiltModule } from '../domain/walls';
import type { SupportRule } from '../foga/recipes';
import { onSegment, type BeamLayout } from './beams/beamSegments';
import { minSupports, spreadSupports, type Ends } from './supports';

export interface WallSupport {
  /** The post it stands under. */
  at: Point;
  /** Direction of the wall it holds: the plate lies across it. */
  orientation: 'h' | 'v';
}

/** A straight run of wall modules, post by post from its low end. */
export interface Run {
  orientation: 'h' | 'v';
  points: Point[];
  /** Metres from the first post to each post: modules are not all 1000 (Byggeregel V1, V10, D8). */
  at: number[];
  mods: BuiltModule[];
}

/** Maximal straight runs of touching modules. */
export function wallRuns(mods: readonly BuiltModule[]): Run[] {
  const lines = new Map<string, { at: number; end: number; m: BuiltModule }[]>();
  for (const m of mods) {
    const h = m.orientation === 'h';
    const line = `${m.orientation}:${h ? m.a[1] : m.a[0]}`;
    const at = Math.min(h ? m.a[0] : m.a[1], h ? m.b[0] : m.b[1]);
    const end = Math.max(h ? m.a[0] : m.a[1], h ? m.b[0] : m.b[1]);
    lines.set(line, [...(lines.get(line) ?? []), { at, end, m }]);
  }
  const runs: Run[] = [];
  for (const list of lines.values()) {
    list.sort((a, b) => a.at - b.at);
    let cur: { at: number; end: number; m: BuiltModule }[] = [];
    const flush = () => {
      if (!cur.length) return;
      const o = cur[0].m.orientation;
      const lo = (m: BuiltModule) => (o === 'h' ? (m.a[0] < m.b[0] ? m.a : m.b) : m.a[1] < m.b[1] ? m.a : m.b);
      const hi = (m: BuiltModule) => (lo(m) === m.a ? m.b : m.a);
      const at = [...cur.map((c) => c.at), cur[cur.length - 1].end].map((x) => Math.round((x - cur[0].at) * 1000) / 1000);
      runs.push({ orientation: o, mods: cur.map((c) => c.m), points: [...cur.map((c) => lo(c.m)), hi(cur[cur.length - 1].m)], at });
      cur = [];
    };
    for (const e of list) {
      // A module goes on the run where the one before it ends, whatever its length
      if (cur.length && Math.abs(e.at - cur[cur.length - 1].end) > 1e-6) flush();
      cur.push(e);
    }
    flush();
  }
  return runs;
}

/** A takdrager rests on the point: a post it needs, or a wall post its length passes over. */
const underBeam = (beams: BeamLayout) => (p: Point) => beams.posts.has(pointKey(p)) || beams.segments.some((s) => onSegment(s, p));

/**
 * What holds a wall run at each of its posts: another system wall meeting it there (corner, T or cross), or a takdrager
 * resting on it. Shared by the foot plates and the støttedrager (calc/beams/supportBeams.ts).
 */
export function holdsRun(mods: readonly BuiltModule[], beams: BeamLayout): (run: Run, p: Point) => boolean {
  const touched = { h: new Set<string>(), v: new Set<string>() };
  for (const r of wallRuns(mods)) for (const p of r.points) touched[r.orientation].add(pointKey(p));
  const beam = underBeam(beams);
  return (run, p) => touched[run.orientation === 'h' ? 'v' : 'h'].has(pointKey(p)) || beam(p);
}

/**
 * Where a takdrager hangs on the run between two of its posts, on a hook on the top rail 92 (Byggeregel T15): metres
 * from the run's first post, not on a post. Such a hook holds the wall there like a beam on a post (Bjørn 10.11.2026).
 */
export function hookHolds(run: Run, beams: BeamLayout): number[] {
  const h = run.orientation === 'h';
  const [line, lo] = h ? [run.points[0][1], run.points[0][0]] : [run.points[0][0], run.points[0][1]];
  const len = run.at[run.at.length - 1];
  const out = new Set<number>();
  for (const s of beams.segments) {
    for (const p of [s.from, s.to]) {
      const [along, across] = h ? [p[0], p[1]] : [p[1], p[0]];
      const t = Math.round((along - lo) * 1000) / 1000;
      if (Math.abs(across - line) < 1e-6 && t > 1e-6 && t < len - 1e-6 && !run.at.some((x) => Math.abs(t - x) < 1e-6)) out.add(t);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/** Whether `a` and `b` are joined by walls and takdrager without the given wall modules: a closed ring with them. */
function joinedWithout(mods: readonly BuiltModule[], beams: BeamLayout) {
  const next = new Map<string, Set<string>>();
  const link = (p: Point, q: Point) => {
    const [a, b] = [pointKey(p), pointKey(q)];
    next.set(a, (next.get(a) ?? new Set()).add(b));
    next.set(b, (next.get(b) ?? new Set()).add(a));
  };
  for (const m of mods) link(m.a, m.b);
  // A beam joins every wall post and beam end on its length, wherever they stand (also off the whole metres, V9, T15),
  // so an end hanging on its length or a wall under it joins it there
  const stops = [...mods.flatMap((m) => [m.a, m.b]), ...beams.segments.flatMap((s) => [s.from, s.to])];
  for (const s of beams.segments) {
    const d = (p: Point) => Math.abs(p[0] - s.from[0]) + Math.abs(p[1] - s.from[1]);
    const on = [...new Map(stops.filter((p) => onSegment(s, p)).map((p) => [pointKey(p), p])).values()].sort((p, q) => d(p) - d(q));
    for (let k = 1; k < on.length; k++) link(on[k - 1], on[k]);
  }
  return (a: Point, b: Point, without: readonly BuiltModule[]) => {
    const cut = new Set(without.flatMap((m) => [`${pointKey(m.a)}|${pointKey(m.b)}`, `${pointKey(m.b)}|${pointKey(m.a)}`]));
    const goal = pointKey(b);
    const seen = new Set([pointKey(a)]);
    const queue = [pointKey(a)];
    while (queue.length) {
      const k = queue.pop()!;
      if (k === goal) return true;
      for (const n of next.get(k) ?? []) {
        if (seen.has(n) || cut.has(`${k}|${n}`)) continue;
        seen.add(n);
        queue.push(n);
      }
    }
    return false;
  };
}

/**
 * Foot plates for every free-standing stretch of system wall. `beams`: the takdrager (none when turned off).
 * `inFrame`: a run the beam frame holds (with beams on, the stand walls), which needs no plates. `framed`: the
 * takdrager frame is up, so a stretch closing four locked sides needs none either.
 */
export function wallSupports(
  mods: readonly BuiltModule[],
  beams: BeamLayout,
  rule: SupportRule,
  inFrame: (m: BuiltModule) => boolean,
  framed = false,
): WallSupport[] {
  const joined = joinedWithout(mods, beams);
  const holds = holdsRun(mods, beams);
  const out = new Map<string, WallSupport>();
  for (const run of wallRuns(mods)) {
    if (run.mods.some(inFrame)) continue;
    const held = run.points.map((p) => holds(run, p));
    // Held at posts, and between posts by a takdrager on a hook (Byggeregel T15): one stretch at a time between held
    // points (or out to a free end), the plates always on posts. Everything in metres along the run: a short module
    // (V1, V10, D8) is as long as it is, not one post step of 1 m
    const hooks = hookHolds(run, beams);
    const postAt = (t: number) => run.at.findIndex((x) => Math.abs(x - t) < 1e-6);
    const isHeld = (t: number) => (postAt(t) >= 0 ? held[postAt(t)] : hooks.includes(t));
    const len = run.at[run.at.length - 1];
    const bounds = [...new Set([0, ...run.at.filter((_, i) => held[i]), ...hooks, len])].sort((x, y) => x - y);
    for (let i = 1; i < bounds.length; i++) {
      const [a, b] = [bounds[i - 1], bounds[i]];
      const ends: Ends = { from: isHeld(a), to: isHeld(b) };
      const [ia, ib] = [postAt(a), postAt(b)];
      const onPosts = ia >= 0 && ib >= 0;
      // Posts on the stretch, metres from its start
      const ks = run.at.flatMap((x, k) => (x > a - 1e-6 && x < b + 1e-6 ? [k] : []));
      const metre = onPosts && ks.every((k, j) => Math.abs(run.at[k] - a - j) < 1e-6) && Math.abs(b - a - (ib - ia)) < 1e-6;
      const locked = onPosts && framed && ends.from && ends.to && joined(run.points[ia], run.points[ib], run.mods.slice(ia, ib));
      const posts = locked
        ? []
        : metre
          ? stretchPosts(ib - ia, ends, rule).map((k) => ia + k)
          : bestPosts(a, b, ks.map((k) => run.at[k]), ends, rule, !onPosts).map((x) => postAt(x));
      for (const k of posts) out.set(pointKey(run.points[k]), { at: run.points[k], orientation: run.orientation });
    }
  }
  return [...out.values()];
}

/**
 * Posts (0 … len, whole metres from the stretch's start) that get a plate on a stretch of `len` modules: the textile
 * wall's rule on the posts. A free end gets its plate at the end post, pulled in whole posts only as far as the gaps
 * need; with two free ends the `to` end is pulled first. One more plate while that breaks the rule.
 */
export function stretchPosts(len: number, ends: Ends, rule: SupportRule): number[] {
  const mm = len * 1000;
  // Out from a corner or T up to 1 m: it stands by itself (supports.ts)
  if (minSupports(mm, rule, ends) === 0) return [];
  const free = (i: number) => !(i === 0 && ends.from) && !(i === len && ends.to);
  const pull = (need: number, n: number) => {
    const posts = Math.ceil(need / 1000 - 1e-9);
    return n === 1 ? [posts * 1000] : [Math.floor(posts / 2) * 1000, Math.ceil(posts / 2) * 1000];
  };
  for (let n = minSupports(mm, rule, ends); n <= len + 1; n++) {
    const at = [...new Set(spreadSupports(mm, n, rule, ends, pull).map((x) => Math.round(x / 1000)))].filter(free).sort((a, b) => a - b);
    if (keepsRule(len, at, ends, rule)) return at;
  }
  return Array.from({ length: len + 1 }, (_, i) => i).filter(free);
}

/** A stretch from `a` to `b` (metres from the run's first post) with an end on a hook between posts, or with a short
 *  module: the fewest of its posts (`at`, metres) that keep the rule. Returns post positions. */
function bestPosts(a: number, b: number, at: readonly number[], ends: Ends, rule: SupportRule, hooked: boolean): number[] {
  const len = b - a;
  const posts = at.filter((k) => !(Math.abs(k - a) < 1e-6 && ends.from) && !(Math.abs(k - b) < 1e-6 && ends.to));
  const min = minSupports(len * 1000, rule, ends);
  if (min === 0) return [];
  const keeps = (at: number[]) => keepsRule(len, at.map((k) => k - a), ends, rule);
  const gaps = (at: number[]) => {
    const all = [...(ends.from ? [a] : []), ...at, ...(ends.to ? [b] : [])];
    return all.slice(1).map((x, i) => x - all[i]);
  };
  // Without a hook: a plate at each free end, pulled in only as far as the gaps need (S3), then the most even. With
  // an end on a hook (T15): the most even
  const pull = (at: number[]) => (hooked ? 0 : (ends.from ? 0 : at[0] - a) + (ends.to ? 0 : b - at[at.length - 1]));
  const even = (at: number[]) => gaps(at).reduce((s, g) => s + g * g, 0);
  const better = (x: number[], y: number[]) => pull(x) < pull(y) - 1e-6 || (Math.abs(pull(x) - pull(y)) < 1e-6 && even(x) < even(y) - 1e-9);
  for (let n = min; n <= posts.length; n++) {
    let best: number[] | null = null;
    const pick = (from: number, chosen: number[]) => {
      if (chosen.length === n) {
        if (keeps(chosen) && (!best || better(chosen, best))) best = [...chosen];
        return;
      }
      for (let i = from; i <= posts.length - (n - chosen.length); i++) pick(i + 1, [...chosen, posts[i]]);
    };
    pick(0, []);
    if (best) return best;
  }
  return posts;
}

function keepsRule(len: number, at: number[], ends: Ends, rule: SupportRule): boolean {
  const all = [...(ends.from ? [0] : []), ...at, ...(ends.to ? [len] : [])];
  if (all.length < (len * 1000 >= rule.minFrom ? rule.min : 1)) return false;
  if (!ends.from && all[0] * 1000 > rule.maxEnd) return false;
  if (!ends.to && (len - all[all.length - 1]) * 1000 > rule.maxEnd) return false;
  return all.every((x, i) => i === 0 || (x - all[i - 1]) * 1000 <= rule.maxGap);
}
