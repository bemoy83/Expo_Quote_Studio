// Where the selection pill stands (docs/pille-og-skuff.md): over the selected object, or under it when there is no
// room. For a wall (and a door, frame or decal in it) on the side away from the stand's centre, opposite its module
// chain (arbeidstegning.md A5); on a stand edge it clears the totals and the side name outside. Pure, in model
// metres and screen pixels, so it can be tested without a plan; SelectionPill.tsx turns it into a place on screen.
import { footprintBox, objectFootprint } from '../../../domain/objects'
import { shelfBox } from '../../../domain/shelves/model'
import { CELL, pointAlong, wallLength } from '../../../domain/grid'
import type { FloorTile, Point, Variant, Wall } from '../../../domain/types'
import { isPerimeterWall } from '../../../domain/walls'
import { place } from '../../env'
import { counterDimSides, DIM_NEAR, DIM_TOTAL } from '../dims'
import { awayFrom } from './pillPlace'
import { chosen, type PlanSelection } from '../selection'

export type PillDir = 'up' | 'down' | 'left' | 'right'

export interface PillAnchor {
  /** The selected object's box, model metres. */
  x0: number
  y0: number
  x1: number
  y1: number
  /** Where to put the pill, best first: a side of the box and the gap to it, screen px. The first that fits wins. */
  tries: { dir: PillDir; gap: number }[]
}

/** Gap to anything but a wall, px. */
export const PILL_GAP = 12
/** Past the totals and the side name outside a stand edge (DIM_TOTAL + the name's offset and height), px. */
export const PILL_PAST_NAME = DIM_TOTAL + 22 + 18
/** Past the selected wall's module chain on the stand side, px. */
export const PILL_PAST_CHAIN = DIM_NEAR + 26

const opposite: Record<PillDir, PillDir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

/**
 * Along a wall from t0 to t1: away from the stand's centre, else on the stand side past the module chain. A vertical
 * wall seldom has room beside it for a wide pill, so it tries over its top end and under its bottom end in between.
 */
function wallAnchor(v: Variant, w: Wall, t0: number, t1: number): PillAnchor {
  const a = pointAlong(w, t0)
  const b = pointAlong(w, t1)
  const n = awayFrom(w.from, w.to, [v.stand.width / 2, v.stand.depth / 2])
  const horizontal = w.from[1] === w.to[1]
  const away: PillDir = horizontal ? (n[1] < 0 ? 'up' : 'down') : n[0] < 0 ? 'left' : 'right'
  const gap = isPerimeterWall(v.stand, w) ? PILL_PAST_NAME : PILL_GAP
  const ends = horizontal
    ? []
    : [
        { dir: 'up' as const, gap: endGap(v, a[1] < b[1] ? a : b) },
        { dir: 'down' as const, gap: endGap(v, a[1] < b[1] ? b : a) },
      ]
  return { ...box([a, b]), tries: [{ dir: away, gap }, ...ends, { dir: opposite[away], gap: PILL_PAST_CHAIN }] }
}

/** Past the end of a vertical wall: clear of the totals and side name when the end is on the front or back edge. */
const endGap = (v: Variant, p: Point) => (p[1] <= 0 || p[1] >= v.stand.depth ? PILL_PAST_NAME : PILL_GAP)

function box(ps: Point[]) {
  const xs = ps.map((p) => p[0])
  const ys = ps.map((p) => p[1])
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

/** Over the box, else under it; clear of the totals and side name where the box meets the back or front edge. */
const over = (v: Variant, b: { x0: number; y0: number; x1: number; y1: number }): PillAnchor => ({
  ...b,
  tries: [
    { dir: 'up', gap: b.y0 <= 1e-9 ? PILL_PAST_NAME : PILL_GAP },
    { dir: 'down', gap: b.y1 >= v.stand.depth - 1e-9 ? PILL_PAST_NAME : PILL_GAP },
  ],
})

/** A chosen counter: past its width chain (K7), which stands toward the stand's middle where there is room, so the
 *  pill never covers a measure nor the aisle a counter often stands by (Bjørn 12.11.2026); else on the other side. */
function counterAnchor(v: Variant, b: { x0: number; y0: number; x1: number; y1: number }): PillAnchor {
  const { dy } = counterDimSides(v, { x: [b.x0, b.x1], y: [b.y0, b.y1] })
  const tries = over(v, b).tries
  const chain = tries.find((t) => t.dir === (dy > 0 ? 'down' : 'up'))!
  const free = tries.find((t) => t !== chain)!
  return { ...b, tries: [{ dir: chain.dir, gap: Math.max(chain.gap, PILL_PAST_CHAIN) }, free] }
}

/** The pill's anchor for a selection, or null when there is nothing to anchor to (it was removed). */
export function pillAnchor(v: Variant, sel: PlanSelection): PillAnchor | null {
  const c = chosen(v, sel)
  if (!c) return null
  switch (c.kind) {
    case 'opening': {
      const m = c.opening.module * place.rules.wall.cc
      return wallAnchor(v, c.wall, m, m + place.rules.wall.cc)
    }
    case 'shelf': {
      const b = shelfBox(v, place.rules, c.shelf)
      return b ? over(v, b) : null
    }
    // A frame or decal: along the whole wall, as the wall
    case 'textile':
    case 'foil':
    case 'wall':
      return wallAnchor(v, c.wall, 0, wallLength(c.wall))
    case 'free':
      return over(v, box([c.textile.from, c.textile.to]))
    case 'object': {
      const f = objectFootprint(place, c.object)
      if (!f) return null
      const b = footprintBox(c.object, f)
      return place.isCounter(c.object.product) ? counterAnchor(v, b) : over(v, b)
    }
    case 'room':
      return over(v, box(c.room.outline))
    case 'beam':
      return over(v, box([c.beam.from, c.beam.to]))
    case 'fill':
      return over(v, tilesBox(c.tiles))
    case 'lane':
      return over(v, tilesBox([c.tile]))
  }
}

const tilesBox = (tiles: FloorTile[]) => box(tiles.flatMap((t) => [[t.i * CELL, t.j * CELL] as Point, [(t.i + t.w) * CELL, (t.j + t.h) * CELL] as Point]))

/** The selected object's box on screen, px from the plan's corner, and the plan's size. */
export interface PillPlace {
  box: { left: number; top: number; right: number; bottom: number }
  anchor: PillAnchor
  size: { w: number; h: number }
  /** What floats over the plan (stand chip and hint, mini map, dock): the pill does not go over it. */
  avoid?: Rect[]
}

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

/** Space kept to the plan's edge, px. */
const EDGE = 8

/**
 * Where the pill goes on screen: the first of the anchor's tries where it fits inside the plan without covering what
 * floats over it, centred along that side; else the first that fits inside the plan. Kept inside the plan.
 */
export function placePill({ box, anchor, size, avoid = [] }: PillPlace, dims: { w: number; h: number }): { left: number; top: number } {
  const inside = (d: PillDir, gap: number) =>
    d === 'up' ? box.top - gap - dims.h >= EDGE : d === 'down' ? box.bottom + gap + dims.h <= size.h - EDGE : d === 'left' ? box.left - gap - dims.w >= EDGE : box.right + gap + dims.w <= size.w - EDGE
  const clear = (at: { left: number; top: number }) =>
    avoid.every((r) => at.left >= r.right || at.left + dims.w <= r.left || at.top >= r.bottom || at.top + dims.h <= r.top)
  const fits = (t: { dir: PillDir; gap: number }) => inside(t.dir, t.gap) && clear(spot(t.dir, t.gap))
  const spot = (dir: PillDir, gap: number) => {
      const cx = (box.left + box.right) / 2 - dims.w / 2
    const cy = (box.top + box.bottom) / 2 - dims.h / 2
    const pos =
      dir === 'up'
        ? { left: cx, top: box.top - gap - dims.h }
        : dir === 'down'
          ? { left: cx, top: box.bottom + gap }
          : dir === 'left'
            ? { left: box.left - gap - dims.w, top: cy }
            : { left: box.right + gap, top: cy }
    return { left: clamp(pos.left, EDGE, Math.max(EDGE, size.w - EDGE - dims.w)), top: clamp(pos.top, EDGE, Math.max(EDGE, size.h - EDGE - dims.h)) }
  }
  const t = anchor.tries.find(fits) ?? anchor.tries.find((x) => inside(x.dir, x.gap)) ?? anchor.tries[0]
  return spot(t.dir, t.gap)
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

