// The floor pen: carpet tiles in the brush size, and the carpet brush for rolled floor (engangsteppe), laid by the
// engine (pointer/carpetFill.ts).
import { CELL } from '../../../domain/grid'
import { floorAction, type FloorAction, type FloorBrushSize } from '../../../domain/floor/brush'
import { type Rect, standCells } from '../../../domain/floor/tiles'
import type { Variant } from '../../../domain/types'
import { idx } from '../../env'
import type { Brush, Tool } from '../../tools'
import type { P } from './types'

export interface FloorPen {
  tool: Tool
  brush: Brush | null
  floorSize: FloorBrushSize
}

// Rolled floor (engangsteppe) is laid in lanes one roll wide
export const rollWidthOf = (brush: Brush | null) => (brush?.kind === 'floor' ? idx.byArtnr.get(brush.product)?.product.roll : undefined)

/** The carpet brush: engangsteppe is laid by the engine, an area dragged or the free floor clicked. */
export const isCarpetFill = (tool: Tool, brush: Brush | null) => !!rollWidthOf(brush) && tool === 'brush'

export function floorBrush(v: Variant, { tool, brush, floorSize }: FloorPen) {
  const rollWidth = rollWidthOf(brush)
  // Rolled floor as the eraser sees it: the whole lane under the pointer
  const brushSize = rollWidth ? { roll: 'x' as const, width: Math.round(rollWidth / CELL) } : floorSize
  const floorTouch = (q: P, anchor: { i: number; j: number } | null, from: P | null = null): FloorAction =>
    brush?.kind === 'floor'
      ? floorAction(v, { x: q.x / CELL, y: q.y / CELL, size: brushSize, product: brush.product, anchor, from })
      : { kind: 'none' }
  const carpetFill = isCarpetFill(tool, brush)
  const cellOf = (q: P) => {
    const { nx, ny } = standCells(v.stand)
    return { i: Math.max(0, Math.min(nx - 1, Math.floor(q.x / CELL))), j: Math.max(0, Math.min(ny - 1, Math.floor(q.y / CELL))) }
  }
  return { rollWidth, floorTouch, carpetFill, cellOf }
}

export type FloorBrush = ReturnType<typeof floorBrush>

export const rectOf = (a: { i: number; j: number }, b: { i: number; j: number }): Rect => ({
  i: Math.min(a.i, b.i),
  j: Math.min(a.j, b.j),
  w: Math.abs(a.i - b.i) + 1,
  h: Math.abs(a.j - b.j) + 1,
})
