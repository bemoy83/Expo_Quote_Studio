// The shelf brush's stroke in the wall drawer's drawing (shelfBrush.ts): the shelves it lays dimmed, felts that take none
// hatched at that height, and the height in the dark measure pill (docs/forhandsvisning.md). A shelf a click takes off is
// hatched as Tøm hatches what goes.
import { cornerLayout } from '../../../domain/shelves/corners'
import { ShelfFront } from '../elevation'
import { shelfFront } from '../shelfFront'
import { rules } from '../../env'
import { HatchPattern, PillAt } from '../layers/Previews'
import { PlanScaleContext, sizePx, type PlanScale } from '../planScale'
import { INVALID, PHANTOM } from '../planStyle'
import type { Stroke } from './shelfBrush'

/** The stroke in the drawing: the new shelves dimmed, felts that take none hatched at that height, the height in a pill. */
export function BrushPreview({ stroke, sc, H, u, x }: { stroke: Stroke; sc: PlanScale; H: number; u: number; x: (a: number, b: number) => number }) {
  const { thickness, width } = rules.shelf.board
  const inset = (rules.wall.cc - width) / 2
  const z = H - stroke.y
  const added = (stroke.v.shelves ?? []).filter((f) => stroke.ids.includes(f.id))
  const layout = cornerLayout(stroke.v, rules)
  const lo = Math.min(stroke.m0, stroke.m1)
  const hi = Math.max(stroke.m0, stroke.m1)
  const cx = x(lo, hi + 1) + (hi + 1 - lo) / 2
  const band = Math.max(thickness, 3 * u) + sizePx(sc, 4)
  return (
    <PlanScaleContext.Provider value={sc}>
      <g pointerEvents="none">
        <HatchPattern id="shelf-brush-hatch" />
        <g opacity={PHANTOM.line}>
          {added.map((f) => (
            <ShelfFront key={f.id} {...shelfFront(stroke.v, f, layout, x)} y={f.y} H={H} u={u} />
          ))}
        </g>
        {[...stroke.out.map((o) => o.module), ...(stroke.removed ? [stroke.removed.module] : [])].map((m) => (
          <g key={m}>
            <rect x={x(m + inset, m + 1 - inset)} y={z - sizePx(sc, 2)} width={width} height={band} fill={INVALID.fill} />
            <rect x={x(m + inset, m + 1 - inset)} y={z - sizePx(sc, 2)} width={width} height={band} fill="url(#shelf-brush-hatch)" />
          </g>
        ))}
        <PillAt at={[cx, z - sizePx(sc, 14)]} text={stroke.label} />
      </g>
    </PlanScaleContext.Provider>
  )
}
