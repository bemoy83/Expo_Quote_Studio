// Tøm: erase whatever lies on top under the pointer, no pen needed. The smallest thing goes first: graphics before the
// wall or textile wall they sit on, a door before its wall, furniture before the floor. A room goes as a whole. Stand
// walls are locked. A drag erases more of the same kind as the first thing it touched: walls and drawn beams along a
// straight line on the grid (stroke.ts), anything else as the pointer passes over it. The hover (PC) or the press
// (touch) marks what a click takes; the release takes it.
import { removeOpening } from '../../../domain/doors'
import { foilAt, removeFoil } from '../../../domain/decor'
import { faceSegment, felt } from '../../../domain/faces'
import { CELL } from '../../../domain/grid'
import { removeInnerBeam } from '../../../domain/innerBeams'
import { footprintBox, removeObject } from '../../../domain/objects'
import { removeRoom, roomAt } from '../../../domain/rooms'
import { faceOfPoint, freeTextileAt, removeFreeTextile, updateFace } from '../../../domain/textile/free'
import { removeTextile, textileAt, updateTextile } from '../../../domain/textile/inFrame'
import { tileAt } from '../../../domain/floor/tiles'
import type { Point, Variant } from '../../../domain/types'
import { productOf, rules } from '../../env'
import { PLAN_TEXTILE_OFFSET } from '../planStyle'
import type { PlanHits } from './hits'
import { startStroke } from './stroke'
import type { Drag, DragHandlers, P, PointerCtx } from './types'

/** What a click takes, drawn over it in the plan: a line (walls, beams, doors, textiles), a box or an outline. */
export type EraseMark = { kind: 'seg'; a: Point; b: Point; width: number } | { kind: 'box'; x: number; y: number; w: number; h: number } | { kind: 'outline'; points: Point[] }

/** What lies on top under the pointer. `group` is what a drag goes on erasing; `id` tells the things apart. */
export interface EraseTarget {
  group: 'object' | 'graphic' | 'textile' | 'door' | 'room' | 'floor' | 'wall' | 'beam' | 'locked'
  id: string
  mark: EraseMark | null
  erase: (v: Variant) => Variant
}

const seg = (a: Point, b: Point, width: number): EraseMark => ({ kind: 'seg', a, b, width })

export function eraseTargetAt(v: Variant, hits: PlanHits, standKeys: ReadonlySet<string>, q: P): EraseTarget | null {
  // Furniture: exact footprint, so it wins over a wall it stands against
  const o = hits.objectAt(q)
  if (o) {
    const f = productOf(o.product)!.footprint!
    const b = footprintBox(o, f)
    return { group: 'object', id: o.id, mark: { kind: 'box', x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 }, erase: (x) => removeObject(x, o.id) }
  }
  // Free-standing textile wall: the motif on the face clicked first, then the wall
  const ft = freeTextileAt(v, q, 0.15)
  if (ft) {
    const face = faceOfPoint(ft, q)
    const mark = seg(ft.from, ft.to, 0.12)
    if (ft[face]?.motif) return { group: 'graphic', id: `${ft.id}.${face}`, mark, erase: (x) => updateFace(x, ft.id, face, { motif: null }) }
    return { group: 'textile', id: ft.id, mark, erase: (x) => removeFreeTextile(x, ft.id) }
  }
  // Drawn takdrager (not where a wall is closer)
  const ib = hits.beamAt(q)
  if (ib) return { group: 'beam', id: ib.id, mark: seg(ib.from, ib.to, 0.1), erase: (x) => removeInnerBeam(x, ib.id) }
  // On a wall: graphics, the textile wall on the face, the door, the room the wall belongs to, the wall
  const m = hits.moduleAt(q)
  if (m) {
    const h = hits.faceHit(q, 0.3)
    if (h) {
      const tx = textileAt(v, h.w.id, h.s, h.t)
      const f = foilAt(v, rules, h.w.id, h.s, h.t)
      if (f) {
        const fe = felt(rules, f.module)
        const [a, b] = faceSegment(h.w, h.s, fe.a + 0.02, fe.b - 0.02, PLAN_TEXTILE_OFFSET)
        return { group: 'graphic', id: f.id, mark: seg(a, b, 0.1), erase: (x) => removeFoil(x, f.id) }
      }
      if (tx) {
        const [a, b] = faceSegment(h.w, h.s, tx.from + 0.02, tx.from + tx.width - 0.02, PLAN_TEXTILE_OFFSET)
        if (tx.motif) return { group: 'graphic', id: `${tx.id}.motif`, mark: seg(a, b, 0.1), erase: (x) => updateTextile(x, rules, tx.id, { motif: null }) }
        return { group: 'textile', id: tx.id, mark: seg(a, b, 0.1), erase: (x) => removeTextile(x, tx.id) }
      }
    }
    if (m.opening) {
      const id = m.opening.id
      return { group: 'door', id, mark: seg(m.a, m.b, 0.18), erase: (x) => removeOpening(x, id) }
    }
    const w = v.walls.find((x) => x.id === m.wallId)
    const room = w?.room && v.rooms.find((r) => r.id === w.room!.id)
    if (room) return { group: 'room', id: room.id, mark: { kind: 'outline', points: room.outline }, erase: (x) => removeRoom(x, room.id) }
    if (standKeys.has(m.key)) return { group: 'locked', id: m.key, mark: null, erase: (x) => x }
    return { group: 'wall', id: m.key, mark: seg(m.a, m.b, 0.12), erase: (x) => x }
  }
  const room = roomAt(v, q.x, q.y)
  if (room) return { group: 'room', id: room.id, mark: { kind: 'outline', points: room.outline }, erase: (x) => removeRoom(x, room.id) }
  // Floor: the whole tile or lane of engangsteppe under the pointer
  if (q.x < 0 || q.y < 0 || q.x >= v.stand.width || q.y >= v.stand.depth) return null
  const t = tileAt(v.floor.tiles, Math.floor(q.x / CELL), Math.floor(q.y / CELL))
  if (!t) return null
  const same = (x: typeof t) => x.i === t.i && x.j === t.j && x.w === t.w && x.h === t.h
  return {
    group: 'floor',
    id: `${t.i},${t.j},${t.w},${t.h}`,
    mark: { kind: 'box', x: t.i * CELL, y: t.j * CELL, w: t.w * CELL, h: t.h * CELL },
    erase: (x) => ({ ...x, floor: { ...x.floor, tiles: x.floor.tiles.filter((y) => !same(y)) } }),
  }
}

const targetOf = (c: PointerCtx, q: P) => eraseTargetAt(c.v, c.hits, c.standKeys, q)

/** A press with Tøm. Walls and drawn beams go along a straight stroke on the grid; the rest is marked and erased. */
export function startErase(c: PointerCtx, q: P): Drag | undefined {
  const t = targetOf(c, q)
  if (!t) return
  if (t.group === 'wall' || t.group === 'locked') return startStroke(c, q)
  if (t.group === 'beam') return startStroke(c, q, t.id)
  c.setEraseMark(t.mark)
  return { kind: 'erase', first: t, p0: q, moved: false, done: new Set() }
}

export const erase: DragHandlers<'erase'> = {
  move(c, d, q) {
    if (!d.moved) {
      if (Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 0.2) return
      d.moved = true
      c.setEraseMark(null)
      c.onCheckpoint()
      take(c, d, d.first)
    }
    const t = targetOf(c, q)
    if (t && t.group === d.first.group) take(c, d, t)
  },
  up(c, d) {
    c.setEraseMark(null)
    if (!d.moved) c.onEdit(d.first.erase)
  },
}

/** Erase one more thing in a drag: once each, all in the drag's one undo step. */
function take(c: PointerCtx, d: Extract<Drag, { kind: 'erase' }>, t: EraseTarget) {
  if (d.done.has(t.id)) return
  d.done.add(t.id)
  c.onEdit(t.erase, false)
}
