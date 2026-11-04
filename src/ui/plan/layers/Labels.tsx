// Text around the stand in the plan.
import type { Side } from '../../../domain/types'
import { SIDE, SIDE_LABEL, PLAN_MARGIN } from '../planStyle'
import { usePlanScale } from '../planScale'
import { FRONT_NAME_DROP, sideNameOffset } from '../dims'

/**
 * Side names with what stands on each side. The stand's width and depth are in the dimension chains (DimLayer), the
 * floor areas in the legend (Legend).
 */
export function Labels({ W, D, sideText, totals }: { W: number; D: number; sideText: (s: Side) => string; totals: ReadonlySet<Side> }) {
  const M = PLAN_MARGIN
  const sc = usePlanScale()
  const off = (s: Side) => sideNameOffset(sc, totals.has(s))
  return (
    <g pointerEvents="none">
      <text x={W / 2} y={-Math.min(off('back'), M - 0.2)} textAnchor="middle" style={SIDE}>
        {SIDE_LABEL.back} · {sideText('back')}
      </text>
      <text transform={`translate(${-off('left')} ${D / 2}) rotate(-90)`} textAnchor="middle" style={SIDE}>
        {SIDE_LABEL.left} · {sideText('left')}
      </text>
      <text transform={`translate(${W + off('right')} ${D / 2}) rotate(90)`} textAnchor="middle" style={SIDE}>
        {SIDE_LABEL.right} · {sideText('right')}
      </text>
      <text x={W / 2} y={D + off('front') + FRONT_NAME_DROP} textAnchor="middle" style={SIDE}>
        {SIDE_LABEL.front} · {sideText('front')}
      </text>
    </g>
  )
}
