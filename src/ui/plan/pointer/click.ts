// A plain click in Velg (press and release without moving) selects what lies under the pointer, and a click on empty
// floor lets go (docs/pille-og-skuff.md). A click on what is already selected keeps it, so there is no timing to wait
// for and the pill shows at once; the drawer opens from Mer in the pill. A drag never lets go of the selection.
import type { DragHandlers } from './types'

export const click: DragHandlers<'click'> = {
  up(c, d) {
    c.clickSelect(d.select)
  },
}
