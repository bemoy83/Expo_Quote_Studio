// The counter pen (Disker, Byggeregler K7, K8): a click places the counter in stock where it has room, as before; a
// drag draws a counter along the stroke in half metres, or on from the end of one (longer in line, an L back toward the
// staff). The plan shows what a release stores while dragging (plan/next.ts).
import { drawCounter } from '../../../domain/counters'
import { addObject } from '../../../domain/objects'
import { isCounter, place } from '../../env'
import { placedBy } from '../../tools'
import { objectClick } from './object'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

/** A press that moves this far (m) draws instead of placing. */
export const COUNTER_DRAG = 0.1

export function startCounter(q: P): Drag {
  return { kind: 'counter', p0: q, moved: false }
}

/** What a drag from p0 to q with the pen in hand draws: on free floor from the counter in stock a click at p0 shows. */
export function counterDraw(c: Pick<PointerCtx, 'v' | 'brush'>, p0: P, q: P) {
  const pen = placedBy(c.brush)
  if (!pen) return null
  const click = addObject(c.v, place, pen.product, p0.x, p0.y, pen.ral)?.objects.at(-1)
  return drawCounter(c.v, place, isCounter, pen, [p0.x, p0.y], [q.x, q.y], click ? [click.x, click.y] : undefined)
}

export const counter: DragHandlers<'counter'> = {
  move(_c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > COUNTER_DRAG) d.moved = true
  },
  up(c, d, q) {
    if (!d.moved) return c.hits.onStand(d.p0) ? objectClick(c, d.p0) : undefined
    const r = counterDraw(c, d.p0, q)
    if (!r) return
    if ('error' in r) return c.onToast(r.error)
    if (r.v === c.v) return
    c.onEdit(() => r.v)
    c.onSelect({ objectId: r.id })
  },
}
