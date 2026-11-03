// A press that only selects, on release.
import type { DragHandlers } from './types'

export const click: DragHandlers<'click'> = {
  up(c, d) {
    c.onSelect(d.select)
  },
}
