// Velg: what a press grabs. The first hit wins: a side of the selected room, a free-standing textile wall, furniture, a
// drawn takdrager, a wall, a room's floor, a lane of engangsteppe, else empty floor. Each selects on release.
import { canMoveWall } from '../../../domain/edit'
import { inFrontOf } from '../../../domain/faces'
import { CELL } from '../../../domain/grid'
import { laneAt } from '../../../domain/floor/edit'
import { OUTSIDE, roomAt } from '../../../domain/rooms'
import { faceOfPoint, freeTextileAt } from '../../../domain/textile/free'
import { textileAt } from '../../../domain/textile/inFrame'
import type { PlanSelection } from '../selection'
import { startRoom } from './room'
import type { Drag, P, PointerCtx } from './types'

export function startSelect(c: PointerCtx, q: P): Drag {
  const { v, selection, hits } = c
  const { width: W, depth: D } = v.stand
  // A plain click on a door or curtain chooses it (the wall drawer with the door); a drag does what it does on the wall.
  const door = hits.moduleAt(q)?.opening
  const doorSelect: PlanSelection | null = door ? { openingId: door.id } : null
  // A side of the selected room comes first, so a side shared with a stand wall can still be dragged.
  const selEdge = selection.roomId ? hits.roomEdgeAt(q) : null
  if (selEdge && selEdge.room.id === selection.roomId) return startRoom(c, selEdge.room, selEdge.side, q, doorSelect)
  const ft = freeTextileAt(v, q, 0.15)
  if (ft) return { kind: 'freeMove', id: ft.id, p0: q, v0: v, moved: false, select: { freeTextileId: ft.id, freeFace: faceOfPoint(ft, q) } }
  const o = hits.objectAt(q)
  if (o) return { kind: 'object', id: o.id, dx: q.x - o.x, dy: q.y - o.y, start: { x: o.x, y: o.y }, moved: false, select: { objectId: o.id } }
  const ib = hits.beamAt(q)
  if (ib) return { kind: 'beam', id: ib.id, p0: q, v0: v, delta: '0,0', horizontal: ib.from[1] === ib.to[1], moved: false }
  const m = hits.moduleAt(q)
  if (m) {
    const w = v.walls.find((x) => x.id === m.wallId)!
    const h = hits.faceHit(q)
    // A textile wall is picked outside the wall's own band (hits.onWallBand), on its own side only: behind a stand wall
    // (its outside has no face) the wall is picked
    const tx = h && !hits.onWallBand(q, m) && inFrontOf(w, h.s, q) ? textileAt(v, w.id, h.s, h.t) : undefined
    // A room's wall opens on its outside, so print does not land inside the room unnoticed (Bjørn 2.11.2026)
    const select: PlanSelection = doorSelect ?? (tx && h ? { wallId: w.id, side: h.s, textileId: tx.id } : { wallId: w.id, side: w.room ? OUTSIDE : h?.s })
    // A room's own wall resizes the room; an inner wall moves
    const room = w.room && v.rooms.find((r) => r.id === w.room!.id)
    if (room) return startRoom(c, room, w.room!.side, q, select)
    if (canMoveWall(w)) return { kind: 'wall', id: w.id, p0: q, v0: v, delta: '0,0', horizontal: w.from[1] === w.to[1], moved: false, select }
    return { kind: 'click', select }
  }
  const room = roomAt(v, q.x, q.y)
  if (room) return startRoom(c, room, 'move', q, { roomId: room.id })
  // Engangsteppe: a fill is chosen as a whole, a lane placed on its own by itself
  const lt = q.x >= 0 && q.y >= 0 && q.x < W && q.y < D ? laneAt(v, Math.floor(q.x / CELL), Math.floor(q.y / CELL)) : undefined
  if (lt) return { kind: 'click', select: lt.fill ? { fill: lt.fill } : { lane: { i: lt.i, j: lt.j } } }
  return { kind: 'click', select: {} }
}
