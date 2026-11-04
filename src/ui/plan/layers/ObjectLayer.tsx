// Furniture in the plan.
import { mainGroupOf } from '../../../catalog/groups'
import { footprintBox } from '../../../domain/objects'
import type { Variant } from '../../../domain/types'
import { BLOCK, INK } from '../../colors'
import { idx, productOf } from '../../env'
import type { Layer, Tool } from '../../tools'
import type { PlanSelection } from '../selection'
import { DIMMED } from '../planStyle'
import { GONE, useErasing } from './erasing'

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
  return (
    <g opacity={dim('objects')}>
      {v.objects.map((o) => {
        const f = productOf(o.product)?.footprint
        const col = idx.byArtnr.get(o.product)?.variant.color ?? 'oklch(0.3 0.004 250)'
        if (!f) return null
        const b = footprintBox(o, f)
        const isBad = bad.has(o.id)
        const sel = selection.objectId === o.id
        const stroke = isBad ? BLOCK : INK
        const sw = isBad ? 0.06 : sel ? 0.05 : 0.018
        const g = gone('object', o.id)
        const op = g ? GONE : off(mainGroupOf(productOf(o.product)?.group)) ? DIMMED : undefined
        const shape = (fill: string, props: object) =>
          f.round ? (
            <circle cx={o.x} cy={o.y} r={f.w / 2} fill={fill} {...props} />
          ) : (
            <rect x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} rx={0.03} fill={fill} {...props} />
          )
        return (
          <g key={o.id}>
            {shape(col, { stroke, strokeWidth: sw, opacity: op, style: { cursor: tool === 'select' && f.round ? 'move' : undefined } })}
            {g && shape(hatch, {})}
          </g>
        )
      })}
    </g>
  )
}
