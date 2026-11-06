// A plain click in Velg (press and release without moving), and the click rules (docs/pille-og-skuff.md): a click
// selects what lies under the pointer and the pill shows at once, a second click on the selected object lets go of it,
// and a click on empty floor lets go. There is no double click, so there is no timing to wait for. While the drawer is
// open a click on the selected object keeps it (the drawer follows the selection). A drag never lets go of the
// selection: the drag kinds call `onSelect` when moved.
import { selectionKey, type PlanSelection } from '../selection'
import type { DragHandlers } from './types'

export const click: DragHandlers<'click'> = {
  up(c, d) {
    c.clickSelect(d.select)
  },
}

/** What a plain click on `s` selects: nothing when `s` is already selected (and its drawer is closed), else `s`. */
export function clickSelection(selection: PlanSelection, s: PlanSelection, drawerOpen?: boolean): PlanSelection {
  const key = selectionKey(s)
  return key && !drawerOpen && key === selectionKey(selection) ? {} : s
}
