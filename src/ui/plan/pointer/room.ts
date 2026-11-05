// Velg on a room: its floor moves it, a side resizes it. It settles on release.
import type { Room } from '../../../domain/types'
import { dragRoom, dropRoom, roomDrag, type RoomDrag } from '../../drag'
import type { PlanSelection } from '../selection'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

export function startRoom(c: PointerCtx, room: Room, mode: RoomDrag['mode'], q: P, select: PlanSelection | null): Drag {
  return { kind: 'room', ...roomDrag(room.id, mode, q, c.v), select }
}

export const room: DragHandlers<'room'> = {
  move(c, d, q) {
    dragRoom(d, q, c.onEdit, c.onCheckpoint)
  },
  up(c, d) {
    dropRoom(d, c.onEdit, c.onToast)
    // A room moved by its floor stays selected; a resized side selects only on a plain click
    if (!d.select) return
    if (!d.moved) c.clickSelect(d.select)
    else if (d.mode === 'move') c.onSelect(d.select)
  },
}
