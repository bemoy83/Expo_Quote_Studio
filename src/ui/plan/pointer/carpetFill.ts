// The carpet brush (rolled floor): drag an area and the engine lays it the cheapest way on release; a click recolours
// the lane under it or fills the free floor (carpetClick).
import { carpetClick, fillCarpet } from '../../../domain/floor/rollFill'
import { pricing } from '../../env'
import { rectOf } from './floorBrush'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

export function startCarpetFill(c: PointerCtx, q: P): Drag | undefined {
  if (!c.hits.onStand(q)) return
  return { kind: 'carpetFill', from: c.floor.cellOf(q), moved: false }
}

export const carpetFill: DragHandlers<'carpetFill'> = {
  move(c, d, q) {
    const cell = c.floor.cellOf(q)
    if (!d.moved && cell.i === d.from.i && cell.j === d.from.j) return
    d.moved = true
    c.setFillRect(rectOf(d.from, cell))
  },
  up(c, d, q) {
    const { brush } = c
    const { rollWidth } = c.floor
    c.setFillRect(null)
    if (brush?.kind !== 'floor' || !rollWidth) return
    const product = brush.product
    if (!d.moved) return c.onEdit((x) => carpetClick(x, product, rollWidth, pricing.carpet, [d.from.i, d.from.j]))
    const rect = rectOf(d.from, c.floor.cellOf(q))
    c.onEdit((x) => fillCarpet(x, product, rollWidth, pricing.carpet, rect))
  },
}
