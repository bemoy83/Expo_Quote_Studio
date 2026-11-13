// A grip of the chosen counter of Disker og podier dragged (Byggeregel K14): the plan shows what a release stores
// (plan/next.ts), with what goes away hatched; the release stores it, or says why not. A press that does not move does
// nothing: the counter stays chosen.
import { gripPodium } from '../../../domain/podiumGrips'
import { place } from '../../env'
import type { Drag, DragHandlers, P, PointerCtx } from './types'

/** A press on a grip of the chosen counter, if there is one under q. */
export function startPodiumGrip(c: Pick<PointerCtx, 'hits'>, q: P): Drag | null {
  const g = c.hits.podiumGripAt(q)
  return g ? { kind: 'podiumGrip', id: g.o.id, grip: g.grip, p0: q, moved: false, fine: false } : null
}

/** What the drag stores with the pointer at q. */
export function podiumGripAt(c: Pick<PointerCtx, 'v'>, d: Extract<Drag, { kind: 'podiumGrip' }>, q: P) {
  const o = c.v.objects.find((x) => x.id === d.id)
  return o ? gripPodium(c.v, place, o, d.grip, [d.p0.x, d.p0.y], [q.x, q.y], d.fine) : null
}

export const podiumGrip: DragHandlers<'podiumGrip'> = {
  move(_c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > 0.03) d.moved = true
  },
  up(c, d, q) {
    if (!d.moved) return
    const r = podiumGripAt(c, d, q)
    if (!r) return
    if ('error' in r) return c.onToast(r.error)
    c.onEdit(() => r.v)
  },
}
