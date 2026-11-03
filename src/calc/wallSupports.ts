// Støtteplater: foot plates under a system wall that stands free (Bjørn 1.11.2026, docs/foga-system.md).
//   A system wall is held by the takdrager frame. Without it (beams turned off, or an inner wall the beams don't reach)
//   it stands free and gets foot plates on its posts by the same rule as a free-standing textile wall (calc/supports.ts):
//   at least 2 supports from 1 m, at most 3 m apart, a plate at each free end, pulled in (at most 1 m) only where a gap
//   would otherwise be over 3 m.
//   Every point where another system wall meets the run (corner, T or cross: stand, inner and room walls alike) is a
//   support, and so is a post under a takdrager. With beams on, the stand walls are in the beam frame and need none.
//   Plates go only under posts (cc 1 m), centred under the wall, across it.
//   Bjørn 3.11.2026: a stretch held at one end only (out from a corner or T) needs no plate up to 1 m.
//   Bjørn 3.11.2026: with takdrager on, a stretch held at both ends that closes four locked sides (its two ends joined
//   by walls and takdrager some other way round, as a wall from a stand wall to a beam) stands by itself: no plates.
//   A long stand wall is held by a støttedrager instead (calc/supportBeams.ts).
import { pointKey } from '../domain/grid';
import type { Point } from '../domain/types';
import type { BuiltModule } from '../domain/walls';
import type { SupportRule } from '../foga/recipes';
import { onSegment, type BeamLayout } from './beams';
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
  mods: BuiltModule[];
}

/** Maximal straight runs of touching modules. */
export function wallRuns(mods: readonly BuiltModule[]): Run[] {
  const lines = new Map<string, { at: number; m: BuiltModule }[]>();
  for (const m of mods) {
    const h = m.orientation === 'h';
    const line = `${m.orientation}:${h ? m.a[1] : m.a[0]}`;
    const at = Math.min(h ? m.a[0] : m.a[1], h ? m.b[0] : m.b[1]);
    lines.set(line, [...(lines.get(line) ?? []), { at, m }]);
  }
  const runs: Run[] = [];
  for (const list of lines.values()) {
    list.sort((a, b) => a.at - b.at);
    let cur: { at: number; m: BuiltModule }[] = [];
    const flush = () => {
      if (!cur.length) return;
      const o = cur[0].m.orientation;
      const lo = (m: BuiltModule) => (o === 'h' ? (m.a[0] < m.b[0] ? m.a : m.b) : m.a[1] < m.b[1] ? m.a : m.b);
      const hi = (m: BuiltModule) => (lo(m) === m.a ? m.b : m.a);
      runs.push({ orientation: o, mods: cur.map((c) => c.m), points: [...cur.map((c) => lo(c.m)), hi(cur[cur.length - 1].m)] });
      cur = [];
    };
    for (const e of list) {
      if (cur.length && Math.abs(e.at - (cur[cur.length - 1].at + 1)) > 1e-6) flush();
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
 * resting on it. Shared by the foot plates and the støttedrager (calc/supportBeams.ts).
 */
export function holdsRun(mods: readonly BuiltModule[], beams: BeamLayout): (run: Run, p: Point) => boolean {
  const touched = { h: new Set<string>(), v: new Set<string>() };
  for (const r of wallRuns(mods)) for (const p of r.points) touched[r.orientation].add(pointKey(p));
  const beam = underBeam(beams);
  return (run, p) => touched[run.orientation === 'h' ? 'v' : 'h'].has(pointKey(p)) || beam(p);
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
  // A beam in metre steps, so an end hanging on its length or a wall under it joins it there
  for (const s of beams.segments) {
    const n = Math.max(1, Math.round(s.length));
    const at = (k: number): Point => [s.from[0] + ((s.to[0] - s.from[0]) * k) / n, s.from[1] + ((s.to[1] - s.from[1]) * k) / n];
    for (let k = 0; k < n; k++) link(at(k), at(k + 1));
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
    // Between two supports (or a free end), one stretch at a time
    let start = 0;
    for (let i = 1; i < run.points.length; i++) {
      if (!held[i] && i < run.points.length - 1) continue;
      const locked = framed && held[start] && held[i] && joined(run.points[start], run.points[i], run.mods.slice(start, i));
      for (const k of locked ? [] : stretchPosts(i - start, { from: held[start], to: held[i] }, rule)) {
        const p = run.points[start + k];
        out.set(pointKey(p), { at: p, orientation: run.orientation });
      }
      start = i;
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

function keepsRule(len: number, at: number[], ends: Ends, rule: SupportRule): boolean {
  const all = [...(ends.from ? [0] : []), ...at, ...(ends.to ? [len] : [])];
  if (all.length < (len * 1000 >= rule.minFrom ? rule.min : 1)) return false;
  if (!ends.from && all[0] * 1000 > rule.maxEnd) return false;
  if (!ends.to && (len - all[all.length - 1]) * 1000 > rule.maxEnd) return false;
  return all.every((x, i) => i === 0 || (x - all[i - 1]) * 1000 <= rule.maxGap);
}
