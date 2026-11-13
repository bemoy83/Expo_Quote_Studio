// A link of the chosen counter of Disker og podier clicked (Byggeregel K15): a joint breaks, the counter becoming two
// standing against each other; a counter standing against it is linked into it. A press that moves does nothing.
import { breakJoint, fusePodiums } from '../../../domain/podiumLinks'
import { place } from '../../env'
import type { Drag, DragHandlers, P, PointerCtx } from './types'

/** A press on a link of the chosen counter, if there is one under q. */
export function startPodiumLink(c: Pick<PointerCtx, 'hits'>, q: P): Drag | null {
  const l = c.hits.podiumLinkAt(q)
  return l ? { kind: 'podiumLink', id: l.o.id, link: l, p0: q, moved: false } : null
}

export const podiumLink: DragHandlers<'podiumLink'> = {
  move(_c, d, q) {
    if (Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > 0.03) d.moved = true
  },
  up(c, d) {
    if (d.moved) return
    const l = d.link
    const r = l.kind === 'joint' ? breakJoint(c.v, place, d.id, l.joint) : fusePodiums(c.v, place, d.id, l.id)
    if ('error' in r) return c.onToast(r.error)
    c.onEdit(() => r.v)
    c.onSelect({ objectId: d.id })
  },
}
