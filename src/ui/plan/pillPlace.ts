// Where the measure pill of a stroke goes (docs/forhandsvisning.md): beside the middle of the stroke, on the side away
// from the stand's centre, so it never covers the stand. Pure, so it can be tested without a plan.
import type { Point } from '../../domain/types'
import { EM, sizePx, textPx, type PlanScale } from './planScale'
import { PILL } from './planStyle'

/** Unit normal of a straight stroke a→b pointing away from the centre. A stroke through the centre goes up or left. */
export function awayFrom(a: Point, b: Point, centre: Point): Point {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const L = Math.hypot(dx, dy)
  if (L < 1e-9) return [0, -1]
  let n: Point = [-dy / L, dx / L]
  const mx = (a[0] + b[0]) / 2 - centre[0]
  const my = (a[1] + b[1]) / 2 - centre[1]
  const side = n[0] * mx + n[1] * my
  if (side < -1e-9 || (Math.abs(side) <= 1e-9 && n[0] + n[1] > 0)) n = [-n[0], -n[1]]
  return [n[0] + 0, n[1] + 0]
}

/** Width of the pill around `text`, m. */
export const pillWidth = (s: PlanScale, text: string) => sizePx(s, textPx(text, PILL.font, EM.mono) + 2 * PILL.pad)

/**
 * Centre of the pill for a stroke a→b drawn `stroke` m wide: `PILL.gap` px outside the stroke's edge, on the side away
 * from the centre. A pill beside a vertical stroke stands out by half its width, beside a horizontal one by half its height.
 */
export function pillCentre(s: PlanScale, a: Point, b: Point, centre: Point, stroke: number, text: string): Point {
  const n = awayFrom(a, b, centre)
  const half = Math.abs(n[0]) * (pillWidth(s, text) / 2) + Math.abs(n[1]) * sizePx(s, PILL.height / 2)
  const off = stroke / 2 + sizePx(s, PILL.gap) + half
  return [(a[0] + b[0]) / 2 + n[0] * off, (a[1] + b[1]) / 2 + n[1] * off]
}
