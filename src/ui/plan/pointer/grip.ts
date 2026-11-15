// A grip of what is chosen dragged (plan/grips.ts; Byggeregel K14 for Disker og podier): the plan shows what a release
// stores (plan/next.ts), with what goes away hatched; the release stores it, or says why not. A press that does not move
// does nothing: what is chosen stays chosen.
import { GRIP_MOVE } from '../../../domain/grips'
import { dragGrip, type GripOn } from '../grips'
import type { PlanSelection } from '../selection'
import type { Drag, DragHandlers, P, PointerCtx } from './types'

export type GripDrag = Extract<Drag, { kind: 'grip' }>

/** A press on a grip of what is chosen, if there is one under q; with a pen, only one of the kind that pen shows
 *  (`only`: Disker og podier shows a counter's). */
export function startGrip(c: Pick<PointerCtx, 'hits' | 'fine'>, q: P, only?: GripOn['type']): Drag | null {
  const g = c.hits.gripAt(q)
  return g && (!only || g.on.type === only) ? gripPress(c, g.on, q) : null
}

/** A press that takes hold of `on` at q; `select`: what a click there (no drag) selects instead. */
export function gripPress(c: Pick<PointerCtx, 'fine'>, on: GripOn, q: P, select?: PlanSelection): GripDrag {
  return { kind: 'grip', on, p0: q, moved: false, fine: c.fine, ...(select && { select }) }
}

/** What the drag stores with the pointer at q. */
export const gripDrawAt = (c: Pick<PointerCtx, 'v'>, d: GripDrag, q: P) => dragGrip(c.v, d.on, [d.p0.x, d.p0.y], [q.x, q.y], d.fine)

export const grip: DragHandlers<'grip'> = {
  move(_c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > GRIP_MOVE) d.moved = true
  },
  up(c, d, q) {
    // A click: what was pressed is selected (a room's side: its wall or door), else what is chosen stays chosen
    if (!d.moved) return d.select && c.clickSelect(d.select)
    const r = gripDrawAt(c, d, q)
    if (!r) return
    if ('error' in r) return c.onToast(r.error)
    if (r.v !== c.v) c.onEdit(() => r.v)
    if (r.toast) c.onToast(r.toast)
  },
}
