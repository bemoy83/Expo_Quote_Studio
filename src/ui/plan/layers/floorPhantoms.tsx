// Floor previews (docs/forhandsvisning.md): carpet tiles paint while dragging, so the floor itself is the phantom and
// only the measures of the area painted so far are added; engangsteppe lanes and Fyll show their proposal only while
// pressed. Plain functions, so PreviewLayer can decide what to draw from the pointer state.
import type { ReactNode } from 'react'
import { CELL } from '../../../domain/grid'
import { TILE_FULL, type Rect } from '../../../domain/floor/tiles'
import type { FloorBrushSize } from '../../../domain/floor/brush'
import type { FloorTile, Point, Variant } from '../../../domain/types'
import { count, fmt } from '../../format'
import { mm } from '../dims'
import { AimRect, MeasurePill, PillAt } from './Previews'

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

/** Measures of a carpet tile area: its outline, width and depth on two sides, and how many tiles of the product lie in it. */
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
      <AimRect x={x0} y={y0} width={x1 - x0} height={y1 - y0} halo />
      <MeasurePill a={[x0, yTop]} b={[x1, yTop]} centre={centre} stroke={0} text={mm(x1 - x0)} />
      <MeasurePill a={[xSide, y0]} b={[xSide, y1]} centre={centre} stroke={0} text={mm(y1 - y0)} />
      <PillAt at={[(x0 + x1) / 2, (y0 + y1) / 2]} text={`${count(laid.length, 'flis', 'fliser')} · ${fmt(area, 2)} m²`} />
    </g>
  )
}

/** The pill of engangsteppe lanes being laid: their length, the roll width, and what is cut off a narrower lane. */
export function lanePill(lanes: FloorTile[], roll: number, centre: Point): ReactNode {
  if (!lanes.length) return null
  const along = (t: FloorTile) => (t.roll === 'x' ? t.w : t.h) * CELL
  const across = (t: FloorTile) => (t.roll === 'x' ? t.h : t.w) * CELL
  const i0 = Math.min(...lanes.map((t) => t.i))
  const j0 = Math.min(...lanes.map((t) => t.j))
  const i1 = Math.max(...lanes.map((t) => t.i + t.w))
  const j1 = Math.max(...lanes.map((t) => t.j + t.h))
  const x = lanes[0].roll === 'x'
  const L = Math.max(...lanes.map(along))
  const cut = Math.max(...lanes.map((t) => roll - across(t)))
  const text = `${mm(L)} · ${lanes.length === 1 ? `bane ${fmt(roll)} m` : `${lanes.length} baner ${fmt(roll)} m`}${cut > 1e-9 ? ` · kapp ${mm(cut)}` : ''}`
  // Along the lanes' length, beside the box around them
  const [a, b]: [Point, Point] = x ? [[i0 * CELL, ((j0 + j1) / 2) * CELL], [i1 * CELL, ((j0 + j1) / 2) * CELL]] : [[((i0 + i1) / 2) * CELL, j0 * CELL], [((i0 + i1) / 2) * CELL, j1 * CELL]]
  const width = (x ? j1 - j0 : i1 - i0) * CELL
  return <MeasurePill a={a} b={b} centre={centre} stroke={width} text={text} />
}
