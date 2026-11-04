// What the plan's dimension lines measure (docs/arbeidstegning.md, «Mål»): pure geometry, drawn by layers/DimLayer.tsx.
// Positions are metres along a side or a wall; the layer turns them into chains in millimetres.
import { openSides, sideLength } from '../../domain/grid'
import type { Point, Side, Variant, Wall } from '../../domain/types'
import { isStandWall } from '../../domain/walls'
import { runNormal } from '../../domain/textile/free'
import type { PlanSelection } from './selection'
import { sizePx, type PlanScale } from './planScale'
import { PLAN_MARGIN } from './planStyle'

const EPS = 1e-6

/** Distance of the rows from the stand edge, screen px: the placement or module row, then the total. */
export const DIM_NEAR = 9
export const DIM_TOTAL = 27

/** Distance of a side name from the stand edge, screen px: outside the total where the side has one, else close. */
const NAME_PAST_TOTAL = DIM_TOTAL + 22
const NAME_CLOSE = 14
/** The front side name stands this far below its line, m (its text hangs under the line, the others above). */
export const FRONT_NAME_DROP = 0.12

/** How far out a side name stands, m: past the total row when there is one, but never past the margin. */
export const sideNameOffset = (sc: PlanScale, total: boolean) => Math.min(PLAN_MARGIN - 0.08, sizePx(sc, total ? NAME_PAST_TOTAL : NAME_CLOSE))

/** Millimetres with a space every thousand: 6 000. */
export const mm = (m: number) => Math.round(m * 1000).toLocaleString('nb-NO')

/** A side's line: the axis it runs along, its fixed coordinate, and which way is out of the stand (−1 or +1). */
export function sideLine(v: Variant, s: Side): { axis: 'x' | 'y'; at: number; out: 1 | -1 } {
  const { width: W, depth: D } = v.stand
  if (s === 'back') return { axis: 'x', at: 0, out: -1 }
  if (s === 'front') return { axis: 'x', at: D, out: 1 }
  if (s === 'left') return { axis: 'y', at: 0, out: -1 }
  return { axis: 'y', at: W, out: 1 }
}

/**
 * Sides that carry a total: every closed side (one with stand wall), and always the width and the depth: an open stand
 * gets its width on the back and its depth on the left (Bjørn 4.11.2026).
 */
export function totalSides(v: Variant): Side[] {
  const open = new Set(openSides(v.stand))
  const closed = (['back', 'left', 'right', 'front'] as Side[]).filter((s) => !open.has(s))
  const out = new Set(closed)
  if (!out.has('back') && !out.has('front')) out.add('back')
  if (!out.has('left') && !out.has('right')) out.add('left')
  return (['back', 'left', 'right', 'front'] as Side[]).filter((s) => out.has(s))
}

const horizontal = (w: { from: Point; to: Point }) => Math.abs(w.from[1] - w.to[1]) < EPS

/** Sorted, de-duplicated positions. */
const uniq = (ts: number[]) => [...new Set(ts.map((t) => Math.round(t * 1000) / 1000))].sort((a, b) => a - b)

/**
 * The placement row along a side: the corners, and where an inner wall, a room wall or a free-standing textile wall
 * meets the side. Empty when nothing meets it (the total says it all).
 */
export function placementRow(v: Variant, s: Side): number[] {
  const L = sideLength(v.stand, s)
  const line = sideLine(v, s)
  const meets: number[] = []
  const runs: { from: Point; to: Point }[] = [...v.walls.filter((w) => !isStandWall(w)), ...v.freeTextiles]
  for (const r of runs) {
    // Perpendicular to the side, with one end on it
    if (horizontal(r) === (line.axis === 'x')) continue
    const k = line.axis === 'x' ? 1 : 0
    const along = line.axis === 'x' ? 0 : 1
    for (const p of [r.from, r.to]) if (Math.abs(p[k] - line.at) < EPS && p[along] > EPS && p[along] < L - EPS) meets.push(p[along])
  }
  return meets.length ? uniq([0, L, ...meets]) : []
}

/** Whether a wall lies along a side. */
function onSide(v: Variant, w: Wall, s: Side): boolean {
  const line = sideLine(v, s)
  if (horizontal(w) !== (line.axis === 'x')) return false
  const k = line.axis === 'x' ? 1 : 0
  return Math.abs(w.from[k] - line.at) < EPS && Math.abs(w.to[k] - line.at) < EPS
}

/** A chain of whole modules (1 000 each) along a wall, as positions along its axis. */
function moduleChain(w: Wall): number[] {
  const k = horizontal(w) ? 0 : 1
  const a = Math.min(w.from[k], w.to[k])
  const b = Math.max(w.from[k], w.to[k])
  const ts: number[] = []
  for (let t = Math.ceil(a - EPS); t <= b + EPS; t++) ts.push(t)
  return uniq([a, b, ...ts])
}

/** A chain drawn beside a wall or run inside the stand. */
export interface InnerChain {
  axis: 'x' | 'y'
  /** The run's line (fixed coordinate). */
  at: number
  /** Which way from the line the chain stands: −1 or +1. */
  dir: 1 | -1
  ts: number[]
  /** How far out from the line the run's own drawing reaches, m, so the chain clears it. */
  clear: 'wall' | 'textile'
}

export interface Dims {
  /** Per side with a total: the rows outside the stand, nearest first. Each row is a chain of positions along the side. */
  sides: { side: Side; near: number[]; total: number[] }[]
  /** A chain inside the stand, along the selected wall or free-standing textile wall. */
  inner: InnerChain | null
}

/**
 * The dimensions shown, from what is selected: totals and placement rows when nothing is; a selected stand wall's
 * module chain replaces the placement row on its side; a selected inner or room wall gets its module chain on the side
 * toward the stand's centre (docs/arbeidstegning.md A5); a selected free-standing textile wall its length. In compact
 * detail there are no module chains.
 */
export function planDims(v: Variant, selection: PlanSelection, compact: boolean): Dims {
  const wall = selection.wallId ? v.walls.find((w) => w.id === selection.wallId) : undefined
  const stand = wall && isStandWall(wall) && !compact ? wall : undefined
  const sides = totalSides(v).map((side) => {
    const L = sideLength(v.stand, side)
    const near = stand && onSide(v, stand, side) ? uniq([0, L, ...moduleChain(stand)]) : placementRow(v, side)
    return { side, near, total: [0, L] }
  })
  let inner: InnerChain | null = null
  if (wall && !isStandWall(wall) && !compact) {
    const hz = horizontal(wall)
    const at = hz ? wall.from[1] : wall.from[0]
    const mid = hz ? v.stand.depth / 2 : v.stand.width / 2
    inner = { axis: hz ? 'x' : 'y', at, dir: at < mid ? 1 : -1, ts: moduleChain(wall), clear: 'wall' }
  }
  const free = selection.freeTextileId ? v.freeTextiles.find((t) => t.id === selection.freeTextileId) : undefined
  if (free) {
    const hz = horizontal(free)
    const k = hz ? 0 : 1
    // On face A: its label (F1 · 3,00 m) stands on face B
    const n = runNormal(free, 'a')
    const dir = (hz ? n[1] : n[0]) < 0 ? -1 : 1
    inner = { axis: hz ? 'x' : 'y', at: hz ? free.from[1] : free.from[0], dir, ts: uniq([free.from[k], free.to[k]]), clear: 'textile' }
  }
  return { sides, inner }
}
