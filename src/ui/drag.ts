// Drag steps shared by the plan and the 3D view, so both move walls and furniture the same way.
import { moveWall } from '../domain/edit'
import { settleAll, settleObject } from '../domain/objects'
import { moveRoom, resizeRoom, sideIsHorizontal } from '../domain/rooms'
import type { Variant } from '../domain/types'
import { place } from './env'

type Edit = (fn: (v: Variant) => Variant, history?: boolean) => void

export interface WallDrag {
  id: string
  p0: { x: number; y: number }
  /** The variant when the drag started; every step moves the wall from here. */
  v0: Variant
  /** Whole metres moved so far. */
  delta: number
  horizontal: boolean
}

/** Move an inner wall to whole metres under the pointer. One undo step per drag. */
export function dragWall(d: WallDrag, q: { x: number; y: number }, onEdit: Edit, onCheckpoint: () => void) {
  const delta = Math.round(d.horizontal ? q.y - d.p0.y : q.x - d.p0.x)
  if (delta === d.delta) return
  const next = moveWall(d.v0, d.id, delta)
  if (next === d.v0 && delta !== 0) return
  if (d.delta === 0) onCheckpoint()
  d.delta = delta
  onEdit(() => next, false)
}

/** Drop a dragged object: keep it where it is, or move it back to `start` when it does not fit. */
export function dropObject(v: Variant, id: string, start: { x: number; y: number }, onEdit: Edit, onToast: (text: string) => void) {
  const r = settleObject(v, place, id, start)
  if (r.v !== v) onEdit(() => r.v, false)
  if (!r.ok) onToast('Ikke plass der')
}

export interface RoomDrag {
  id: string
  /** Move the whole room, or drag one side (its number, see outline.ts). */
  mode: 'move' | number
  /** A dragged side runs left–right, so it follows the pointer's y. */
  horizontal: boolean
  p0: { x: number; y: number }
  /** The variant when the drag started; every step works from here. */
  v0: Variant
  /** Whole metres applied so far ("dx,dy" or the side's delta). */
  last: string
  moved: boolean
}

/** A room drag starting at p0 on the variant v0. */
export const roomDrag = (id: string, mode: RoomDrag['mode'], p0: { x: number; y: number }, v0: Variant): RoomDrag => {
  const room = v0.rooms.find((r) => r.id === id)
  return {
    id,
    mode,
    horizontal: mode !== 'move' && !!room && sideIsHorizontal(room, mode),
    p0,
    v0,
    last: mode === 'move' ? '0,0' : '0',
    moved: false,
  }
}

/** Move a room or one of its sides to whole metres under the pointer. A blocked step keeps the last good one. */
export function dragRoom(d: RoomDrag, q: { x: number; y: number }, onEdit: Edit, onCheckpoint: () => void) {
  const dx = Math.round(q.x - d.p0.x)
  const dy = Math.round(q.y - d.p0.y)
  const along = d.horizontal ? dy : dx
  const key = d.mode === 'move' ? `${dx},${dy}` : `${along}`
  if (key === d.last) return
  const zero = d.mode === 'move' ? !dx && !dy : !along
  const next = d.mode === 'move' ? moveRoom(d.v0, d.id, dx, dy) : resizeRoom(d.v0, d.id, d.mode, along)
  if (next === d.v0 && !zero) return
  if (!d.moved) onCheckpoint()
  d.moved = true
  d.last = key
  onEdit(() => next, false)
}

/** End of a room drag: furniture it pushed into is moved clear where possible. */
export function dropRoom(d: RoomDrag, onEdit: Edit) {
  if (!d.moved) return
  onEdit((x) => settleAll(x, place), false)
}
