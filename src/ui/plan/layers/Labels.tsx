// Text around the stand in the plan.
import type { Side } from '../../../domain/types'
import { fmt } from '../../format'
import { idx, productOf } from '../../env'
import { MONO, SIDE, SIDE_DIM, SIDE_LABEL, PLAN_MARGIN } from '../planStyle'

/** Side names with what stands on each side, the stand's size, and with more than one floor a legend of floor areas. */
export function Labels({ W, D, sideText, floorAreas }: { W: number; D: number; sideText: (s: Side) => string; floorAreas: Record<string, number> }) {
  const M = PLAN_MARGIN
  const floorIds = Object.keys(floorAreas)
  return (
    <g pointerEvents="none">
      <text x={W / 2} y={-M * 0.36} textAnchor="middle" style={SIDE}>
        {SIDE_LABEL.back} · {sideText('back')}
      </text>
      <text x={W / 2} y={-M * 0.14} textAnchor="middle" style={SIDE_DIM}>
        {W} m
      </text>
      <text transform={`translate(${-M * 0.3} ${D / 2}) rotate(-90)`} textAnchor="middle" style={SIDE}>
        {SIDE_LABEL.left} · {sideText('left')}
      </text>
      <text transform={`translate(${-M * 0.1} ${D / 2}) rotate(-90)`} textAnchor="middle" style={SIDE_DIM}>
        {D} m
      </text>
      <text transform={`translate(${W + M * 0.2} ${D / 2}) rotate(90)`} textAnchor="middle" style={SIDE}>
        {SIDE_LABEL.right} · {sideText('right')}
      </text>
      <text x={W / 2} y={D + M * 0.22} textAnchor="middle" style={SIDE}>
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
