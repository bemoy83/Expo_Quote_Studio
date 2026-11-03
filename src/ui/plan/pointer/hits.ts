// What lies under the pointer, in model coordinates: wall modules, faces, drawn beams, room sides and furniture. Shared
// by the pointer handlers and the plan's cursor and hover previews.
import { innerBeamAt } from '../../../domain/innerBeams'
import { footprintBox } from '../../../domain/objects'
import { roomSideAt } from '../../../domain/rooms'
import { faceAt } from '../../../domain/faces'
import { wallDirection, wallLength } from '../../../domain/grid'
import type { Room, Variant } from '../../../domain/types'
import type { BuiltModule } from '../../../domain/walls'
import { productOf } from '../../env'
import { distToSegment } from '../geometry'
import type { FaceHit } from '../layers/Previews'
import type { PlanSelection } from '../selection'
import type { P } from './types'

export function planHits(v: Variant, mods: BuiltModule[], selection: PlanSelection) {
  const { width: W, depth: D } = v.stand
  /** On the stand, or just outside its edge (where its edge walls are drawn). */
  const onStand = (q: P) => q.x > -0.4 && q.y > -0.4 && q.x < W + 0.4 && q.y < D + 0.4
  const moduleAt = (q: P, within = 0.3): BuiltModule | null => {
    let best: BuiltModule | null = null
    let bd = within
    for (const m of mods) {
      const d = distToSegment(q, m.a, m.b)
      if (d < bd) {
        bd = d
        best = m
      }
    }
    return best
  }
  /** A drawn takdrager under the pointer, unless a wall is closer (a beam can end on a wall). */
  const beamAt = (q: P) => (moduleAt(q, 0.12) ? undefined : innerBeamAt(v, q))

  /** The wall face under the pointer. */
  const faceHit = (q: P, within = 0.4): FaceHit | null => {
    const m = moduleAt(q, within)
    if (!m) return null
    const w = v.walls.find((x) => x.id === m.wallId)!
    const [dx, dy] = wallDirection(w)
    const L = wallLength(w)
    const t = Math.max(0, Math.min(L, (q.x - w.from[0]) * dx + (q.y - w.from[1]) * dy))
    return { w, s: faceAt(v, w, q), t, module: Math.min(Math.floor(t), L - 1) }
  }

  /** The side of a room under the pointer: its own walls always, any side of the selected room. */
  const roomEdgeAt = (q: P): { room: Room; side: number } | null => {
    const m = moduleAt(q, 0.2)
    const w = m && v.walls.find((x) => x.id === m.wallId)
    if (w?.room) {
      const room = v.rooms.find((r) => r.id === w.room!.id)
      if (room) return { room, side: w.room.side }
    }
    const sel = v.rooms.find((r) => r.id === selection.roomId)
    return (sel && roomSideAt({ ...v, rooms: [sel] }, q.x, q.y, 0.2)) ?? null
  }

  const objectAt = (q: P) =>
    [...v.objects].reverse().find((o) => {
      const f = productOf(o.product)?.footprint
      if (!f) return false
      const b = footprintBox(o, f)
      return q.x >= b.x0 && q.x <= b.x1 && q.y >= b.y0 && q.y <= b.y1
    })

  return { onStand, moduleAt, beamAt, faceHit, roomEdgeAt, objectAt }
}

export type PlanHits = ReturnType<typeof planHits>
