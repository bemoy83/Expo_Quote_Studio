// Velg on a free-standing textile wall: drag moves it with what it is joined to (Byggeregel M2), parallel to a system
// wall within the magnet mounts it there (X13); release selects it.
import { sideOf } from '../../../domain/faces'
import { dragFreeTextile } from '../../drag'
import type { DragHandlers } from './types'
import { goneFrom } from './moved'
import { wallTextiles } from '../../../domain/textile/mounts'

export const freeMove: DragHandlers<'freeMove'> = {
  move(c, d, q) {
    if (!goneFrom(d, q, 0.15, c.onCheckpoint)) return
    dragFreeTextile(d, q, c.onEdit)
  },
  up(c, d) {
    const t = d.mounted ? wallTextiles(c.v).find((x) => x.id === d.mounted) : undefined
    if (t) return c.onSelect({ wallId: t.wallId, side: sideOf(c.v, t), textileId: t.id })
    if (d.moved) c.onSelect(d.select)
    else c.clickSelect(d.select)
  },
}
