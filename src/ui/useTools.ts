// What the sketch screen draws with: the tool (Velg, pen or Tøm), the pen and the pen settings each drawing tool keeps.
// UI only, never stored in the model (see tools.ts).
import { useState } from 'react'
import type { CalcResult } from '../calc/calc'
import { type FloorBrushSize } from '../domain/floor/brush'
import { TILE_FULL, type TileSize } from '../domain/floor/tiles'
import type { GridStep } from '../domain/snapGrid'
import type { Motif, Variant } from '../domain/types'
import { COUNTER_STOCK_RAL } from '../domain/objects'
import { stockByArtnr, stockSize } from '../domain/podiumStock'
import { HEIGHT } from '../domain/podiums'
import { artnrName, builtOf, catalog, idx, isCounter } from './env'
import { funcOf, type PenPicks } from './podiumPen'
import { kr } from './format'
import { findMotif } from './motifs'
import { dockToolOf, FLOOR_OTHER, penToolOf, type Brush, type DockTool, type PenTool, type Tool } from './tools'

interface ToolsInput {
  v: Variant
  res: CalcResult
  motifs: Motif[]
  /** A pen was chosen: the brushes draw in the plan, and nothing stays selected. */
  onPick: () => void
  /** Tøm was chosen: it erases in the plan. */
  onErase: () => void
}

export function useTools({ v, res, motifs, onPick, onErase }: ToolsInput) {
  const [tool, setTool] = useState<Tool>('select')
  const [brush, setBrush] = useState<Brush | null>(null)
  const [floorSize, setFloorSize] = useState<FloorBrushSize>(TILE_FULL)
  /** Last of the smaller tile sizes, so «Andre» comes back to it. */
  const [otherSize, setOtherSize] = useState<TileSize>(FLOOR_OTHER[0].size)
  const [gridStep, setGridStep] = useState<GridStep>(1)
  /** The pen each drawing tool last drew with, so switching tools brings it back. */
  const [pens, setPens] = useState<Partial<Record<PenTool, Brush>>>({})
  /** Colour the wall tool draws new inner walls with; follows the stand's wall plate until a colour is picked. */
  const [wallPen, setWallPen] = useState<string | null>(null)
  /** Colour Disker og podier draws with (K6 as for counters): white until a colour is picked. */
  const [podiumRal, setPodiumRal] = useState<string>(COUNTER_STOCK_RAL)
  /** The item behind each function of each pen: the one last put in hand for it, from the quick picks or the catalog
   *  (Bjørn 14.11.2026). Disker og podier for now; the other tools take the same pattern. */
  const [picks, setPicks] = useState<Partial<Record<PenTool, PenPicks>>>({})

  const rollBrush = brush?.kind === 'floor' && !!idx.byArtnr.get(brush.product)?.product.roll
  const wallRal = wallPen ?? v.defaultPlate
  const active = dockToolOf(tool, brush)
  const floorPen = pens.floor ?? (brush?.kind === 'floor' ? brush : null)

  /** Choosing a brush always goes to the plan; the brushes draw there. */
  const pick = (b: Brush, t: Tool = 'brush') => {
    setBrush(b)
    setPens((p) => ({ ...p, [penToolOf(b)]: b }))
    if (b.kind === 'wall') setWallPen(b.ral)
    if (b.kind === 'podium') setPodiumRal(b.ral)
    const func = b.kind === 'podium' ? funcOf(b) : undefined
    if (func && b.kind === 'podium') setPicks((p) => ({ ...p, podium: { ...p.podium, [func]: b.stock } }))
    setTool(t)
    onPick()
  }

  /** The pen a drawing tool starts with: the one it last drew, else the first in use on the stand. */
  const penFor = (t: PenTool): Brush => {
    const last = pens[t]
    if (last) return last.kind === 'wall' ? { kind: 'wall', ral: wallRal } : last
    if (t === 'wall') return { kind: 'wall', ral: wallRal }
    if (t === 'floor') return { kind: 'floor', product: Object.keys(res.keyFigures.floor)[0] ?? '5902' }
    if (t === 'profile') return { kind: 'textile' }
    if (t === 'fitting') return { kind: 'shelf' }
    // «Fri» first: what it draws is built as the disk or the podie its shape is when stored (K13)
    if (t === 'podium') return { kind: 'podium', product: builtOf('disker')!.variants[0].artnr, ral: podiumRal }
    const used = v.objects.find((o) => !isCounter(o.product))?.product
    return { kind: 'object', product: used ?? catalog.products.find((x) => x.kind === 'object' && !x.opening && !x.counter)!.variants[0].artnr }
  }

  /** Click on a dock tool (or its key). The active drawing tool keeps its pen. */
  const activate = (t: DockTool) => {
    if (t === active) return
    if (t === 'select' || t === 'erase') {
      setTool(t)
      if (t === 'erase') onErase()
      return
    }
    pick(penFor(t))
  }

  /** Name of what the pen draws, and a short line under it for the quick picks. */
  const describeBrush = (): { name: string; meta?: string } => {
    const b = brush
    if (!b) return { name: 'Pensel' }
    if (b.kind === 'wall') return { name: 'Innervegg', meta: `RAL ${b.ral}` }
    if (b.kind === 'textile') return { name: 'Tekstilvegg', meta: 'vegg eller fritt' }
    if (b.kind === 'beam') return { name: 'Takdrager', meta: 'innvendig' }
    if (b.kind === 'shelf') return { name: 'Hylle', meta: `${kr(idx.byArtnr.get(catalog.system.shelf)?.variant.price ?? 0)} kr` }
    if (b.kind === 'motif') return { name: findMotif(motifs, b.motif)?.name ?? 'Motiv', meta: 'trykk eller folie' }
    const r = idx.byArtnr.get(b.product)
    if (b.kind === 'podium') {
      // The item in hand and its size, or «Fri fasong» with what a click sets (Bjørn 14.11.2026)
      const s = b.stock ? stockByArtnr(b.stock) : undefined
      if (!s) return { name: 'Fri fasong', meta: `RAL ${b.ral} · høyde ${b.h ?? HEIGHT}` }
      const z = stockSize(s)
      return { name: artnrName(s.artnr), meta: `${kr(z.length)} × ${kr(z.depth)}` }
    }
    const name = artnrName(b.product)
    return { name, meta: r ? `${kr(r.variant.price)} kr${b.kind === 'floor' ? '/m²' : ''}` : undefined }
  }

  return {
    tool,
    setTool,
    brush,
    active,
    pick,
    activate,
    describeBrush,
    floorPen,
    wallRal,
    podiumRal,
    picks,
    floorSize,
    setFloorSize,
    otherSize,
    setOtherSize,
    rollBrush,
    gridStep,
    setGridStep,
  }
}

export type Tools = ReturnType<typeof useTools>
