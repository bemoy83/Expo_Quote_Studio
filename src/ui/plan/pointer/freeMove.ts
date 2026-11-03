// Velg on a free-standing textile wall: drag moves it, release selects it.
import { moveFreeTextile } from '../../../domain/textile/free'
import { rules } from '../../env'
import type { DragHandlers } from './types'

export const freeMove: DragHandlers<'freeMove'> = {
  move(c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 0.15) return
    if (!d.moved) c.onCheckpoint()
    d.moved = true
    const next = moveFreeTextile(d.v0, rules, d.id, q.x - d.p0.x, q.y - d.p0.y)
    if (next) c.onEdit(() => next, false)
  },
  up(c, d) {
    c.onSelect(d.select)
  },
}
