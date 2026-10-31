import { makeModule, type Module } from '../../domain/grid'
import { alongX, cellsTo } from '../../domain/snapGrid'
import type { Point, Stand } from '../../domain/types'

/** The grid edge (module) closest to p, clamped to the stand. */
export function nearestEdge(stand: Stand, p: { x: number; y: number }): Module {
  const { width: W, depth: D } = stand
  const x = Math.max(0, Math.min(W, p.x))
  const y = Math.max(0, Math.min(D, p.y))
  const hy = Math.round(y)
  const vx = Math.round(x)
  const i = Math.max(0, Math.min(W - 1, Math.floor(x)))
  const j = Math.max(0, Math.min(D - 1, Math.floor(y)))
  return Math.abs(y - hy) <= Math.abs(x - vx) ? makeModule([i, hy], [i + 1, hy]) : makeModule([vx, j], [vx, j + 1])
}

/** Distance from p to the segment a–b. */
export function distToSegment(p: { x: number; y: number }, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const L = dx * dx + dy * dy
  const t = L ? Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / L)) : 0
  return Math.hypot(p.x - (a[0] + t * dx), p.y - (a[1] + t * dy))
}

/**
 * Wall stroke while dragging: starts at the module under the pointer, then extends along the drag direction in whole
 * cells of `step` (the wall cc, 1 m today) on the shared drawing grid. Returns the end points.
 */
export function strokeFrom(stand: Stand, p0: { x: number; y: number }, p: { x: number; y: number }, step = 1): [Point, Point] {
  const { width: W, depth: D } = stand
  const e0 = nearestEdge(stand, p0)
  const e0h = e0.orientation === 'h'
  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  if (alongX(p0, p)) {
    const y = e0h ? e0.a[1] : cl(Math.round(p0.y), 0, D)
    const i = e0h ? Math.min(e0.a[0], e0.b[0]) : cl(Math.floor(p0.x), 0, W - 1)
    // The module under the pointer is always part of the stroke: start on its far side from the drag
    const a = p.x >= p0.x ? i : i + 1
    return [[a, y], [cellsTo(a, p.x, step, W, 1, a > i), y]]
  }
  const x = !e0h ? e0.a[0] : cl(Math.round(p0.x), 0, W)
  const j = !e0h ? Math.min(e0.a[1], e0.b[1]) : cl(Math.floor(p0.y), 0, D - 1)
  const a = p.y >= p0.y ? j : j + 1
  return [[x, a], [x, cellsTo(a, p.y, step, D, 1, a > j)]]
}
