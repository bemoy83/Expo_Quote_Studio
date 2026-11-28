// Velg: what a press grabs. The first hit wins: a side of the selected room, a link or grip of the chosen counter (K15, K14), a free-standing textile wall, furniture, a
// shelf, a drawn takdrager, a wall, a room's floor, a lane of engangsteppe, else empty floor. Each selects on release.
import { canMoveWall } from '../../../domain/edit'
import { inFrontOf, sideOf } from '../../../domain/faces'
import { CELL } from '../../../domain/grid'
import { laneAt } from '../../../domain/floor/edit'
import { roomAt } from '../../../domain/rooms'
import { OUTSIDE } from '../../../domain/roomKeys'
import { faceOfPoint, freeTextileAt } from '../../../domain/textile/free'
import { textileAt } from '../../../domain/textile/inFrame'
import { chosenShelves, type PlanSelection } from '../selection'
import { shelfRow } from '../../../domain/shelves/model'
import { gripPress, startGrip } from './grip'
import { startPodiumLink } from './podiumLink'
import { startRoom } from './room'
import { nearestSide } from '../podiumDrawer/podiumView'
import { wallDrag } from '../../drag'
import { wallCorners } from '../../../domain/textile/cornerJoin'

/** How near a 92LTX between frames on walls a press picks it, m: about the post and the frames' ends at it. */
const CORNER_HIT = 0.08
import type { Drag, P, PointerCtx } from './types'

export function startSelect(c: PointerCtx, q: P): Drag {
  const { v, selection, hits } = c
  const { width: W, depth: D } = v.stand
  // The wall module under the pointer, if any
  const m = hits.moduleAt(q)
  // A plain click on a door or curtain chooses it (the wall drawer with the door); a drag does what it does on the wall.
  const door = m?.opening
  const doorSelect: PlanSelection | null = door ? { openingId: door.id } : null
  // A grip of what is chosen (a corner or side of the selected room, R5; of the chosen counter, K14), or a link of the
  // counter (K15), comes before the thing itself, which would move
  const grip = startPodiumLink(c, q) ?? startGrip(c, q)
  if (grip) return grip
  // Anywhere along a side of the selected room takes hold of that side's grip, so a side shared with a stand wall can
  // still be dragged; a click selects the wall or door there
  const selEdge = selection.roomId ? hits.roomEdgeAt(q) : null
  if (selEdge && selEdge.room.id === selection.roomId) return roomSide(c, selEdge.room.id, selEdge.side, q, doorSelect)
  // A corner between frames on walls, its 92LTX or where it was let go (X7, M5): its own pill
  const corner = wallCorners(v).find((k) => Math.hypot(k.at[0] - q.x, k.at[1] - q.y) <= CORNER_HIT)
  if (corner) return { kind: 'click', select: { corner: corner.at } }
  const ft = freeTextileAt(v, q, 0.15)
  // «Løsne» (M5) stays on while the same textile wall is chosen
  const looseFt = !!ft && !!selection.loose && selection.textileId === ft.id
  if (ft) return { kind: 'freeMove', id: ft.id, p0: q, v0: v, moved: false, loose: looseFt, select: { textileId: ft.id, face: faceOfPoint(ft, q), ...(looseFt && { loose: true }) } }
  const o = hits.objectAt(q)
  // A counter of Disker og podier: the side clicked is the one its drawer shows (trinn 2)
  const side = o?.sections ? nearestSide(o, [q.x, q.y]) : undefined
  if (o) return { kind: 'object', id: o.id, dx: q.x - o.x, dy: q.y - o.y, start: { x: o.x, y: o.y }, moved: false, select: { objectId: o.id, ...(side && { podiumSide: side }) } }
  // A shelf on a wall face: the wall drawer on that face, with the shelf and its row chosen. A drag moves them (Alt: copies)
  // Zones as for a textile wall (Bjørn 9.11.2026): the wall's own band picks the wall, the board in front of it the shelf
  const sh = m && hits.onWallBand(q, m) ? undefined : hits.shelfAt(q)
  if (sh) {
    const w = v.walls.find((x) => x.id === sh.wallId)
    const chosen = chosenShelves(v, selection)
    // Pressed on a shelf already chosen: it keeps the choice (its row, or only it); else its row
    const keep = chosen.includes(sh.id)
    const ids = keep ? chosen : shelfRow(v, sh.id).map((x) => x.id)
    const select: PlanSelection = { wallId: sh.wallId, side: sideOf(v, sh), shelfId: sh.id, shelfOnly: keep ? selection.shelfOnly : undefined }
    if (w) return { kind: 'shelfMove', anchor: sh.id, ids, p0: q, v0: v, moved: false, copy: false, start: select, select }
  }
  const ib = hits.beamAt(q)
  if (ib) {
    // «Fin» on (ui/fine.tsx): every drag of it goes in 50 mm steps (touch has no Shift)
    return { kind: 'beam', ...wallDrag(ib, q, v, c.fine), select: { beamId: ib.id } }
  }
  if (m) {
    const w = v.walls.find((x) => x.id === m.wallId)!
    const h = hits.faceHit(q)
    // A textile wall is picked outside the wall's own band (hits.onWallBand), on its own side only: behind a stand wall
    // (its outside has no face) the wall is picked
    const tx = h && !hits.onWallBand(q, m) && inFrontOf(w, h.s, q) ? textileAt(v, w.id, h.s, h.t) : undefined
    // A room's wall opens on its outside, so print does not land inside the room unnoticed (Bjørn 2.11.2026)
    const select: PlanSelection = doorSelect ?? (tx && h ? { wallId: w.id, side: h.s, textileId: tx.id } : { wallId: w.id, side: w.room ? OUTSIDE : h?.s })
    // A textile wall on it: dragged off the wall or along it (Byggeregel X13)
    if (tx && h) return { kind: 'textileOff', id: tx.id, p0: q, v0: v, moved: false, select }
    // A room's own wall resizes the room; an inner wall moves
    const room = w.room && v.rooms.find((r) => r.id === w.room!.id)
    if (room) return roomSide(c, room.id, w.room!.side, q, select)
    const loose = !!selection.loose && selection.wallId === w.id && !selection.textileId && !tx
    if (canMoveWall(w)) return { kind: 'wall', ...wallDrag(w, q, v, c.fine), loose, select: loose ? { ...select, loose } : select }
    return { kind: 'click', select }
  }
  const room = roomAt(v, q.x, q.y)
  if (room) return startRoom(c, room, q, { roomId: room.id })
  // Engangsteppe: a fill is chosen as a whole, a lane placed on its own by itself
  const lt = q.x >= 0 && q.y >= 0 && q.x < W && q.y < D ? laneAt(v, Math.floor(q.x / CELL), Math.floor(q.y / CELL)) : undefined
  if (lt) return { kind: 'click', select: lt.fill ? { fill: lt.fill } : { lane: { i: lt.i, j: lt.j } } }
  return { kind: 'click', select: {} }
}

/** A press on a side of a room: its side grip (R5), a click selecting `select` (the wall or door there). */
const roomSide = (c: PointerCtx, id: string, side: number, q: P, select: PlanSelection | null): Drag =>
  gripPress(c, { type: 'room', id, grip: { kind: 'side', side } }, q, select ?? undefined)
