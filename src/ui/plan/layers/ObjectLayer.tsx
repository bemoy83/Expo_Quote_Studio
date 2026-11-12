// Furniture in the plan. A counter (Byggeregel K1) is drawn in its plates' colour (K6) and shows its plates: front and both ends closed, the back open.
import { mainGroupOf } from '../../../catalog/groups'
import { counterBuildOf, pieceRects } from '../../../domain/counterShape'
import { counterRal, footprintBox, objectFootprint } from '../../../domain/objects'
import type { Variant } from '../../../domain/types'
import { BLOCK, INK } from '../../colors'
import { idx, place, plateColor, productOf } from '../../env'
import { linePx, usePlanScale } from '../planScale'
import type { Layer, Tool } from '../../tools'
import type { PlanSelection } from '../selection'
import { DIMMED, HALO_OPACITY, outlineHalo } from '../planStyle'
import { CounterPlates } from './CounterPlates'
import { GONE_FILL, useErasing } from './erasing'

/** Furniture by its footprint; one that collides is outlined in red. */
export function ObjectLayer(props: {
  v: Variant
  selection: PlanSelection
  tool: Tool
  /** Objects that collide with a wall or each other. */
  bad: Set<string>
  dim: (...layers: Layer[]) => number
  /** A main product group the panel has hidden. */
  off: (group: string) => boolean
}) {
  const { v, selection, tool, bad, dim, off } = props
  const { gone, hatch } = useErasing()
  const sc = usePlanScale()
  return (
    <g opacity={dim('objects')}>
      {v.objects.map((o) => {
        const f = objectFootprint(place, o)
        const counter = productOf(o.product)?.counter
        // A counter in its plates' colour (K6), other furniture in its own
        const col = counter ? plateColor(counterRal(o)) : (idx.byArtnr.get(o.product)?.variant.color ?? 'oklch(0.3 0.004 250)')
        if (!f) return null
        const b = footprintBox(o, f)
        const isBad = bad.has(o.id)
        const sel = selection.objectId === o.id
        const stroke = isBad ? BLOCK : INK
        // A thin ink edge round the furniture's own colour (Bjørn 04.11.2026), red and heavier when colliding; chosen is
        // the plan's halo round it, as for walls, takdrager, textile and shelves (Bjørn 12.11.2026)
        const sw = isBad ? Math.max(0.06, linePx(sc, 2)) : linePx(sc, 0.75)
        const halo = { fill: 'none', stroke: INK, strokeWidth: outlineHalo(sc) }
        const g = gone('object', o.id)
        const op = off(mainGroupOf(productOf(o.product)?.group)) ? DIMMED : undefined
        // A drawn counter (K7): each piece, stroked first and filled over, so only its outline shows
        if (counter && o.pieces) {
          const rects = pieceRects(o).map((r) => ({ x: r.x0 / 1000, y: r.y0 / 1000, w: (r.x1 - r.x0) / 1000, h: (r.y1 - r.y0) / 1000 }))
          const each = (props: object) => rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} {...props} />)
          return (
            <g key={o.id}>
              <g transform={`translate(${o.x} ${o.y}) rotate(${o.rot})`} opacity={op}>
                {/* One halo over the pieces of an L, not darker where they overlap */}
                {sel && <g opacity={HALO_OPACITY}>{each(halo)}</g>}
                {each({ fill: col, stroke, strokeWidth: 2 * sw })}
                {each({ fill: col, fillOpacity: g ? GONE_FILL : undefined })}
                {g && each({ fill: hatch })}
              </g>
              <CounterPlates b={counterBuildOf(o)} at={o} width={linePx(sc, 1.2)} opacity={op} />
            </g>
          )
        }
        const shape = (fill: string, props: object) =>
          f.round ? (
            <circle cx={o.x} cy={o.y} r={f.w / 2} fill={fill} {...props} />
          ) : (
            <rect x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} rx={0.03} fill={fill} {...props} />
          )
        return (
          <g key={o.id}>
            {sel && shape('none', { ...halo, strokeOpacity: HALO_OPACITY })}
            {shape(col, { stroke, strokeWidth: sw, opacity: op, fillOpacity: g ? GONE_FILL : undefined, style: { cursor: tool === 'select' && f.round ? 'move' : undefined } })}
            {g && shape(hatch, {})}
            {counter && <CounterPlates b={counterBuildOf(o, counter)} at={o} width={linePx(sc, 1.2)} opacity={op} />}
          </g>
        )
      })}
    </g>
  )
}

