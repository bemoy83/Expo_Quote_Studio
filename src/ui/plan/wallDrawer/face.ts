// The wall face the wall drawer shows: what it is called, and which rooms stand against it.
import { roomAt } from '../../../domain/rooms'
import { OUTSIDE } from '../../../domain/roomKeys'
import { wallModules } from '../../../domain/grid'
import type { Point, Room, Variant, Wall } from '../../../domain/types'
import { isStandWall } from '../../../domain/walls'
import { faceNormal, type FaceSide } from '../../../domain/faces'

/** A room standing against a stretch of a wall face, from module `a` to module `b` (exclusive). */
export interface RoomRun {
  room: Room
  a: number
  b: number
}

/**
 * Rooms whose floor lies right in front of this face of the wall, as runs of modules: the wall is (part of) that room's
 * wall seen from inside. The wall's own room is left out (that is the whole face).
 */
export function roomsAgainst(v: Variant, w: Wall, s: FaceSide): RoomRun[] {
  const [nx, ny] = faceNormal(w, s)
  const runs: RoomRun[] = []
  wallModules(w).forEach((m, i) => {
    const r = roomAt(v, (m.a[0] + m.b[0]) / 2 + nx / 2, (m.a[1] + m.b[1]) / 2 + ny / 2)
    if (!r || r.id === w.room?.id) return
    const last = runs[runs.length - 1]
    if (last && last.room.id === r.id && last.b === i) last.b = i + 1
    else runs.push({ room: r, a: i, b: i + 1 })
  })
  return runs
}

/** Face names by where the face looks. */
export function faceName(w: Wall, s: FaceSide): string {
  if (w.room) return s === OUTSIDE ? 'Utsiden' : 'Innsiden'
  const [nx, ny] = faceNormal(w, s)
  if (ny > 0) return 'Mot front'
  if (ny < 0) return 'Mot bak'
  return nx > 0 ? 'Mot høyre' : 'Mot venstre'
}


/**
 * The heading over the wall drawing (docs/arbeidstegning.md, «Veggrisset»): the wall's name, the face it shows, and
 * where each end of the drawing points in the stand, «Venstre · sett innenfra · ← front   bakkant →».
 */
export function elevationHeading(w: Wall, s: FaceSide, name: string): { title: string; left: string; right: string } {
  const view = isStandWall(w) ? 'sett innenfra' : faceName(w, s).toLowerCase()
  // The drawing's left end is the wall's from end when face 1 is shown (WallElevation: u(t))
  const [l, r] = s === 1 ? [w.from, w.to] : [w.to, w.from]
  const end = (p: Point, q: Point) => (p[1] === q[1] ? (p[0] < q[0] ? 'venstre' : 'høyre') : p[1] < q[1] ? 'bakkant' : 'front')
  return { title: `${name} · ${view}`, left: end(l, r), right: end(r, l) }
}
