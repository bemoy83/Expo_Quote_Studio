// Velg on an inner wall: drag moves it by whole metres, a plain click selects it (a wall dragged away is not selected).
import { dragWall } from '../../drag'
import type { DragHandlers } from './types'
import { goneFrom } from './moved'

export const wall: DragHandlers<'wall'> = {
  move(c, d, q) {
    if (!goneFrom(d, q, 0.1)) return
    dragWall(d, q, c.onEdit, c.onCheckpoint)
  },
  up(c, d) {
    if (!d.moved) c.clickSelect(d.select)
  },
}
