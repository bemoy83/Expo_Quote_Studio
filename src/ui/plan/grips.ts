// The grips of what is chosen in the plan, one system for all (Bjørn 15.11.2026, Disker og podier as the model,
// domain/grips.ts): each kind of thing says here where its grips stand and what a drag of one stores. The pointer
// (pointer/grip.ts), the hits (pointer/hits.ts), the preview (next.ts) and the drawing (layers/Grips.tsx) go through
// this file only. To give a new kind of thing grips: add it to GripOn, gripsOf, dragGrip and gripHint.
import type { GripKind } from '../../domain/grips'
import { footprintBox, objectBoxes, objectFootprint, settleAll } from '../../domain/objects'
import { bounds, cellId, cellsOf, CELL } from '../../domain/outline'
import { gripRoom, roomGrips, type RoomGrip } from '../../domain/roomGrips'
import { NO_ROOM } from '../../domain/podiums'
import { gripPodium, podiumGrips, type PodiumGrip } from '../../domain/podiumGrips'
import type { PlacedObject, Point, Variant } from '../../domain/types'
import { place } from '../env'
import { mm } from './dims'
import type { Box } from './nextArea'
import type { PlanSelection } from './selection'

/** What a grip belongs to, and which of its grips it is. */
export type GripOn = { type: 'podium'; id: string; grip: PodiumGrip } | { type: 'room'; id: string; grip: RoomGrip }

/** A grip as the plan shows it: what it moves, its kind (the shape drawn) and where it stands, plan m. */
export interface PlanGrip {
  on: GripOn
  kind: GripKind
  at: Point
}

/** The grips of what is chosen, if it has any: a room (R5) or a counter of Disker og podier (K14). */
export function gripsOf(v: Variant, selection: PlanSelection): PlanGrip[] {
  const r = selection.roomId ? v.rooms.find((x) => x.id === selection.roomId) : undefined
  if (r) return roomGrips(r).map(({ grip, at }) => ({ on: { type: 'room', id: r.id, grip }, kind: grip.kind, at }))
  const o = selection.objectId ? v.objects.find((x) => x.id === selection.objectId) : undefined
  if (!o?.sections) return []
  return podiumGrips(o).map(({ grip, at }) => ({ on: { type: 'podium', id: o.id, grip }, kind: grip.kind, at }))
}

/** The same grip (by what it moves; the place changes while it is dragged). */
export const sameGrip = (a: GripOn, b: GripOn) => JSON.stringify(a) === JSON.stringify(b)

/** What a grip dragged stores: the sketch after, with the size in the pill and what goes away hatched; or why not, with
 *  where it would stand hatched when it has no room. */
export type GripDraw =
  | { v: Variant; key: string; pill: { a: Point; b: Point; text: string }; erased?: Box[]; toast?: string }
  | { error: string; key: string; invalid?: Box }

const boxOf = (o: PlacedObject) => footprintBox(o, objectFootprint(place, o)!)

/** `on` dragged from p0 to q (plan m), in 250 steps with `fine`. Null when what it belongs to is gone. */
export function dragGrip(v: Variant, on: GripOn, p0: Point, q: Point, fine: boolean): GripDraw | null {
  if (on.type === 'room') return dragRoomGrip(v, on, p0, q, fine)
  const o = v.objects.find((x) => x.id === on.id)
  if (!o) return null
  const r = gripPodium(v, place, o, on.grip, p0, q, fine)
  const key = `${'error' in r ? r.error : ''}:${JSON.stringify(r.o)}`
  if ('error' in r) return { error: r.error, key, ...(r.error === NO_ROOM && { invalid: boxOf(r.o) }) }
  const b = boxOf(r.o)
  const erased = r.gone ? objectBoxes(place, r.gone) : undefined
  return { v: r.v, key, pill: { a: [b.x0, b.y1], b: [b.x1, b.y1], text: `${mm(b.x1 - b.x0)} × ${mm(b.y1 - b.y0)}` }, erased }
}

/** A room's grip dragged (R5): furniture it pushes into moved clear, as a release stores it; what the room gives up
 *  hatched, cell by cell; a door that had to move is told on release. */
function dragRoomGrip(v: Variant, on: Extract<GripOn, { type: 'room' }>, p0: Point, q: Point, fine: boolean): GripDraw | null {
  const before = v.rooms.find((x) => x.id === on.id)
  if (!before) return null
  const r = gripRoom(v, on.id, on.grip, p0, q, fine)
  if ('error' in r) return { error: r.error, key: r.error }
  const b = bounds(r.room.outline)
  const kept = new Set(cellsOf(r.room.outline).map(([i, j]) => cellId(i, j)))
  const erased = cellsOf(before.outline)
    .filter(([i, j]) => !kept.has(cellId(i, j)))
    .map(([i, j]) => ({ x0: i * CELL, y0: j * CELL, x1: (i + 1) * CELL, y1: (j + 1) * CELL }))
  return {
    v: r.v === v ? v : settleAll(r.v, place),
    key: JSON.stringify(r.room.outline),
    pill: { a: [b.x, b.y + b.d], b: [b.x + b.w, b.y + b.d], text: `${mm(b.w)} × ${mm(b.d)}` },
    ...(erased.length && { erased }),
    ...(r.doorsMoved && { toast: 'Døren ble flyttet, den kan ikke stå i standveggen' }),
  }
}

/** The hint on a grip, pointed at or held. */
export const gripHint = (on: GripOn) =>
  on.type === 'room'
    ? `Dra for å flytte ${on.grip.kind === 'corner' ? 'hjørnet' : 'siden'} · hele meter, Shift eller Fin 250`
    : 'Dra for å flytte kanten · 500-steg, Shift 250'
