// The sections of a counter of Disker og podier as rectangles on the 250 grid (Byggeregler K10–K15): the geometry the
// pen (podiums.ts), the grips (podiumGrips.ts) and the links (podiumLinks.ts) share. Pure, mm in the counter's frame.
import type { CounterSection, Variant } from './types';

export const EPS = 1e-6;
/** The grid sections are drawn on, mm (K10). */
export const GRID = 250;
export type Range = readonly [number, number];
export type Axis = 'x' | 'z';

/** The sketch with the sections of counter `id` changed by `fn`; the same sketch when nothing changed (no undo step). */
export function withSections(v: Variant, id: string, fn: (sections: CounterSection[]) => CounterSection[]): Variant {
  const o = v.objects.find((x) => x.id === id);
  if (!o?.sections) return v;
  const sections = fn(o.sections);
  if (JSON.stringify(sections) === JSON.stringify(o.sections)) return v;
  return { ...v, objects: v.objects.map((x) => (x.id === id ? { ...x, sections } : x)) };
}

/** The length two ranges share (negative when apart). */
export const shared = (p: Range, q: Range) => Math.min(p[1], q[1]) - Math.max(p[0], q[0]);

/** The box round some sections, node to node. */
export function bounds(sections: readonly CounterSection[]): { x: [number, number]; z: [number, number] } {
  return {
    x: [Math.min(...sections.map((s) => s.x[0])), Math.max(...sections.map((s) => s.x[1]))],
    z: [Math.min(...sections.map((s) => s.z[0])), Math.max(...sections.map((s) => s.z[1]))],
  };
}

/** Whether a point lies inside one of the sections. */
export const covered = (sections: readonly CounterSection[], x: number, z: number) => sections.some((s) => x > s.x[0] && x < s.x[1] && z > s.z[0] && z < s.z[1]);

const overlap = (s: CounterSection, t: CounterSection) => shared(s.x, t.x) > EPS && shared(s.z, t.z) > EPS;

/** Whether any of `p` overlaps any of `q`; with one set, whether two of its own overlap. */
export function overlaps(p: readonly CounterSection[], q?: readonly CounterSection[]): boolean {
  if (q) return p.some((s) => q.some((t) => overlap(s, t)));
  return p.some((s, i) => p.some((t, j) => j > i && overlap(s, t)));
}

/** Along a line across `axis`: a section's span that way (z for a line across x). */
export const along = (s: CounterSection, axis: Axis): Range => (axis === 'x' ? s.z : s.x);
export const withAxis = (s: CounterSection, axis: Axis, r: Range): CounterSection => (axis === 'x' ? { ...s, x: [r[0], r[1]] } : { ...s, z: [r[0], r[1]] });
export const withAlong = (s: CounterSection, axis: Axis, r: Range): CounterSection => (axis === 'x' ? { ...s, z: [r[0], r[1]] } : { ...s, x: [r[0], r[1]] });
/** A section moved `d` across `axis`. */
export const shifted = (s: CounterSection, axis: Axis, d: number): CounterSection => withAxis(s, axis, [s[axis][0] + d, s[axis][1] + d]);

/** Where two sections meet across `axis`, side by side sharing at least GRID along (K10): the node line, else null. */
export function meet(p: CounterSection, q: CounterSection, axis: Axis): number | null {
  if (shared(along(p, axis), along(q, axis)) < GRID - EPS) return null;
  if (Math.abs(p[axis][1] - q[axis][0]) < EPS) return p[axis][1];
  if (Math.abs(q[axis][1] - p[axis][0]) < EPS) return p[axis][0];
  return null;
}

/** The groups of sections that hang together, two joined where `joins` says so. */
export function groups(sections: readonly CounterSection[], joins: (p: CounterSection, q: CounterSection) => boolean): CounterSection[][] {
  const seen = new Set<number>();
  const out: CounterSection[][] = [];
  for (let k = 0; k < sections.length; k++) {
    if (seen.has(k)) continue;
    const group = [k];
    seen.add(k);
    for (let i = 0; i < group.length; i++)
      sections.forEach((s, j) => {
        if (!seen.has(j) && joins(sections[group[i]], s)) {
          seen.add(j);
          group.push(j);
        }
      });
    out.push(group.map((i) => sections[i]));
  }
  return out;
}

/** A straight run of section edges: across `axis` at the node line `at`, from `a` to `b` along. */
export interface EdgeRun {
  axis: Axis;
  at: number;
  a: number;
  b: number;
}

/**
 * Every edge of the sections, in GRID pieces, that `keep` takes (by its line and the point just past it the way `out`
 * faces), joined where they run on along the same line facing the same way.
 */
export function edgeRuns(sections: readonly CounterSection[], outs: readonly (-1 | 1)[], keep: (past: [number, number]) => boolean): (EdgeRun & { out: -1 | 1 })[] {
  const bits = new Map<string, { axis: Axis; out: -1 | 1; at: number; t: number[] }>();
  for (const s of sections)
    for (const axis of ['x', 'z'] as const)
      for (const out of outs) {
        const at = out < 0 ? s[axis][0] : s[axis][1];
        const run = along(s, axis);
        for (let t = run[0]; t < run[1] - EPS; t += GRID) {
          const mid = t + GRID / 2;
          if (!keep(axis === 'x' ? [at + out, mid] : [mid, at + out])) continue;
          const key = `${axis}${out}:${at}`;
          const r = bits.get(key) ?? { axis, out, at, t: [] };
          r.t.push(t);
          bits.set(key, r);
        }
      }
  const runs: (EdgeRun & { out: -1 | 1 })[] = [];
  for (const { axis, out, at, t } of bits.values()) {
    t.sort((p, q) => p - q);
    let a = t[0];
    for (let i = 1; i <= t.length; i++)
      if (i === t.length || t[i] - t[i - 1] > GRID + EPS) {
        runs.push({ axis, out, at, a, b: t[i - 1] + GRID });
        a = t[i];
      }
  }
  return runs;
}
