// Text around the stand in the plan.
import type { Side } from '../../../domain/types'
import { fmt } from '../../format'
import { idx, productOf } from '../../env'
import { MONO, SIDE, SIDE_LABEL, PLAN_MARGIN } from '../planStyle'
import { sizePx, usePlanScale } from '../planScale'
import { DIM_TOTAL } from '../dims'

/** Distance of a side name from the stand edge, screen px: outside the total where there is one, else close. */
const NAME_PAST_TOTAL = DIM_TOTAL + 22
const NAME_CLOSE = 14

/**
 * Side names with what stands on each side, and with more than one floor a legend of floor areas. The stand's width
 * and depth are in the dimension chains (DimLayer).
 */
export function Labels({ W, D, sideText, floorAreas, totals }: { W: number; D: number; sideText: (s: Side) => string; floorAreas: Record<string, number>; totals: ReadonlySet<Side> }) {
  const M = PLAN_MARGIN
  const sc = usePlanScale()
  const floorIds = Object.keys(floorAreas)
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
      {floorIds.length > 1 &&
        floorIds.map((a, n) => {
          const y = D + 0.62 + n * 0.3
          return (
            <g key={a}>
              <rect x={-M + 0.25} y={y - 0.17} width={0.2} height={0.2} rx={0.03} fill={idx.byArtnr.get(a)?.variant.color} />
              <text x={-M + 0.52} y={y} style={{ ...MONO, fontSize: '0.19px' }}>
                {`${productOf(a)?.name ?? a} ${idx.byArtnr.get(a)?.variant.name.toLowerCase() ?? ''} · ${fmt(floorAreas[a])} m²`}
              </text>
            </g>
          )
        })}
    </g>
  )
}
