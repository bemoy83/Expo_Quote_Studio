// Editing innvendige takdragere: drawn straight inside the stand in whole and half metres, never along a wall or on top
// of another beam. Layout, posts, hooks and foot plates: calc/beams/innerBeams.ts.
// Byggeregel T8 (docs/byggeregler.md).
import { nextId } from './ids';
import { modulesAlong, uncoveredRuns } from './grid';
import type { InnerBeam, Point, Variant } from './types';
import { builtModules } from './walls';

/** A straight run the brush refuses to lie along: a standard beam (from the calc). */
export interface Run {
  from: Point;
  to: Point;
}

export type BeamEdit = { v: Variant; id: string } | { error: string };

/** The shortest takdrager, m: a half metre (Byggeregel T8). */
const HALF = 0.5;
const EPS = 1e-6;

const inStand = (v: Variant, [x, y]: Point) => x >= 0 && y >= 0 && x <= v.stand.width && y <= v.stand.depth;

/** Why a beam from a to b can not go there, or null. `others`: drawn beams it must not lie on (itself left out). */
function refusal(v: Variant, a: Point, b: Point, standard: readonly Run[], others: readonly InnerBeam[]): string | null {
  if (a[0] !== b[0] && a[1] !== b[1]) return 'Takdrageren må gå rett langs rutenettet';
  if (!inStand(v, a) || !inStand(v, b)) return 'Takdrageren må stå innenfor standen';
  if (Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) < HALF - EPS) return 'Takdrageren må være minst en halv meter';
  // Along for some length, wherever the wall or beam stands in the grid
  if (modulesAlong(builtModules(v), a, b).length) return 'Takdrageren kan ikke gå langs en vegg';
  const beams = [...standard, ...others].map((r) => ({ a: r.from, b: r.to }));
  if (modulesAlong(beams, a, b).length) return 'Det går allerede en takdrager her';
  return null;
}

/** Draw a takdrager from a to b. `standard`: the standard beams it may not lie along. */
export function drawInnerBeam(v: Variant, a: Point, b: Point, standard: readonly Run[]): BeamEdit {
  const beams = v.innerBeams ?? [];
  const why = refusal(v, a, b, standard, beams);
  if (why) return { error: why };
  const id = nextId(beams.map((x) => x.id), 'td');
  return { v: { ...v, innerBeams: [...beams, { id, from: a, to: b }] }, id };
}

/** Take the part from a to b out of every drawn beam it lies along: a beam is split where a piece is taken out. */
export function eraseInnerBeams(v: Variant, a: Point, b: Point): Variant {
  const beams = v.innerBeams ?? [];
  const gone = [{ a, b }];
  const out: InnerBeam[] = [];
  let changed = false;
  for (const x of beams) {
    if (!modulesAlong(gone, x.from, x.to).length) {
      out.push(x);
      continue;
    }
    changed = true;
    const kept = uncoveredRuns(gone, x.from, x.to).filter(([p, q]) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) > HALF - EPS);
    kept.forEach(([from, to], q) => {
      const id = q === 0 ? x.id : nextId([...beams, ...out].map((y) => y.id), 'td');
      out.push({ id, from, to });
    });
  }
  return changed ? { ...v, innerBeams: out } : v;
}

export const removeInnerBeam = (v: Variant, id: string): Variant => ({ ...v, innerBeams: (v.innerBeams ?? []).filter((x) => x.id !== id) });

/** Move a drawn beam `delta` whole metres sideways and `along` in its own direction. Returns v when it would not fit. */
export function moveInnerBeam(v: Variant, id: string, delta: number, along: number, standard: readonly Run[]): Variant {
  const beams = v.innerBeams ?? [];
  const x = beams.find((y) => y.id === id);
  if (!x || (!delta && !along)) return v;
  const h = x.from[1] === x.to[1];
  const shift = ([px, py]: Point): Point => (h ? [px + along, py + delta] : [px + delta, py + along]);
  const from = shift(x.from);
  const to = shift(x.to);
  if (refusal(v, from, to, standard, beams.filter((y) => y.id !== id))) return v;
  return { ...v, innerBeams: beams.map((y) => (y.id === id ? { ...y, from, to } : y)) };
}

/** Steps a drawn beam moves in off the grid (Byggeregel T15), m. */
export const FINE_STEP = 0.05;

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** The beam lies off the 1 m grid across its direction (Byggeregel T15). */
export const offGrid = (b: InnerBeam) => {
  const c = b.from[1] === b.to[1] ? b.from[1] : b.from[0];
  return Math.abs(c - Math.round(c)) > 1e-6;
};

/**
 * Move a drawn beam `offset` m across its direction (Shift + dra or «Fin» in the pill, Byggeregel T15), in steps of
 * FINE_STEP, from where it is: off the 1 m grid, its ends where it meets the walls and beams across it. A whole metre
 * puts it back on the grid. `along`: m along its own direction too, in half metres (Byggeregel T8). Returns v when it
 * would not fit.
 */
export function shiftInnerBeam(v: Variant, id: string, offset: number, standard: readonly Run[], along = 0): Variant {
  const beams = v.innerBeams ?? [];
  const x = beams.find((y) => y.id === id);
  const d = round3(Math.round(offset / FINE_STEP) * FINE_STEP);
  const t = round3(Math.round(along / HALF) * HALF);
  if (!x || (!d && !t)) return v;
  const h = x.from[1] === x.to[1];
  const shift = ([px, py]: Point): Point => (h ? [round3(px + t), round3(py + d)] : [round3(px + d), round3(py + t)]);
  const from = shift(x.from);
  const to = shift(x.to);
  if (refusal(v, from, to, standard, beams.filter((y) => y.id !== id))) return v;
  return { ...v, innerBeams: beams.map((y) => (y.id === id ? { ...y, from, to } : y)) };
}

/** The drawn beam nearest p within `within` m. */
export function innerBeamAt(v: Variant, p: { x: number; y: number }, within = 0.15): InnerBeam | undefined {
  let best: InnerBeam | undefined;
  let bd = within;
  for (const x of v.innerBeams ?? []) {
    const lo = [Math.min(x.from[0], x.to[0]), Math.min(x.from[1], x.to[1])];
    const hi = [Math.max(x.from[0], x.to[0]), Math.max(x.from[1], x.to[1])];
    const d = Math.hypot(p.x - Math.max(lo[0], Math.min(hi[0], p.x)), p.y - Math.max(lo[1], Math.min(hi[1], p.y)));
    if (d < bd) {
      bd = d;
      best = x;
    }
  }
  return best;
}
