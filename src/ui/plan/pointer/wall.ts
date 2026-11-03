// Velg on an inner wall: drag moves it by whole metres, a plain click selects it (a wall dragged away is not selected).
import { dragWall } from '../../drag'
import type { DragHandlers } from './types'

export const wall: DragHandlers<'wall'> = {
  move(c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 0.1) return
    d.moved = true
    dragWall(d, q, c.onEdit, c.onCheckpoint)
  },
  up(c, d) {
    if (!d.moved) c.onSelect(d.select)
  },
}
