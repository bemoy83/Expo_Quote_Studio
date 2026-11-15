// The grips of what is chosen in the plan, one system for all (Bjørn 15.11.2026, Disker og podier as the model,
// domain/grips.ts): each kind of thing says here where its grips stand and what a drag of one stores. The pointer
// (pointer/grip.ts), the hits (pointer/hits.ts), the preview (next.ts) and the drawing (layers/Grips.tsx) go through
// this file only. To give a new kind of thing grips: add it to GripOn, gripsOf, dragGrip and gripHint.
import { furthest, stepsOf, turnOf, type GripKind, type RunEnd } from '../../domain/grips'
import { wallGripEnds, stretchWall } from '../../domain/wallEnds'
import { stretchInnerBeam } from '../../domain/innerBeams'
import { BEAM_UNIT } from '../../domain/runDraw'
import { standardRuns } from '../../calc/beams/beams'
import { freeGripEnds, stretchFreeTextile } from '../../domain/textile/free'
import { footprintBox, objectBoxes, objectFootprint, rotateObject, setMembers, settleAll, union } from '../../domain/objects'
import { toPlan } from '../../domain/counterShape'
import { podiumLinks } from '../../domain/podiumLinks'
import { bounds, cellId, cellsOf, CELL, labelRect } from '../../domain/outline'
import { gripRoom, roomGrips, type RoomGrip } from '../../domain/roomGrips'
import { NO_ROOM } from '../../domain/podiums'
import { gripPodium, podiumGrips, type PodiumGrip } from '../../domain/podiumGrips'
import type { PlacedObject, Point, Variant } from '../../domain/types'
import { moduleStart, pointAlong, wallDirection, wallLength } from '../../domain/grid'
import { moveOpeningAlong } from '../../domain/doors'
import { place, rules } from '../env'
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
  /** A free end of a chosen inner wall or free-standing textile wall, or either end of a drawn takdrager: moves along
   *  it (wallEnds.ts, textile/free.ts, innerBeams.ts). */
  | { type: 'end'; what: 'wall' | 'textile' | 'beam'; id: string; end: RunEnd }
  /** Out from the bottom right corner of a piece of furniture or a counter: turns it round its middle, 90° a step, 15° with
   *  Shift or Fin (furniture only; a counter turns by quarters). */
  | { type: 'rotate'; id: string }
  /** The middle of a chosen door or curtain: moves it along its wall, whole metres, 250 with Shift or Fin (Byggeregel D8). */
  | { type: 'door'; id: string }

/** A grip as the plan shows it: what it moves, its kind (the shape drawn) and where it stands, plan m. */
export interface PlanGrip {
  on: GripOn
  kind: GripKind
  at: Point
}

/** The grips of what is chosen, if it has any: a room (R8), a counter of Disker og podier (K14), a piece of furniture;
 *  each with a move grip in its middle. */
export function gripsOf(v: Variant, selection: PlanSelection): PlanGrip[] {
  const door = doorGrip(v, selection)
  if (door) return [door]
  const ends = endGrips(v, selection)
  if (ends) return ends
  const r = selection.roomId ? v.rooms.find((x) => x.id === selection.roomId) : undefined
  if (r) {
    // In the largest free rectangle, inside the room also for an L: under its name, which stands in the middle
    const l = labelRect(r.outline)
    const under = Math.max(0, Math.min(MOVE_UNDER_NAME, l.d / 2 - 0.2))
    const move: PlanGrip = { on: { type: 'move', what: 'room', id: r.id }, kind: 'move', at: [l.x + l.w / 2, l.y + l.d / 2 + under] }
    return [...roomGrips(r).map(({ grip, at }): PlanGrip => ({ on: { type: 'room', id: r.id, grip }, kind: grip.kind, at })), move]
  }
  const o = selection.objectId ? v.objects.find((x) => x.id === selection.objectId) : undefined
  if (!o) return []
  const on: GripOn = { type: 'move', what: 'object', id: o.id }
  const u = turnBox(v, o)
  // A round piece alone looks the same whatever its turn: no turn grip
  const turns = !!o.set || !objectFootprint(place, o)?.round
  const rotate: PlanGrip[] = turns ? [{ on: { type: 'rotate', id: o.id }, kind: 'rotate', at: [u.x1 + ROTATE_OUT, u.y1 + ROTATE_OUT] }] : []
  if (!o.sections) return [{ on, kind: 'move', at: [o.x, o.y] }, ...rotate]
  const grips = podiumGrips(o).map(({ grip, at }): PlanGrip => ({ on: { type: 'podium', id: o.id, grip }, kind: grip.kind, at }))
  return [...grips, { on, kind: 'move', at: counterMiddle(v, o, grips) }, ...rotate]
}

/** The grip of a chosen door or curtain, in the middle of its module on the wall. */
function doorGrip(v: Variant, s: PlanSelection): PlanGrip | null {
  const o = s.openingId ? v.openings.find((x) => x.id === s.openingId) : undefined
  const w = o && v.walls.find((x) => x.id === o.wallId)
  if (!o || !w) return null
  return { on: { type: 'door', id: o.id }, kind: 'move', at: pointAlong(w, moduleStart(w, o.module) + 0.5) }
}

/** The end grips of what is chosen (Byggeregler V13, X12), when it is an inner wall (alone, not a door or felt on it) or a free textile wall;
 *  else null. */
function endGrips(v: Variant, s: PlanSelection): PlanGrip[] | null {
  const wall = s.wallId && !s.openingId && !s.textileId && !s.foilId && !s.shelfId && s.felt === undefined ? v.walls.find((w) => w.id === s.wallId) : undefined
  if (wall) return wallGripEnds(v, wall).map((end): PlanGrip => ({ on: { type: 'end', what: 'wall', id: wall.id, end }, kind: 'end', at: wall[end] }))
  const t = s.freeTextileId ? v.freeTextiles.find((x) => x.id === s.freeTextileId) : undefined
  if (t) return freeGripEnds(v, t).map((end): PlanGrip => ({ on: { type: 'end', what: 'textile', id: t.id, end }, kind: 'end', at: t[end] }))
  // A drawn takdrager: both ends (Byggeregel T8)
  const b = s.beamId ? v.innerBeams?.find((x) => x.id === s.beamId) : undefined
  if (b) return (['from', 'to'] as const).map((end): PlanGrip => ({ on: { type: 'end', what: 'beam', id: b.id, end }, kind: 'end', at: b[end] }))
  return null
}

/** How far under the middle of a room (its name) its move grip stands, plan m, less in a small room. */
const MOVE_UNDER_NAME = 0.5

/** How far out from the box's corner the turn grip stands, each way, plan m. */
const ROTATE_OUT = 0.25

/** The box round what turns with `o`: its set, else itself. */
const turnBox = (v: Variant, o: PlacedObject) => union(setMembers(v, o).flatMap((m) => objectBoxes(place, m)))

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

/** Whether a grip is shown and taken with the pen in hand: in Velg all but the move grip (there the whole thing is one:
 *  a drag of it moves it, and a small piece would hide under it); with Disker og podier those of the chosen counter;
 *  with Vegg those of the chosen room (R8). */
export function gripWith(on: GripOn, tool: Tool, brush: Brush | null): boolean {
  if (tool === 'select') return on.type !== 'move'
  if (brush?.kind === 'opening') return on.type === 'door'
  if (brush?.kind === 'wall') return on.type === 'room' || (on.type === 'move' && on.what === 'room') || (on.type === 'end' && on.what === 'wall')
  if (brush?.kind === 'textile') return on.type === 'end' && on.what === 'textile'
  if (brush?.kind === 'beam') return on.type === 'end' && on.what === 'beam'
  if (brush?.kind === 'podium') return on.type === 'podium' || on.type === 'rotate' || (on.type === 'move' && on.what === 'object')
  return false
}

/** What stays chosen when the pen `b` is picked: what it has grips for (a room for Vegg, a counter for Disker og
 *  podier), else nothing. */
export function keptFor(selection: PlanSelection, b: Brush, v: Variant): PlanSelection {
  if (b.kind === 'wall' && selection.roomId) return { roomId: selection.roomId }
  if (b.kind === 'wall' && selection.wallId) return { wallId: selection.wallId }
  if (b.kind === 'opening' && selection.openingId) return { openingId: selection.openingId }
  if (b.kind === 'textile' && selection.freeTextileId) return { freeTextileId: selection.freeTextileId }
  if (b.kind === 'beam' && selection.beamId) return { beamId: selection.beamId }
  if (b.kind === 'podium' && selection.objectId && v.objects.find((o) => o.id === selection.objectId)?.sections) return { objectId: selection.objectId }
  return {}
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
  if (on.type === 'rotate') return dragTurnGrip(v, on.id, p0, q, fine)
  if (on.type === 'end') return dragEndGrip(v, on, p0, q, fine)
  if (on.type === 'door') return dragDoorGrip(v, on.id, p0, q, fine)
  const o = v.objects.find((x) => x.id === on.id)
  if (!o) return null
  const r = gripPodium(v, place, o, on.grip, p0, q, fine)
  const key = `${'error' in r ? r.error : ''}:${JSON.stringify(r.o)}`
  if ('error' in r) return { error: r.error, key, ...(r.error === NO_ROOM && { invalid: boxOf(r.o) }) }
  const b = boxOf(r.o)
  const erased = r.gone ? objectBoxes(place, r.gone) : undefined
  return { v: r.v, key, pill: { a: [b.x0, b.y1], b: [b.x1, b.y1], text: `${mm(b.x1 - b.x0)} × ${mm(b.y1 - b.y0)}` }, erased }
}

/** The turn grip dragged round the middle of what turns: whole steps of 90°, 15° with Shift or Fin for furniture; the
 *  furthest that has room, else why not. */
function dragTurnGrip(v: Variant, id: string, p0: Point, q: Point, fine: boolean): GripDraw | null {
  const o = v.objects.find((x) => x.id === id)
  if (!o) return null
  const u = turnBox(v, o)
  const step = fine && !o.sections ? 15 : 90
  const n = stepsOf(turnOf([(u.x0 + u.x1) / 2, (u.y0 + u.y1) / 2], p0, q), step)
  const r = furthest(n, 0, (a) => (a ? rotateObject(v, place, id, a * step) : v))
  if (!r || (n && !r.a)) return { error: NO_TURN, key: `${NO_TURN}:${n}` }
  const after = r.value.objects.find((x) => x.id === id)!
  const b = turnBox(r.value, after)
  return { v: r.value, key: `${id}:${after.rot}`, pill: { a: [b.x0, b.y1], b: [b.x1, b.y1], text: `${after.rot}°` } }
}

const NO_TURN = 'Ikke plass til å rotere her'

/** The run an end grip moves: a wall, a free textile wall or a drawn takdrager. */
const runOf = (v: Variant, on: Extract<GripOn, { type: 'end' }>) =>
  on.what === 'wall' ? v.walls.find((w) => w.id === on.id) : on.what === 'textile' ? v.freeTextiles.find((t) => t.id === on.id) : v.innerBeams?.find((b) => b.id === on.id)

/** An end grip dragged along its run: whole metres, 250 with Shift or Fin (500 for a takdrager, T8); the furthest step
 *  that works, else why not. */
function dragEndGrip(v: Variant, on: Extract<GripOn, { type: 'end' }>, p0: Point, q: Point, fine: boolean): GripDraw | null {
  const run = runOf(v, on)
  if (!run) return null
  // Out from the other end is plus
  const len = Math.hypot(run.to[0] - run.from[0], run.to[1] - run.from[1])
  const sign = on.end === 'to' ? 1 : -1
  const along = (sign * ((q[0] - p0[0]) * (run.to[0] - run.from[0]) + (q[1] - p0[1]) * (run.to[1] - run.from[1]))) / len
  const step = fine ? (on.what === 'beam' ? BEAM_UNIT : CELL) : 1
  let why = on.what === 'wall' ? NO_STRETCH : on.what === 'beam' ? NO_BEAM_STRETCH : ''
  const standard = on.what === 'beam' ? standardRuns(v, rules.beam.max) : []
  const at = (d: number): Variant | null => {
    if (on.what === 'wall') return stretchWall(v, on.id, on.end, d)
    if (on.what === 'beam') return stretchInnerBeam(v, on.id, on.end, d, standard)
    const r = stretchFreeTextile(v, rules, on.id, on.end, d)
    if ('error' in r) why = r.error
    return 'error' in r ? null : r.v
  }
  const n = stepsOf(along, step)
  const r = furthest(n, 0, (a) => at(a * step))
  if (!r || (n && !r.a)) return { error: why, key: `${why}:${n}` }
  const after = runOf(r.value, on)!
  const L = Math.hypot(after.to[0] - after.from[0], after.to[1] - after.from[1])
  return { v: r.value, key: `${on.id}:${after.from}:${after.to}`, pill: { a: after.from, b: after.to, text: mm(L) } }
}

/** A door's grip dragged along its wall (Byggeregel D8): whole metres from where it stands, 250 with Shift or Fin; the
 *  furthest step that works, else why not. The pill says how far it stands from the wall's left or back end. */
function dragDoorGrip(v: Variant, id: string, p0: Point, q: Point, fine: boolean): GripDraw | null {
  const o = v.openings.find((x) => x.id === id)
  const w = o && v.walls.find((x) => x.id === o.wallId)
  if (!o || !w) return null
  const [dx, dy] = wallDirection(w)
  const t0 = moduleStart(w, o.module)
  const step = fine ? CELL : 1
  const n = stepsOf((q[0] - p0[0]) * dx + (q[1] - p0[1]) * dy, step)
  const r = furthest(n, 0, (a) => {
    if (!a) return v
    const m = moveOpeningAlong(v, id, t0 + a * step)
    return m === v ? null : m
  })
  if (!r || (n && !r.a)) return { error: NO_DOOR_MOVE, key: `${NO_DOOR_MOVE}:${n}` }
  const after = r.value.openings.find((x) => x.id === id)!
  const aw = r.value.walls.find((x) => x.id === after.wallId)!
  const t = moduleStart(aw, after.module)
  const a = pointAlong(aw, t)
  const b = pointAlong(aw, t + 1)
  // From the left end of a wall running across, the back end of one running back to front
  const back = dx < 0 || dy < 0 ? wallLength(aw) - t - 1 : t
  const from = Math.abs(dy) > 0.5 ? 'bak' : 'venstre'
  return { v: r.value, key: `${id}:${t}`, pill: { a, b, text: `${mm(back)} fra ${from}` } }
}

const NO_DOOR_MOVE = 'Døren kan ikke stå der: veggens ende, en annen dør, hylle, print, tekstil eller standvegg er i veien'

const NO_STRETCH = 'Veggen kan ikke gå dit: en dør, en annen vegg eller standkanten er i veien'

const NO_BEAM_STRETCH = 'Takdrageren kan ikke gå dit: en vegg eller takdrager langs linjen, eller standkanten, er i veien'

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
export const gripHint = (on: GripOn, v?: Variant) =>
  on.type === 'door'
    ? 'Dra for å flytte døren langs veggen · hele meter, Shift eller Fin 250'
    : on.type === 'end'
    ? on.what === 'beam'
      ? 'Dra for å forlenge eller korte takdrageren · hele meter, Shift eller Fin halve meter'
      : `Dra for å forlenge eller korte ${on.what === 'wall' ? 'veggen' : 'tekstilveggen'} · hele meter, Shift eller Fin 250`
    : on.type === 'rotate'
    ? v?.objects.find((o) => o.id === on.id)?.sections
      ? 'Dra for å rotere · 90°'
      : 'Dra for å rotere · 90°, Shift eller Fin 15°'
    : on.type === 'move'
    ? on.what === 'room'
      ? 'Dra for å flytte rommet · hele meter, Shift eller Fin 250'
      : 'Dra for å flytte'
    : on.type === 'room'
    ? `Dra for å flytte ${on.grip.kind === 'corner' ? 'hjørnet' : 'siden'} · hele meter, Shift eller Fin 250`
    : 'Dra for å flytte kanten · 500-steg, Shift 250'
