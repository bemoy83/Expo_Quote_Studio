// A plain click in Velg (press and release without moving), and the click rules (docs/pille-og-skuff.md): a click
// selects, a second click on the same object lets go of it, a click on empty floor lets go, and a double click opens
// the drawer. A drag never lets go of the selection: the drag kinds call `onSelect` when moved.
import { CLICK_MS, hasDrawer, selectionKey, type PlanSelection } from '../selection'
import type { DragHandlers } from './types'

export const click: DragHandlers<'click'> = {
  up(c, d) {
    c.clickSelect(d.select)
  },
}

/** What the click rules need from the plan: the selection now, and how to select and open the drawer. */
export interface ClickInput {
  selection: PlanSelection
  drawerOpen?: boolean
  onSelect: (s: PlanSelection) => void
  onOpenDrawer?: (s: PlanSelection) => void
}

/**
 * The click rules, with their timing: one per plan. A second click on the same object within CLICK_MS of the first
 * is a double click; a later one lets go of the selection, but only after CLICK_MS, so the browser's own double click
 * (`dblclick`, which allows a slower second click) can still open the drawer instead.
 */
export function clickRules() {
  let last: { key: string; at: number } | null = null
  let pending: ReturnType<typeof setTimeout> | undefined
  const cancel = () => {
    clearTimeout(pending)
    pending = undefined
  }
  const open = (c: ClickInput, s: PlanSelection) => {
    cancel()
    last = null
    if (hasDrawer(s)) c.onOpenDrawer?.(s)
    else c.onSelect(s)
  }
  return {
    click(c: ClickInput, s: PlanSelection, now = performance.now()) {
      cancel()
      const key = selectionKey(s)
      const double = !!key && last?.key === key && now - last.at < CLICK_MS
      last = { key, at: now }
      if (double) return open(c, s)
      // Empty floor, another object, or the selected one while its drawer is open (the drawer follows the selection)
      if (!key || key !== selectionKey(c.selection) || c.drawerOpen) return c.onSelect(s)
      pending = setTimeout(() => {
        pending = undefined
        c.onSelect({})
      }, CLICK_MS)
    },
    /** The browser's double click, on what lies under the pointer. */
    double(c: ClickInput, s: PlanSelection) {
      if (selectionKey(s)) open(c, s)
    },
    cancel,
  }
}
