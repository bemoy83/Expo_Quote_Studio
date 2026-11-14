// What lies under the pointer, in model coordinates: wall modules, faces, drawn beams, room sides, furniture and shelves. Shared
// by the pointer handlers and the plan's cursor and hover previews.
import { innerBeamAt } from '../../../domain/innerBeams'
import { objectBoxes } from '../../../domain/objects'
import { podiumGrips } from '../../../domain/podiumGrips'
import { podiumLinks } from '../../../domain/podiumLinks'
import { roomSideAt } from '../../../domain/rooms'
import { shelfBox, shelvesOf } from '../../../domain/shelves/model'
import { faceAt } from '../../../domain/faces'
import { moduleCount, offsetAlong } from '../../../domain/grid'
import type { PlacedObject, Point, Room, Variant } from '../../../domain/types'
import type { BuiltModule } from '../../../domain/walls'
import { place, rules } from '../../env'
import { sizePx, type PlanScale } from '../planScale'
import { wallWidth } from '../planStyle'
import { distToSegment } from '../geometry'
import type { FaceHit } from '../layers/Previews'
import type { PlanSelection } from '../selection'
import type { P } from './types'

/** How near a grip of the chosen counter (K14) the pointer takes hold of it, screen px: a finger's width across. */
export const GRIP_HIT_PX = 16

/** Half the wall's own band across its line in Velg, screen px at least: wide enough for a finger between two textiles. */
const WALL_BAND_PX = 5

/**
 * `scale`: the plan's scale as of this render, for the bands measured in screen px. A getter, as the plan learns its
 * scale only after the pointer hook has given it its svg.
 */
export function planHits(v: Variant, mods: BuiltModule[], selection: PlanSelection, scale?: () => PlanScale | undefined) {
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
    const t = offsetAlong(w, q)
    return { w, s: faceAt(v, w, q), t, module: Math.min(Math.floor(t), moduleCount(w) - 1) }
  }

  /**
   * On the wall's own band (Velg, Bjørn 6.11.2026): across a wall with textile walls on its faces the middle picks the
   * wall and the strip outside each face the textile there. The band is the wall as drawn, at least 2 × WALL_BAND_PX.
   */
  const onWallBand = (q: P, m: BuiltModule) => {
    const sc = scale?.()
    const half = sc ? Math.max(wallWidth(sc) / 2 + sizePx(sc, 1), sizePx(sc, WALL_BAND_PX)) : 0.05
    return distToSegment(q, m.a, m.b) <= half
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
    // By what it covers: the open corner of an L is floor
    [...v.objects].reverse().find((o) => objectBoxes(place, o).some((b) => q.x >= b.x0 && q.x <= b.x1 && q.y >= b.y0 && q.y <= b.y1))

  /** A shelf under the pointer, by its board; of shelves stacked in one felt, the lowest (the drawer has the rest). */
  const shelfAt = (q: P) =>
    shelvesOf(v)
      .filter((f) => {
        const b = shelfBox(v, rules, f)
        return !!b && q.x >= b.x0 && q.x <= b.x1 && q.y >= b.y0 && q.y <= b.y1
      })
      .sort((a, b) => a.y - b.y)[0]

  const chosenPodium = () => {
    const o = selection.objectId ? v.objects.find((x) => x.id === selection.objectId) : undefined
    return o?.sections ? o : undefined
  }
  const gripReach = () => {
    const sc = scale?.()
    return sc ? sizePx(sc, GRIP_HIT_PX) : 0.15
  }

  /** A link of the chosen counter of Disker og podier under the pointer (Byggeregel K15), the nearest. */
  /** Of things drawn at `at`, the one nearest q within a grip's reach, with the counter it belongs to. */
  const nearestOf = <T extends { at: Point }>(o: PlacedObject, items: T[], q: P): (T & { o: PlacedObject }) | null => {
    let bd = gripReach()
    let best: T | null = null
    for (const x of items) {
      const d = Math.hypot(q.x - x.at[0], q.y - x.at[1])
      if (d < bd) [bd, best] = [d, x]
    }
    return best && { ...best, o }
  }

  const podiumLinkAt = (q: P) => {
    const o = chosenPodium()
    return o ? nearestOf(o, podiumLinks(v, o), q) : null
  }

  /** A grip of the chosen counter of Disker og podier under the pointer (Byggeregel K14), the nearest; a link there
   *  comes first (K15). */
  const podiumGripAt = (q: P) => {
    const o = chosenPodium()
    return o && !podiumLinkAt(q) ? nearestOf(o, podiumGrips(o), q) : null
  }

  return { onStand, moduleAt, beamAt, faceHit, onWallBand, roomEdgeAt, objectAt, shelfAt, podiumGripAt, podiumLinkAt }
}

export type PlanHits = ReturnType<typeof planHits>
