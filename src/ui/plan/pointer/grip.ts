// A grip of what is chosen dragged (plan/grips.ts; Byggeregel K14 for Disker og podier): the plan shows what a release
// stores (plan/next.ts), with what goes away hatched; the release stores it, or says why not. A press that does not move
// does nothing: what is chosen stays chosen.
import { GRIP_MOVE } from '../../../domain/grips'
import { dragGrip } from '../grips'
import type { Drag, DragHandlers, P, PointerCtx } from './types'

export type GripDrag = Extract<Drag, { kind: 'grip' }>

/** A press on a grip of what is chosen, if there is one under q. */
export function startGrip(c: Pick<PointerCtx, 'hits'>, q: P): Drag | null {
  const g = c.hits.gripAt(q)
  return g ? { kind: 'grip', on: g.on, p0: q, moved: false, fine: false } : null
}

/** What the drag stores with the pointer at q. */
export const gripDrawAt = (c: Pick<PointerCtx, 'v'>, d: GripDrag, q: P) => dragGrip(c.v, d.on, [d.p0.x, d.p0.y], [q.x, q.y], d.fine)

export const grip: DragHandlers<'grip'> = {
  move(_c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > GRIP_MOVE) d.moved = true
  },
  up(c, d, q) {
    if (!d.moved) return
    const r = gripDrawAt(c, d, q)
    if (!r) return
    if ('error' in r) return c.onToast(r.error)
    c.onEdit(() => r.v)
  },
}
