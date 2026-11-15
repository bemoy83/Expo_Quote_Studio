// Velg on a room's floor: it moves the room, settled on release. A side or corner resizes it through the room's grips
// (grip.ts, plan/grips.ts, R5).
import type { Room } from '../../../domain/types'
import { dragRoom, dropRoom, roomDrag } from '../../drag'
import type { PlanSelection } from '../selection'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

export function startRoom(c: PointerCtx, room: Room, q: P, select: PlanSelection): Drag {
  // «Fin» on in the room's pill: 250 steps (R5), kept on the selection the drag ends with
  const fineLock = c.selection.roomId === room.id && !!c.selection.roomFine
  const keep = fineLock ? { ...select, roomFine: true } : select
  return { kind: 'room', ...roomDrag(room.id, 'move', q, c.v, fineLock), select: keep }
}

export const room: DragHandlers<'room'> = {
  move(c, d, q) {
    dragRoom(d, q, c.onEdit, c.onCheckpoint)
  },
  up(c, d) {
    dropRoom(d, c.onEdit, c.onToast)
    // A room moved by its floor stays selected; a click goes by the click rules
    if (!d.moved) c.clickSelect(d.select)
    else c.onSelect(d.select)
  },
}
