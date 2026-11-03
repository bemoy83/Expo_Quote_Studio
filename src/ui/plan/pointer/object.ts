// Furniture: the object pen places one, Velg drags it (it settles on release) and selects it.
import { addObject, moveObject } from '../../../domain/objects'
import { place, productOf } from '../../env'
import { dropObject } from '../../drag'
import type { DragHandlers, P, PointerCtx } from './types'

/** A click with the object pen: place the product here. */
export function objectClick(c: PointerCtx, q: P) {
  const { v, brush } = c
  if (brush?.kind !== 'object') return
  const product = brush.product
  const next = addObject(v, place, product, q.x, q.y)
  if (!next) c.onToast(`Ikke plass til ${productOf(product)?.name.toLowerCase() ?? 'varen'} her`)
  else c.onEdit(() => next)
}

export const object: DragHandlers<'object'> = {
  move(c, d, q) {
    if (!d.moved) {
      if (Math.hypot(q.x - d.dx - d.start.x, q.y - d.dy - d.start.y) < 0.03) return
      d.moved = true
      c.onCheckpoint()
    }
    c.onEdit((x) => moveObject(x, place, d.id, q.x - d.dx, q.y - d.dy), false)
  },
  up(c, d) {
    if (d.moved) dropObject(c.v, d.id, d.start, c.onEdit, c.onToast)
    c.onSelect(d.select)
  },
}
