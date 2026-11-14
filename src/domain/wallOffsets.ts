// Mål til vegger utenfor hele meter (Byggeregel V12, Bjørn 14.11.2026): a wall off the metre lines (V9) is measured out on
// the work order from the nearest wall or stand edge parallel to what is measured, only where it is not a whole metre:
// the wall's line once, and each end that is off the metre.
import type { Module } from './grid';
import type { Point, Stand, Wall } from './types';

export interface WallOffset {
  /** On the wall: its end, or where its line is measured. */
  from: Point;
  /** On the wall or stand edge it is measured from. */
  to: Point;
  /** Distance, m. */
  length: number;
}

const EPS = 1e-6;
const whole = (n: number) => Math.abs(n - Math.round(n)) < EPS;

/**
 * From p along axis k (0: x, 1: y) to the nearest line a wall module lies on across that axis (one through p's other
 * coordinate) or the stand edge, leaving out the line p itself is on.
 */
function nearestAcross(stand: Stand, mods: readonly Module[], p: Point, k: 0 | 1): Point | null {
  const j = 1 - k;
  const size = k === 0 ? stand.width : stand.depth;
  const lines = [0, size];
  for (const m of mods) {
    // A module across axis k lies along axis j: its k coordinate fixed
    if (Math.abs(m.a[k] - m.b[k]) > EPS) continue;
    const [lo, hi] = [Math.min(m.a[j], m.b[j]), Math.max(m.a[j], m.b[j])];
    if (p[j] >= lo - EPS && p[j] <= hi + EPS) lines.push(m.a[k]);
  }
  let best: number | null = null;
  for (const c of lines) if (Math.abs(c - p[k]) > EPS && (best === null || Math.abs(c - p[k]) < Math.abs(best - p[k]))) best = c;
  if (best === null) return null;
  return k === 0 ? [best, p[1]] : [p[0], best];
}

/** Every measure of the walls off the metre lines. `mods`: the built wall modules. */
export function wallOffsets(stand: Stand, walls: readonly Wall[], mods: readonly Module[]): WallOffset[] {
  const out = new Map<string, WallOffset>();
  const add = (p: Point, k: 0 | 1) => {
    const q = nearestAcross(stand, mods, p, k);
    if (!q) return;
    const key = [p, q].map((x) => x.join(',')).sort().join('|');
    out.set(key, { from: p, to: q, length: Math.round(Math.abs(q[k] - p[k]) * 1000) / 1000 });
  };
  const onOther = (w: Wall, p: Point) => mods.some((m) => !isOn(w, m) && between(m, p));
  for (const w of walls) {
    if (w.room) continue;
    // Along: 0 for a wall along x
    const k: 0 | 1 = w.from[1] === w.to[1] ? 0 : 1;
    const j = (1 - k) as 0 | 1;
    // Its line, measured at a free end (else its start)
    if (!whole(w.from[j])) add([w.from, w.to].find((p) => !onOther(w, p)) ?? w.from, j);
    // Each end off the metre
    for (const e of [w.from, w.to]) if (!whole(e[k])) add(e, k);
  }
  return [...out.values()];
}

/** The module lies on the wall's line, within it. */
function isOn(w: Wall, m: Module): boolean {
  return between({ a: w.from, b: w.to }, m.a) && between({ a: w.from, b: w.to }, m.b);
}

function between(m: Pick<Module, 'a' | 'b'>, p: Point): boolean {
  return (
    p[0] >= Math.min(m.a[0], m.b[0]) - EPS && p[0] <= Math.max(m.a[0], m.b[0]) + EPS && p[1] >= Math.min(m.a[1], m.b[1]) - EPS && p[1] <= Math.max(m.a[1], m.b[1]) + EPS
  );
}
