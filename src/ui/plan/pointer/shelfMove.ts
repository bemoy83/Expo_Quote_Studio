// Velg on a shelf (Bjørn 9.11.2026: tools to move and copy): a drag takes it and the shelves chosen with it (its row)
// felt by felt along the wall face under the pointer, also onto another wall or face; with Alt held a copy goes there
// and the shelves stay. Heights are kept. Where they cannot stand (Byggeregler H4–H6) they stay where they last could.
// A plain click selects as any click does.

import { placeShelves } from '../../../domain/shelves'
import { rules } from '../../env'
import type { DragHandlers } from './types'

export const shelfMove: DragHandlers<'shelfMove'> = {
  move(c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 0.15) return
    if (!d.moved) c.onCheckpoint()
    d.moved = true
    const h = c.hits.faceHit(q, 0.6)
    if (!h) return
    const r = placeShelves(d.v0, rules, d.ids, d.anchor, { wallId: h.w.id, s: h.s, module: h.module }, d.copy)
    const a = d.v0.shelves?.find((x) => x.id === d.anchor)
    const home = a && h.w.id === a.wallId && h.module === a.module && h.s === d.start.side
    if (r) {
      c.onEdit(() => r.v, false)
      d.select = { wallId: h.w.id, side: h.s, shelfId: r.ids[d.ids.indexOf(d.anchor)], shelfOnly: d.start.shelfOnly }
    } else if (home) {
      // Back where it started: the sketch as it was
      c.onEdit(() => d.v0, false)
      d.select = d.start
    }
  },
  up(c, d) {
    if (d.moved) c.onSelect(d.select)
    else c.clickSelect(d.select)
  },
}
