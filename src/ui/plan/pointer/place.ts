// Doors, decals and furniture: press shows, release stores (docs/forhandsvisning.md). The press shows the phantom; the
// release stores it if the pointer still hits the same target (module, panel field or textile face, or a spot for the
// furniture); dragging away or Esc cancels. The store itself is the click each pen had before (opening.ts, decor.ts,
// object.ts), so a release on an invalid target still gives its toast as a fallback.
import { addObject } from '../../../domain/objects'
import { faceOfPoint, freeTextileAt } from '../../../domain/textile/free'
import { textileAt } from '../../../domain/textile/inFrame'
import { place } from '../../env'
import { decorClick } from './decor'
import { objectClick } from './object'
import { openingClick, openingEdge } from './opening'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

export type PlaceWhat = 'opening' | 'decor' | 'object'

const CLICK: Record<PlaceWhat, (c: PointerCtx, q: P) => void> = { opening: openingClick, decor: decorClick, object: objectClick }

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
  return brush?.kind === 'object' && addObject(v, place, brush.product, q.x, q.y) ? 'spot' : 'none'
}

export const startPlace = (c: PointerCtx, what: PlaceWhat, q: P): Drag => ({ kind: 'place', what, key: placeKey(c, what, q) })

export const placeDrag: DragHandlers<'place'> = {
  up(c, d, q) {
    if (placeKey(c, d.what, q) === d.key) CLICK[d.what](c, q)
  },
}
