// The grips of what is chosen in the plan, one system for all (Bjørn 15.11.2026, Disker og podier as the model,
// domain/grips.ts): each kind of thing says here where its grips stand and what a drag of one stores. The pointer
// (pointer/grip.ts), the hits (pointer/hits.ts), the preview (next.ts) and the drawing (layers/Grips.tsx) go through
// this file only. To give a new kind of thing grips: add it to GripOn, gripsOf, dragGrip and gripHint.
import type { GripKind } from '../../domain/grips'
import { footprintBox, objectBoxes, objectFootprint, settleAll } from '../../domain/objects'
import { toPlan } from '../../domain/counterShape'
import { podiumLinks } from '../../domain/podiumLinks'
import { bounds, cellId, cellsOf, CELL, labelRect } from '../../domain/outline'
import { gripRoom, roomGrips, type RoomGrip } from '../../domain/roomGrips'
import { NO_ROOM } from '../../domain/podiums'
import { gripPodium, podiumGrips, type PodiumGrip } from '../../domain/podiumGrips'
import type { PlacedObject, Point, Variant } from '../../domain/types'
import { place } from '../env'
import type { Brush, Tool } from '../tools'
import { mm } from './dims'
import type { Box } from './nextArea'
import type { PlanSelection } from './selection'

/** What a grip belongs to, and which of its grips it is. */
export type GripOn =
  | { type: 'podium'; id: string; grip: PodiumGrip }
  | { type: 'room'; id: string; grip: RoomGrip }
  /** The middle of a room or a piece of furniture (a counter too): moves it, as dragging it in Velg does (Bjørn
   *  15.11.2026: also without Velg). */
  | { type: 'move'; what: 'room' | 'object'; id: string }

/** A grip as the plan shows it: what it moves, its kind (the shape drawn) and where it stands, plan m. */
export interface PlanGrip {
  on: GripOn
  kind: GripKind
  at: Point
}

/** The grips of what is chosen, if it has any: a room (R8), a counter of Disker og podier (K14), a piece of furniture;
 *  each with a move grip in its middle. */
export function gripsOf(v: Variant, selection: PlanSelection): PlanGrip[] {
  const r = selection.roomId ? v.rooms.find((x) => x.id === selection.roomId) : undefined
  if (r) {
    // In the middle of the largest free rectangle, where its name stands: inside the room also for an L
    const l = labelRect(r.outline)
    const move: PlanGrip = { on: { type: 'move', what: 'room', id: r.id }, kind: 'move', at: [l.x + l.w / 2, l.y + l.d / 2] }
    return [...roomGrips(r).map(({ grip, at }): PlanGrip => ({ on: { type: 'room', id: r.id, grip }, kind: grip.kind, at })), move]
  }
  const o = selection.objectId ? v.objects.find((x) => x.id === selection.objectId) : undefined
  if (!o) return []
  const on: GripOn = { type: 'move', what: 'object', id: o.id }
  if (!o.sections) return [{ on, kind: 'move', at: [o.x, o.y] }]
  const grips = podiumGrips(o).map(({ grip, at }): PlanGrip => ({ on: { type: 'podium', id: o.id, grip }, kind: grip.kind, at }))
  return [...grips, { on, kind: 'move', at: counterMiddle(v, o, grips) }]
}

/** Where a counter's move grip stands: on the counter also for an L or a T, as far as it goes from its links (which come
 *  first, K15) and its other grips; the middle of a section or of one of its 500 modules, the first of the furthest. */
function counterMiddle(v: Variant, o: PlacedObject, grips: PlanGrip[]): Point {
  const mid = (a: number, b: number) => (a + b) / 2
  const cells = (a: number, b: number) => Array.from({ length: Math.round((b - a) / 500) }, (_, i) => a + 250 + i * 500)
  const local = o.sections!.flatMap((s) => [
    [mid(...s.x), mid(...s.z)] as Point,
    ...cells(...s.x).flatMap((x) => cells(...s.z).map((z): Point => [x, z])),
  ])
  const near = [...podiumLinks(v, o).map((l) => l.at), ...grips.map((g) => g.at)]
  const room = (p: Point) => Math.min(...near.map((n) => Math.hypot(n[0] - p[0], n[1] - p[1])))
  return local.map((p) => toPlan(o, p)).reduce((best, p) => (room(p) > room(best) + 1e-9 ? p : best))
}

/** Whether a grip is shown and taken with the pen in hand: in Velg all of them; with Disker og podier those of the chosen
 *  counter. */
export function gripWith(on: GripOn, tool: Tool, brush: Brush | null): boolean {
  if (tool === 'select') return true
  if (brush?.kind === 'podium') return on.type === 'podium' || (on.type === 'move' && on.what === 'object')
  return false
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
  // A move grip starts the drag Velg does (pointer/grip.ts), not this one
  if (on.type === 'move') return null
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
  on.type === 'move'
    ? on.what === 'room'
      ? 'Dra for å flytte rommet · hele meter, Shift eller Fin 250'
      : 'Dra for å flytte'
    : on.type === 'room'
    ? `Dra for å flytte ${on.grip.kind === 'corner' ? 'hjørnet' : 'siden'} · hele meter, Shift eller Fin 250`
    : 'Dra for å flytte kanten · 500-steg, Shift 250'
