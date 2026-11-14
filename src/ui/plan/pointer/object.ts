// Furniture: the object pen places one, Velg drags it (it settles on release) and selects it. A counter of Disker og
// podier dragged within 300 mm of another lies against it and becomes part of it on release (Byggeregel K15). A loose
// piece of furniture dropped within 300 mm of a set joins it (Bjørn 14.11.2026); a piece of a set drags its set.
import { addObject, joinSet, moveObject, nearSet, placeSet, settleObject } from '../../../domain/objects'
import { fusePodiums, snapBeside } from '../../../domain/podiumLinks'
import { place, productOf } from '../../env'
import { dropObject } from '../../drag'
import { placedBy } from '../../tools'
import type { DragHandlers, P, PointerCtx } from './types'

/** A click with the object pen: place the product here. */
export function objectClick(c: PointerCtx, q: P) {
  const { v, brush } = c
  const pen = placedBy(brush)
  if (!pen) return
  const { product } = pen
  const set = productOf(product)?.set
  const next = set ? placeSet(v, place, set, q.x, q.y) : addObject(v, place, product, q.x, q.y)
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
    c.onEdit((x) => {
      const y = moveObject(x, place, d.id, q.x - d.dx, q.y - d.dy)
      const s = snapBeside(y, place, y.objects.find((o) => o.id === d.id)!)
      d.fuse = s?.onto
      return s ? { ...y, objects: y.objects.map((o) => (o.id === d.id ? s.o : o)) } : y
    }, false)
  },
  up(c, d) {
    if (!d.moved) return c.clickSelect(d.select)
    if (d.fuse) {
      const r = fusePodiums(c.v, place, d.fuse, d.id)
      if (!('error' in r)) {
        c.onEdit(() => r.v, false)
        return c.onSelect({ objectId: r.id })
      }
      c.onToast(r.error)
    }
    const settled = settleObject(c.v, place, d.id, d.start)
    const near = settled.ok ? nearSet(settled.v, place, d.id) : undefined
    if (near) {
      c.onEdit(() => joinSet(settled.v, d.id, near.id), false)
      c.onToast('Lagt til i settet · Løsne i pillen tar den ut igjen')
    } else dropObject(c.v, d.id, d.start, c.onEdit, c.onToast)
    c.onSelect(d.select)
  },
}
