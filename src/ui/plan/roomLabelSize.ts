// Size of the room label (RoomLabel.tsx), for fitting it into a room or onto a wall.
import { roomName, roomSize } from '../../domain/rooms'
import type { Room } from '../../domain/types'

/** The label box at scale 1, with the size line (`two`) or without. Text width estimated from the character count. */
export function roomLabelSize(r: Room, two = true): { w: number; h: number } {
  return { w: Math.max(roomName(r).length * 0.135, two ? roomSize(r).length * 0.125 : 0) + 0.28, h: two ? 0.6 : 0.36 }
}
