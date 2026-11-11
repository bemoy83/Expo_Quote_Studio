// Measure pills of the floor pen (docs/forhandsvisning.md): carpet tiles paint while dragging, so the floor itself shows
// the stroke and only the measures of the area painted so far are added. The floor itself is drawn by FloorLayer,
// dimmed, from the next variant (PlanView).
import type { ReactNode } from 'react'
import { CELL } from '../../../domain/grid'
import { TILE_FULL, type Rect } from '../../../domain/floor/tiles'
import type { FloorBrushSize } from '../../../domain/floor/brush'
import type { Point, Variant } from '../../../domain/types'
import { count, fmt } from '../../format'
import { mm } from '../dims'
import { MeasurePill, PillAt } from './Previews'

const inside = (t: Rect, r: Rect) => t.i >= r.i && t.j >= r.j && t.i + t.w <= r.i + r.w && t.j + t.h <= r.j + r.h

/**
 * The area a carpet tile stroke covers so far: from the slot it started in to the slot under the pointer, on the
 * stroke's grid (the brush size, a whole tile for Auto). Null while it is still one slot.
 */
export function tileArea(anchor: { i: number; j: number }, q: { x: number; y: number }, size: FloorBrushSize, stand: { nx: number; ny: number }): Rect | null {
  const { w, h } = size === 'auto' ? TILE_FULL : size
  const ci = Math.max(0, Math.min(stand.nx - 1, Math.floor(q.x / CELL)))
  const cj = Math.max(0, Math.min(stand.ny - 1, Math.floor(q.y / CELL)))
  const i = anchor.i + Math.floor((ci - anchor.i) / w) * w
  const j = anchor.j + Math.floor((cj - anchor.j) / h) * h
  const i0 = Math.max(0, Math.min(anchor.i, i))
  const j0 = Math.max(0, Math.min(anchor.j, j))
  const i1 = Math.min(stand.nx, Math.max(anchor.i, i) + w)
  const j1 = Math.min(stand.ny, Math.max(anchor.j, j) + h)
  if (i1 - i0 <= w && j1 - j0 <= h) return null
  return { i: i0, j: j0, w: i1 - i0, h: j1 - j0 }
}

/** Measures of a carpet tile area: width and depth on two sides, and how many tiles of the product lie in it. */
export function tileAreaMeasures(v: Variant, r: Rect, product: string, centre: Point): ReactNode {
  const x0 = r.i * CELL
  const y0 = r.j * CELL
  const x1 = (r.i + r.w) * CELL
  const y1 = (r.j + r.h) * CELL
  const laid = v.floor.tiles.filter((t) => t.product === product && inside(t, r))
  const area = laid.reduce((s, t) => s + t.w * t.h * CELL * CELL, 0)
  // The side of each pair away from the stand's middle
  const yTop = Math.abs(y0 - centre[1]) >= Math.abs(y1 - centre[1]) ? y0 : y1
  const xSide = Math.abs(x0 - centre[0]) >= Math.abs(x1 - centre[0]) ? x0 : x1
  return (
    <g>
      <MeasurePill a={[x0, yTop]} b={[x1, yTop]} centre={centre} stroke={0} text={mm(x1 - x0)} />
      <MeasurePill a={[xSide, y0]} b={[xSide, y1]} centre={centre} stroke={0} text={mm(y1 - y0)} />
      <PillAt at={[(x0 + x1) / 2, (y0 + y1) / 2]} text={`${count(laid.length, 'flis', 'fliser')} · ${fmt(area, 2)} m²`} />
    </g>
  )
}

