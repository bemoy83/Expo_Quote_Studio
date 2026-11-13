// Doors, decals and furniture: release stores (docs/forhandsvisning.md). The plan already shows the result dimmed while
// hovering and pressed (plan/next.ts); the release stores it if the pointer still hits the same target (module, panel
// field or textile face, or a spot for the furniture; a door may be dragged out to where its leaf swings, which turns
// it); dragging away or Esc cancels. The store itself is the click each pen had before (opening.ts, decor.ts,
// object.ts), so a release on an invalid target still gives its toast as a fallback.
import { addObject } from '../../../domain/objects'
import { faceOfPoint, freeTextileAt } from '../../../domain/textile/free'
import { textileAt } from '../../../domain/textile/inFrame'
import { inDoorArea } from '../../../domain/doors'
import { place, rules } from '../../env'
import { placedBy } from '../../tools'
import { decorClick } from './decor'
import { objectClick } from './object'
import { isDoor, openingAt, openingEdge } from './opening'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

export type PlaceWhat = 'opening' | 'decor' | 'object'

const CLICK: Record<Exclude<PlaceWhat, 'opening'>, (c: PointerCtx, q: P) => void> = { decor: decorClick, object: objectClick }

/** What the pen would act on at q, as a key: a release stores only on the same key as the press. */
export function placeKey(c: Pick<PointerCtx, 'v' | 'hits' | 'brush'>, what: PlaceWhat, q: P): string {
  const { v, hits, brush } = c
  if (what === 'opening') return openingEdge(c, q)?.key ?? 'none'
  if (what === 'decor') {
    const ft = brush?.kind === 'motif' ? freeTextileAt(v, q, 0.15) : undefined
    if (ft) return `ft:${ft.id}:${faceOfPoint(ft, q)}`
    const h = hits.faceHit(q)
    if (!h) return 'none'
    const tx = textileAt(v, h.w.id, h.s, h.t)
    return tx ? `tx:${tx.id}` : `felt:${h.w.id}:${h.s}:${h.module}`
  }
  // Furniture follows the pointer while pressed: the same as long as it stays on the stand and has a spot
  if (!hits.onStand(q)) return 'off'
  const pen = placedBy(brush)
  return pen && addObject(v, place, pen.product, q.x, q.y) ? 'spot' : 'none'
}

export function startPlace(c: PointerCtx, what: PlaceWhat, q: P): Drag {
  const module = what === 'opening' ? (openingEdge(c, q) ?? undefined) : undefined
  const door = what === 'opening' && c.brush?.kind === 'opening' && isDoor(c.brush.product)
  return { kind: 'place', what, key: placeKey(c, what, q), module, door }
}

/**
 * Still on the press's target at q. A door may be dragged out to either side to pick its swing and hinge: it holds
 * while the pointer is in the area its leaf can swing in. Anything else holds while the key is the same.
 */
export function placeHolds(c: Pick<PointerCtx, 'v' | 'hits' | 'brush'>, d: Extract<Drag, { kind: 'place' }>, q: P): boolean {
  if (d.door && d.module) return inDoorArea(d.module.a, d.module.b, q, rules.door.swing)
  return placeKey(c, d.what, q) === d.key
}

export const placeDrag: DragHandlers<'place'> = {
  up(c, d, q) {
    if (!placeHolds(c, d, q)) return
    if (d.what === 'opening') return d.module && openingAt(c, d.module, d.door ? q : null)
    CLICK[d.what](c, q)
  },
}
