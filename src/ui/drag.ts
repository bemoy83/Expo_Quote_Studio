// Drag steps shared by the plan and the 3D view, so both move walls and furniture the same way.
import { moveWall } from '../domain/edit'
import { moveInnerBeam, type Run } from '../domain/innerBeams'
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
  /** Whole metres moved so far, sideways and along the wall ("side,along"). */
  delta: string
  horizontal: boolean
}

/** Move an inner wall to whole metres under the pointer, both ways when it stands free, else only sideways. Past the
 *  stand's edge (or onto a stand wall) it stops at the last place it fits. One undo step per drag. */
export function dragWall(d: WallDrag, q: { x: number; y: number }, onEdit: Edit, onCheckpoint: () => void) {
  dragStep(d, q, (v, s, a) => moveWall(v, d.id, s, a), onEdit, onCheckpoint)
}

/** Move a drawn takdrager the same way, both ways; it stops at the last place it fits (domain/innerBeams.ts). */
export function dragInnerBeam(d: WallDrag, q: { x: number; y: number }, standard: readonly Run[], onEdit: Edit, onCheckpoint: () => void) {
  dragStep(d, q, (v, s, a) => moveInnerBeam(v, d.id, s, a, standard), onEdit, onCheckpoint)
}

/** The furthest whole-metre step toward the pointer that `move` accepts (it returns v when not), sideways first. */
function dragStep(d: WallDrag, q: { x: number; y: number }, move: (v: Variant, side: number, along: number) => Variant, onEdit: Edit, onCheckpoint: () => void) {
  const side = Math.round(d.horizontal ? q.y - d.p0.y : q.x - d.p0.x)
  const along = Math.round(d.horizontal ? q.x - d.p0.x : q.y - d.p0.y)
  const toward0 = (n: number) => Array.from({ length: Math.abs(n) + 1 }, (_, i) => Math.sign(n) * (Math.abs(n) - i))
  let next = d.v0
  let key = '0,0'
  search: for (const s of toward0(side)) {
    for (const a of toward0(along)) {
      const v = move(d.v0, s, a)
      if (v !== d.v0) {
        next = v
        key = `${s},${a}`
        break search
      }
    }
  }
  if (key === d.delta) return
  if (d.delta === '0,0') onCheckpoint()
  d.delta = key
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
