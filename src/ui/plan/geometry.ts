import { nearestEdge } from '../../domain/grid'
import type { Point } from '../../domain/types'

/** The grid edge (module) closest to p, clamped to the stand (domain/grid.ts). */
export { nearestEdge }

/** Distance from p to the segment a–b. */
export function distToSegment(p: { x: number; y: number }, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const L = dx * dx + dy * dy
  const t = L ? Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / L)) : 0
  return Math.hypot(p.x - (a[0] + t * dx), p.y - (a[1] + t * dy))
}
