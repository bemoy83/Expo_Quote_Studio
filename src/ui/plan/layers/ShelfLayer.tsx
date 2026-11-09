// Shelves (hylle 6311) in the plan: the board as seen from above, 300 mm deep in front of its wall face, white with a
// thin ink edge like furniture. Shelves stacked in one felt are drawn once. At full detail the board says its height
// from the floor, a stack its heights low to high («500/900/1300», Bjørn 9.11.2026), so a broken row shows in the plan.
import { shelfBox, shelfStacks } from '../../../domain/shelves'
import type { Variant } from '../../../domain/types'
import { INK, SURFACE } from '../../colors'
import { rules } from '../../env'
import type { Layer } from '../../tools'
import { linePx, sizePx, usePlanScale } from '../planScale'
import { chosenShelves, type PlanSelection } from '../selection'
import { HALO_OPACITY } from '../planStyle'
import { GONE_FILL, useErasing } from './erasing'

export function ShelfLayer({ v, selection, dim }: { v: Variant; selection: PlanSelection; dim: (...layers: Layer[]) => number }) {
  const { gone, hatch } = useErasing()
  const sc = usePlanScale()
  const chosen = new Set(chosenShelves(v, selection))
  return (
    <g opacity={dim('objects')} pointerEvents="none">
      {shelfStacks(v).map((stack) => {
        const b = shelfBox(v, rules, stack[0])
        if (!b) return null
        const sel = stack.some((f) => chosen.has(f.id))
        const g = stack.some((f) => gone('shelf', f.id))
        const rect = (props: object) => <rect x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} {...props} />
        const cx = (b.x0 + b.x1) / 2
        const cy = (b.y0 + b.y1) / 2
        return (
          <g key={stack[0].id}>
            {sel && rect({ fill: 'none', stroke: INK, strokeOpacity: HALO_OPACITY, strokeWidth: linePx(sc, 6) })}
            {rect({ fill: SURFACE, fillOpacity: g ? GONE_FILL : undefined, stroke: INK, strokeWidth: sel ? linePx(sc, 1.8) : linePx(sc, 0.75) })}
            {g && rect({ fill: hatch })}
            {sc.detail === 'full' && (
              <text x={cx} y={cy + sizePx(sc, 3)} textAnchor="middle" style={{ font: `500 ${sizePx(sc, 9)}px var(--font-numeric)`, fill: INK }}>
                {stack.map((f) => Math.round(f.y * 1000)).join('/')}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}
