// Velg on a free-standing textile wall: drag moves it with what it is joined to (Byggeregel M2), release selects it.
import { moveTextileGroup } from '../../../domain/joints'
import { rules } from '../../env'
import type { DragHandlers } from './types'

export const freeMove: DragHandlers<'freeMove'> = {
  move(c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 0.15) return
    if (!d.moved) c.onCheckpoint()
    d.moved = true
    const next = moveTextileGroup(d.v0, rules, d.id, q.x - d.p0.x, q.y - d.p0.y, c.fine)
    if (next) c.onEdit(() => next, false)
  },
  up(c, d) {
    if (d.moved) c.onSelect(d.select)
    else c.clickSelect(d.select)
  },
}
