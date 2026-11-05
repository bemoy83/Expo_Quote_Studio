// The door and curtain pen: a door or curtain in the wall module under the pointer; on an empty edge it draws its own
// wall. A door also turns the way the pointer is dragged before release (place.ts, domain/doors.ts placeOpening).
import type { Module } from '../../../domain/grid'
import { doorAllowed } from '../../../domain/walls'
import { placeOpening } from '../../../domain/doors'
import { productOf } from '../../env'
import { nearestEdge } from '../geometry'
import type { P, PointerCtx } from './types'

/** The wall module or empty stand edge the pen would act on. */
export function openingEdge(c: Pick<PointerCtx, 'v' | 'hits'>, q: P) {
  return c.hits.moduleAt(q, 0.4) ?? (c.hits.onStand(q) ? nearestEdge(c.v.stand, q) : null)
}

/** A door, not a curtain: it has a swing side and a hinge end. */
export const isDoor = (product: string) => productOf(product)?.opening === 'door'

/** Put the pen's door or curtain in module e, a door turned toward the pointer at q (null: the defaults). */
export function openingAt(c: PointerCtx, e: Module, q: P | null) {
  const { brush } = c
  if (brush?.kind !== 'opening') return
  if (!doorAllowed(c.v, e.a, e.b)) return c.onToast('Dører og forheng kan ikke stå i standveggen')
  const product = brush.product
  c.onEdit((x) => placeOpening(x, e.a, e.b, product, isDoor(product), q))
}
