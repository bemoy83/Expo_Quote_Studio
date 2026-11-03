// The wall face the wall drawer shows: what it is called, and which rooms stand against it.
import { OUTSIDE, roomAt } from '../../../domain/rooms'
import { wallModules } from '../../../domain/grid'
import type { Room, Variant, Wall } from '../../../domain/types'
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

