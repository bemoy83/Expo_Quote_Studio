// Drag steps shared by the plan and the 3D view, so both move walls and furniture the same way.
import { moveWall } from '../domain/edit'
import { furthest } from '../domain/grips'
import { moveInnerBeam, shiftInnerBeam, type Run } from '../domain/innerBeams'
import { settleAll, settleObject } from '../domain/objects'
import { moveRoomDoors, resizeRoomDoors, sideIsHorizontal } from '../domain/rooms'
import { CELL } from '../domain/outline'
import type { Variant } from '../domain/types'
import { place, rules } from './env'

type Edit = (fn: (v: Variant) => Variant, history?: boolean) => void

export interface WallDrag {
  id: string
  p0: { x: number; y: number }
  /** The variant when the drag started; every step moves the wall from here. */
  v0: Variant
  /** Steps moved so far, sideways and along the wall ("side,along"). */
  delta: string
  horizontal: boolean
  /** Shift held or «Fin» on: an inner wall moves in 250 steps instead of whole metres (Byggeregel V7, V9). */
  fine?: boolean
  /** «Fin» on when the drag started (3D, where Shift is read per move). */
  fineLock?: boolean
  /** «Løsne» on the chosen wall, or Alt held: the wall moves alone, out of its group (Byggeregel M5). */
  loose?: boolean
}

/** Move an inner wall to whole metres under the pointer (250 with Shift or «Fin», Byggeregel V7), both ways when it
 *  stands free, else only sideways. Past the stand's edge (or onto a stand wall) it stops at the last place it fits.
 *  One undo step per drag. */
export function dragWall(d: WallDrag, q: { x: number; y: number }, onEdit: Edit, onCheckpoint: () => void) {
  dragStep(d, q, (v, s, a) => moveWall(v, d.id, s, a, rules, d.loose), onEdit, onCheckpoint, d.fine ? CELL : 1)
}

/** Move a drawn takdrager, plan and 3D alike: whole metres, or with Shift or «Fin» (`d.fine`) 50 mm across and half
 *  metres along (Byggeregler T8, T15). */
export function dragBeam(d: WallDrag, q: { x: number; y: number }, standard: readonly Run[], onEdit: Edit, onCheckpoint: () => void) {
  ;(d.fine ? dragInnerBeamFine : dragInnerBeam)(d, q, standard, onEdit, onCheckpoint)
}

/** Move a drawn takdrager the same way, both ways; it stops at the last place it fits (domain/innerBeams.ts). */
function dragInnerBeam(d: WallDrag, q: { x: number; y: number }, standard: readonly Run[], onEdit: Edit, onCheckpoint: () => void) {
  dragStep(d, q, (v, s, a) => moveInnerBeam(v, d.id, s, a, standard), onEdit, onCheckpoint)
}

/** Shift + dra, or «Fin» on in the pill (Byggeregel T15): move a drawn takdrager across its direction in 50 mm steps,
 *  off the 1 m grid, and along it in half metres (T8); a whole metre puts it back on the grid. Where it would not fit
 *  it stays at the last place it did. */
function dragInnerBeamFine(d: WallDrag, q: { x: number; y: number }, standard: readonly Run[], onEdit: Edit, onCheckpoint: () => void) {
  const off = d.horizontal ? q.y - d.p0.y : q.x - d.p0.x
  const along = d.horizontal ? q.x - d.p0.x : q.y - d.p0.y
  const next = shiftInnerBeam(d.v0, d.id, off, standard, along)
  const key = next === d.v0 ? d.delta : `f${Math.round(off * 20)},${Math.round(along * 2)}`
  if (key === d.delta) return
  if (d.delta === '0,0') onCheckpoint()
  d.delta = key
  onEdit(() => next, false)
}

/** The furthest step (`step` m, whole metres by default) toward the pointer that `move` accepts (it returns v when
 *  not), sideways first. */
function dragStep(d: WallDrag, q: { x: number; y: number }, move: (v: Variant, side: number, along: number) => Variant, onEdit: Edit, onCheckpoint: () => void, step = 1) {
  const side = Math.round((d.horizontal ? q.y - d.p0.y : q.x - d.p0.x) / step)
  const along = Math.round((d.horizontal ? q.x - d.p0.x : q.y - d.p0.y) / step)
  const m = (n: number) => Math.round(n * step * 1000) / 1000
  // Sideways first: a wall that cannot go along still goes across (domain/grips.ts)
  const r = furthest(side, along, (s, a) => {
    const v = move(d.v0, m(s), m(a))
    return v !== d.v0 ? v : null
  })
  const next = r?.value ?? d.v0
  const key = r ? `${m(r.a)},${m(r.b)}` : '0,0'
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
  /** Steps applied so far ("dx,dy" or the side's delta, m). */
  last: string
  /** Shift held or «Fin» on in the room's pill (`fineLock`): 250 steps instead of whole metres (Byggeregel R5). */
  fine?: boolean
  fineLock?: boolean
  moved: boolean
  /** A door had to move to another module of the room to stay out of the stand walls (said on release). */
  doorsMoved?: boolean
}

/** A room drag starting at p0 on the variant v0. */
export const roomDrag = (id: string, mode: RoomDrag['mode'], p0: { x: number; y: number }, v0: Variant, fineLock = false): RoomDrag => {
  const room = v0.rooms.find((r) => r.id === id)
  return {
    fineLock,
    fine: fineLock,
    id,
    mode,
    horizontal: mode !== 'move' && !!room && sideIsHorizontal(room, mode),
    p0,
    v0,
    last: mode === 'move' ? '0,0' : '0',
    moved: false,
  }
}

/** Move a room or one of its sides by whole metres under the pointer, or 250 with `fine` (R5): a room off the metre
 *  lines keeps its offset in whole metres. A blocked step keeps the last good one. */
export function dragRoom(d: RoomDrag, q: { x: number; y: number }, onEdit: Edit, onCheckpoint: () => void) {
  const step = d.fine ? CELL : 1
  const snap = (n: number) => Math.round(n / step) * step
  const dx = snap(q.x - d.p0.x)
  const dy = snap(q.y - d.p0.y)
  const along = d.horizontal ? dy : dx
  const key = d.mode === 'move' ? `${dx},${dy}` : `${along}`
  if (key === d.last) return
  const zero = d.mode === 'move' ? !dx && !dy : !along
  const r = d.mode === 'move' ? moveRoomDoors(d.v0, d.id, dx, dy) : resizeRoomDoors(d.v0, d.id, d.mode, along, step)
  const next = r.v
  if (next === d.v0 && !zero) return
  d.doorsMoved = r.doorsMoved
  if (!d.moved) onCheckpoint()
  d.moved = true
  d.last = key
  onEdit(() => next, false)
}

/** End of a room drag: furniture it pushed into is moved clear where possible, and a door that had to move is told. */
export function dropRoom(d: RoomDrag, onEdit: Edit, onToast: (text: string) => void) {
  if (!d.moved) return
  onEdit((x) => settleAll(x, place), false)
  if (d.doorsMoved) onToast('Døren ble flyttet, den kan ikke stå i standveggen')
}
