// Velg on a drawn takdrager: drag moves it by whole metres, a plain click selects it.
import { dragInnerBeam } from '../../drag'
import type { DragHandlers } from './types'

export const beam: DragHandlers<'beam'> = {
  move(c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 0.1) return
    d.moved = true
    dragInnerBeam(d, q, c.standardRuns, c.onEdit, c.onCheckpoint)
  },
  up(c, d) {
    if (!d.moved) c.clickSelect({ beamId: d.id })
  },
}
