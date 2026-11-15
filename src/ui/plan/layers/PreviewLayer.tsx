// The interaction layer on top of the plan (docs/forhandsvisning.md). What the pen in hand would store is drawn by
// PlanView itself: the next variant through the plan's own layers, dimmed (next.ts, nextArea.ts). This layer adds what
// is not part of the drawing: the measure pill of what is being dragged out, where it would land grey and hatched when
// it cannot be stored, Tøm's stroke, the selected room's handles and the chosen engangsteppe's lanes. The reason nothing
// would be stored goes to the hint line.
import { useEffect } from 'react'
import { CELL } from '../../../domain/grid'
import type { FloorBrushSize } from '../../../domain/floor/brush'
import { laneAt } from '../../../domain/floor/edit'
import { fillTilesOf } from '../../../domain/floor/rollFill'
import { standCells } from '../../../domain/floor/tiles'
import type { Variant } from '../../../domain/types'
import { INK } from '../../colors'
import { idx } from '../../env'
import type { Brush, Tool } from '../../tools'
import { widthOf, type NextOutcome } from '../next'
import type { PlanGrip } from '../grips'
import { usePlanScale } from '../planScale'
import { rollWidthOf } from '../pointer/floorBrush'
import type { PlanPointer } from '../pointer/usePlanPointer'
import type { PlanSelection } from '../selection'
import { Offcut } from './FloorLayer'
import { tileArea, tileAreaMeasures } from './measures'
import { Grips } from './Grips'
import { PodiumLinks } from './PodiumLinks'
import { AimRect, EraseStroke, InvalidSeg, InvalidShape, MeasurePill } from './Previews'

interface Props {
  v: Variant
  tool: Tool
  brush: Brush | null
  selection: PlanSelection
  floorSize: FloorBrushSize
  pointer: Pick<PlanPointer, 'hover' | 'dragging' | 'stroke'>
  /** The grips of what is chosen (pointer/hits.ts `grips`). */
  grips: PlanGrip[]
  /** What the pen would store at the pointer (next.ts). */
  next: NextOutcome | null
  mini?: boolean
  onHint?: (text: string | null) => void
}

export function PreviewLayer(p: Props) {
  const { v, tool, brush, selection, mini, next } = p
  const { hover, dragging, stroke } = p.pointer
  const sc = usePlanScale()
  const { width: W, depth: D } = v.stand
  const centre: [number, number] = [W / 2, D / 2]
  const rollWidth = rollWidthOf(brush)

  // Carpet tiles paint while dragging, so only the area painted so far is measured
  const tileDrag = dragging?.kind === 'floor' && dragging.anchor && hover && !rollWidth && brush?.kind === 'floor'
    ? tileArea(dragging.anchor, hover, p.floorSize, standCells(v.stand))
    : null

  // The chosen engangsteppe (Velg): its lanes, outlined while its drawer is open
  const selLane = tool === 'select' && !mini && selection.lane ? laneAt(v, selection.lane.i, selection.lane.j) : undefined
  const selLanes = tool !== 'select' || mini ? [] : selection.fill ? fillTilesOf(v, selection.fill) : selLane ? [selLane] : []

  const hint = mini ? null : (next?.hint ?? null)
  const onHint = p.onHint
  useEffect(() => onHint?.(hint), [onHint, hint])
  useEffect(() => () => onHint?.(null), [onHint])

  // The grips of what is chosen (plan/grips.ts): a room's in Velg (R5), a counter's also with the pen of Disker og podier
  // (K14); not while one is
  // dragged, when the plan shows what the release stores
  const chosen = selection.objectId ? v.objects.find((o) => o.id === selection.objectId) : undefined
  const counter = !mini && chosen?.sections && (tool === 'select' || brush?.kind === 'podium') ? chosen : null
  const gripsShown = !mini && (tool === 'select' || brush?.kind === 'podium') && !(dragging?.kind === 'grip' && dragging.moved)

  const bad = !mini ? next?.invalid : undefined
  const pill = !mini ? next?.pill : undefined
  return (
    <g pointerEvents="none">
      {stroke && tool === 'erase' && <EraseStroke a={stroke[0]} b={stroke[1]} centre={centre} />}
      {bad && 'seg' in bad && <InvalidSeg a={bad.seg[0]} b={bad.seg[1]} width={widthOf(sc, bad.width)} />}
      {bad && 'rect' in bad && <InvalidShape kind="rect" x={bad.rect.x0} y={bad.rect.y0} width={bad.rect.x1 - bad.rect.x0} height={bad.rect.y1 - bad.rect.y0} />}
      {bad && 'circle' in bad && <InvalidShape kind="circle" {...bad.circle} />}
      {!mini && next?.erased?.map((b, i) => <InvalidShape key={`gone${i}`} kind="rect" x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} />)}
      {gripsShown && <Grips grips={tool === 'select' ? p.grips : p.grips.filter((g) => g.on.type === 'podium')} hot={next?.hotGrip} />}
      {gripsShown && counter && <PodiumLinks v={v} o={counter} hot={next?.hotGrip} />}
      {/* Disker og podier with Shift: the edge a press takes hold of, thick (PR 2) */}
      {pill && <MeasurePill a={pill.a} b={pill.b} centre={centre} stroke={widthOf(sc, pill.width)} text={pill.text} />}
      {tileDrag && brush?.kind === 'floor' && tileAreaMeasures(v, tileDrag, brush.product, centre)}
      {selLanes.length > 0 && (
        <g>
          {selLane && <Offcut t={selLane} roll={idx.byArtnr.get(selLane.product)?.product.roll ?? 2} stand={standCells(v.stand)} />}
          {selLanes.map((t) => (
            <g key={`${t.i},${t.j}`}>
              <rect x={t.i * CELL} y={t.j * CELL} width={t.w * CELL} height={t.h * CELL} fill={INK} fillOpacity={0.06} />
              <AimRect x={t.i * CELL} y={t.j * CELL} width={t.w * CELL} height={t.h * CELL} halo />
            </g>
          ))}
        </g>
      )}
    </g>
  )
}
