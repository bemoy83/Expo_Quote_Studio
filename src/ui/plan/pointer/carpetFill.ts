// Fyll with rolled floor: drag an area (a click fills the stand), the engine lays it the cheapest way on release.
import { fillCarpet } from '../../../domain/floor/rollFill'
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
    const rect = d.moved ? rectOf(d.from, c.floor.cellOf(q)) : undefined
    c.setFillRect(null)
    if (brush?.kind === 'floor' && rollWidth) {
      const product = brush.product
      c.onEdit((x) => fillCarpet(x, product, rollWidth, pricing.carpet, rect))
    }
  },
}
