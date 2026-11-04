// Text around the stand in the plan.
import type { Side } from '../../../domain/types'
import { SIDE, SIDE_LABEL, PLAN_MARGIN } from '../planStyle'
import { sizePx, usePlanScale } from '../planScale'
import { DIM_TOTAL } from '../dims'

/** Distance of a side name from the stand edge, screen px: outside the total where there is one, else close. */
const NAME_PAST_TOTAL = DIM_TOTAL + 22
const NAME_CLOSE = 14

/**
 * Side names with what stands on each side. The stand's width and depth are in the dimension chains (DimLayer), the
 * floor areas in the legend (Legend).
 */
export function Labels({ W, D, sideText, totals }: { W: number; D: number; sideText: (s: Side) => string; totals: ReadonlySet<Side> }) {
  const M = PLAN_MARGIN
  const sc = usePlanScale()
  // Outside the total row, but never past the margin
  const off = (s: Side) => Math.min(M - 0.08, sizePx(sc, totals.has(s) ? NAME_PAST_TOTAL : NAME_CLOSE))
  return (
    <g pointerEvents="none">
      <text x={W / 2} y={-off('back')} textAnchor="middle" style={SIDE}>
        {SIDE_LABEL.back} · {sideText('back')}
      </text>
      <text transform={`translate(${-off('left')} ${D / 2}) rotate(-90)`} textAnchor="middle" style={SIDE}>
        {SIDE_LABEL.left} · {sideText('left')}
      </text>
      <text transform={`translate(${W + off('right')} ${D / 2}) rotate(90)`} textAnchor="middle" style={SIDE}>
        {SIDE_LABEL.right} · {sideText('right')}
      </text>
      <text x={W / 2} y={D + off('front') + 0.12} textAnchor="middle" style={SIDE}>
        {SIDE_LABEL.front} · {sideText('front')}
      </text>
    </g>
  )
}
