// The door and curtain pen: a door or curtain in the wall module under the pointer; on an empty edge it draws its own
// wall. A door also turns the way the pointer is dragged before release (place.ts, domain/doors.ts placeOpening).
import { CELL, moduleKey, offsetAlong, pointAlong, wallLength, type Module } from '../../../domain/grid'
import { doorBlocked } from '../../../domain/walls'
import { placeOpening, swingBlocked } from '../../../domain/doors'
import { floorBoxes, productOf } from '../../env'
import { nearestEdge } from '../geometry'
import type { P, PointerCtx } from './types'

/** The wall module or empty stand edge the pen would act on. With `fine` (Shift or «Fin») on a wall: the 1000 module
 *  centred on the pointer in 250 steps along the wall, off its modules too (Byggeregel D8). */
export function openingEdge(c: Pick<PointerCtx, 'v' | 'hits'>, q: P, fine = false): Module | null {
  const m = c.hits.moduleAt(q, 0.4)
  if (m && fine) {
    const w = c.v.walls.find((x) => x.id === m.wallId)
    const L = w ? wallLength(w) : 0
    if (w && L >= 1) {
      const t = Math.max(0, Math.min(L - 1, Math.round((offsetAlong(w, q) - 0.5) / CELL) * CELL))
      const a = pointAlong(w, t)
      const b = pointAlong(w, t + 1)
      return { key: moduleKey(a, b), a, b, orientation: a[1] === b[1] ? 'h' : 'v', cc: 1 }
    }
  }
  return m ?? (c.hits.onStand(q) ? nearestEdge(c.v.stand, q) : null)
}

/** A door, not a curtain: it has a swing side and a hinge end. */
export const isDoor = (product: string) => productOf(product)?.opening === 'door'

/** Put the pen's door or curtain in module e, a door turned toward the pointer at q (null: the defaults). */
export function openingAt(c: PointerCtx, e: Module, q: P | null) {
  const { brush } = c
  if (brush?.kind !== 'opening') return
  const { product, ral, fabric } = brush
  // A door also needs 1 m² free floor on a side it can swing to (Byggeregel D7)
  const why = doorBlocked(c.v, e.a, e.b) ?? (isDoor(product) ? swingBlocked(c.v, e.a, e.b, floorBoxes) : null)
  if (why) return c.onToast(why)
  c.onEdit((x) => placeOpening(x, e.a, e.b, product, isDoor(product), q, { ral, fabric, floor: floorBoxes }))
}
