// Shelves (hylle 6311) in the plan: the board as seen from above, 300 mm deep in front of its wall face, white with a
// thin ink edge like furniture. Shelves stacked in one felt are drawn once, with their count on the board (×3). Heights
// were tried there and left out: a full felt says more than fits (Bjørn 9.11.2026); they are in the wall drawing. In a
// corner the board is cut to fit and the 01 rails it rests on show as small ink bars (Byggeregler H10–H12).
import { cornerLayout, railBox } from '../../../domain/shelves/corners'
import { shelfBox, shelfStacks } from '../../../domain/shelves/model'
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
  // A wall chosen on its own shows its dimension chain over the boards: their counts give way (Bjørn 9.11.2026)
  const wallChosen = selection.wallId && !selection.shelfId && !selection.textileId ? selection.wallId : null
  const layout = cornerLayout(v, rules)
  return (
    <g opacity={dim('objects')} pointerEvents="none">
      {layout.rails.map((r) => {
        const b = railBox(v, rules, r)
        return b && <rect key={r.key} x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} fill={INK} />
      })}
      {shelfStacks(v).map((stack) => {
        // A stack in a corner may mix boards (narrow where a rail passes behind): the plan shows the widest
        const area = (x: ReturnType<typeof shelfBox>) => (x ? (x.x1 - x.x0) * (x.y1 - x.y0) : -1)
        const b = stack.map((f) => shelfBox(v, rules, f, layout)).reduce((m, x) => (area(x) > area(m) ? x : m), null)
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
            {stack.length > 1 && sc.detail === 'full' && stack[0].wallId !== wallChosen && (
              <text x={cx} y={cy + sizePx(sc, 3)} textAnchor="middle" style={{ font: `500 ${sizePx(sc, 9)}px var(--font-numeric)`, fill: INK }}>
                ×{stack.length}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}
