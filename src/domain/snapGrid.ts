// Drawing grid shared by the brushes that draw straight runs: Foga system walls and free-standing textile walls. One
// drawing language with Disker og podier (Bjørn 14.11.2026): 1 m from the metre grid, 250 with Shift or «Fin». The pens
// that draw a run use domain/runDraw.ts; Tøm's stroke grows along the axis it is dragged most (cellsTo).
const EPS = 1e-9;

/** x on a grid of `g`, rounded to the nearest node. */
export const snapTo = (x: number, g: number) => Math.round(x / g) * g;

/** Clean float noise from adding cells (0.1 + 0.2 …) so equal points compare equal. */
const tidy = (x: number) => Math.round(x * 1e6) / 1e6;

/** True when a drag from p0 to p runs more along x than y. */
export const alongX = (p0: { x: number; y: number }, p: { x: number; y: number }) => Math.abs(p.x - p0.x) >= Math.abs(p.y - p0.y);

/**
 * The end of a stroke from `a` along one axis toward `to` (the pointer's coordinate on that axis): a whole number of
 * `step` cells, at least `minCells`, as many as fit between `a` and the stand edge `max` (0 is the other edge).
 * `back` sets the direction when the drag has not moved yet.
 */
export function cellsTo(a: number, to: number, step: number, max: number, minCells = 0, back = false): number {
  const d = to - a;
  const dir = Math.abs(d) < EPS ? (back ? -1 : 1) : Math.sign(d);
  const room = Math.floor(((dir > 0 ? max - a : a) + EPS) / step);
  const n = Math.min(room, Math.max(minCells, Math.round(Math.abs(d) / step)));
  return tidy(a + dir * n * step);
}

/** Shift or «Fin» (Bjørn 14.11.2026): the pens draw in 250 steps, else 1 m on the metre grid (runDraw.ts). */
export const FINE_STEP = 0.25;
