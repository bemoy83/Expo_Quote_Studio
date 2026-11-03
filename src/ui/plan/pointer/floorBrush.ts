// The floor pen: carpet tiles in the brush size, rolled floor (engangsteppe) in lanes one roll wide, and Fyll.
import { CELL } from '../../../domain/grid'
import { floorAction, type FloorAction, type FloorBrushSize } from '../../../domain/floor/brush'
import type { RollDir } from '../../../domain/floor/lanes'
import { type Rect, standCells } from '../../../domain/floor/tiles'
import type { Variant } from '../../../domain/types'
import { idx } from '../../env'
import type { Brush, RollMode, Tool } from '../../tools'
import type { P } from './types'

export interface FloorPen {
  tool: Tool
  brush: Brush | null
  floorSize: FloorBrushSize
  rollDir?: RollDir
  rollMode?: RollMode
}

// Rolled floor (engangsteppe) is laid in lanes one roll wide
export const rollWidthOf = (brush: Brush | null) => (brush?.kind === 'floor' ? idx.byArtnr.get(brush.product)?.product.roll : undefined)

/** Fyll with engangsteppe: drag an area, the engine lays it the cheapest way. */
export const isCarpetFill = (tool: Tool, brush: Brush | null, rollMode?: RollMode) => !!rollWidthOf(brush) && tool === 'brush' && rollMode !== 'lane'

export function floorBrush(v: Variant, { tool, brush, floorSize, rollDir, rollMode }: FloorPen) {
  const rollWidth = rollWidthOf(brush)
  const dir = rollDir ?? 'x'
  const brushSize = rollWidth ? { roll: dir, width: Math.round(rollWidth / CELL) } : floorSize
  const floorTouch = (q: P, anchor: { i: number; j: number } | null, from: P | null = null): FloorAction =>
    brush?.kind === 'floor'
      ? floorAction(v, { x: q.x / CELL, y: q.y / CELL, size: brushSize, erase: tool === 'erase', product: brush.product, anchor, from })
      : { kind: 'none' }
  const laneAction = (d: { from: P }, q: P | null) => floorTouch(q ?? d.from, null, q && { x: d.from.x / CELL, y: d.from.y / CELL })
  const carpetFill = isCarpetFill(tool, brush, rollMode)
  const cellOf = (q: P) => {
    const { nx, ny } = standCells(v.stand)
    return { i: Math.max(0, Math.min(nx - 1, Math.floor(q.x / CELL))), j: Math.max(0, Math.min(ny - 1, Math.floor(q.y / CELL))) }
  }
  return { rollWidth, dir, floorTouch, laneAction, carpetFill, cellOf }
}

export type FloorBrush = ReturnType<typeof floorBrush>

export const rectOf = (a: { i: number; j: number }, b: { i: number; j: number }): Rect => ({
  i: Math.min(a.i, b.i),
  j: Math.min(a.j, b.j),
  w: Math.abs(a.i - b.i) + 1,
  h: Math.abs(a.j - b.j) + 1,
})
