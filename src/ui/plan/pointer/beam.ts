// Velg on a drawn takdrager: drag moves it by whole metres, Shift + drag (or «Fin» on in its pill) across it in
// 50 mm steps off the grid (Byggeregel T15) and along it in half metres (T8), a plain click selects it.
import { dragBeam } from '../../drag'
import type { DragHandlers } from './types'
import { goneFrom } from './moved'

export const beam: DragHandlers<'beam'> = {
  move(c, d, q) {
    // In 50 mm steps (fine) it takes less to start
    if (!goneFrom(d, q, d.fine ? 0.03 : 0.1)) return
    dragBeam(d, q, c.standardRuns, c.onEdit, c.onCheckpoint)
  },
  up(c, d) {
    if (!d.moved) c.clickSelect(d.select)
  },
}
