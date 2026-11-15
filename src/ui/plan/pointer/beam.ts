// Velg on a drawn takdrager: drag moves it by whole metres, Shift + drag (or «Fin» on in its pill) across it in
// 50 mm steps off the grid (Byggeregel T15) and along it in half metres (T8), a plain click selects it.
import { dragBeam } from '../../drag'
import type { DragHandlers } from './types'

export const beam: DragHandlers<'beam'> = {
  move(c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 0.03) return
    if (!d.moved && !d.fine && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 0.1) return
    d.moved = true
    dragBeam(d, q, c.standardRuns, c.onEdit, c.onCheckpoint)
  },
  up(c, d) {
    if (!d.moved) c.clickSelect(d.select)
  },
}
