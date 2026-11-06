// The interaction layer on top of the plan (docs/forhandsvisning.md). What the pen in hand would store is drawn by
// PlanView itself: the next variant through the plan's own layers, dimmed (next.ts, nextArea.ts). This layer adds what
// is not part of the drawing: the measure pill of what is being dragged out, where it would land grey and hatched when
// it cannot be stored, Tøm's stroke, the selected room's handles and the chosen engangsteppe's lanes. The reason nothing
// would be stored goes to the hint line.
import { useEffect, useId } from 'react'
import { CELL } from '../../../domain/grid'
import { lanesLaid, type FloorBrushSize } from '../../../domain/floor/brush'
import type { RollDir } from '../../../domain/floor/lanes'
import { laneAt } from '../../../domain/floor/edit'
import { fillTilesOf } from '../../../domain/floor/rollFill'
import { standCells } from '../../../domain/floor/tiles'
import type { Point, Variant } from '../../../domain/types'
import { INK } from '../../colors'
import { idx } from '../../env'
import type { Brush, Tool } from '../../tools'
import { faceSegment, sideOf } from '../../../domain/faces'
import { runNormal } from '../../../domain/textile/free'
import { widthOf, type NextOutcome, type PrintMark } from '../next'
import { linePx, sizePx, usePlanScale, type PlanScale } from '../planScale'
import { PHANTOM, textileFill, textileOffset, textileWidth } from '../planStyle'
import { rollWidthOf } from '../pointer/floorBrush'
import type { PlanPointer } from '../pointer/usePlanPointer'
import type { PlanSelection } from '../selection'
import { Offcut } from './FloorLayer'
import { lanePill, tileArea, tileAreaMeasures } from './measures'
import { AimRect, EraseStroke, InvalidSeg, InvalidShape, MeasurePill } from './Previews'
import { Seg } from './Seg'
import { RasterPattern } from './TextileLayer'
import { RoomHandles } from './RoomLayer'

interface Props {
  v: Variant
  tool: Tool
  brush: Brush | null
  selection: PlanSelection
  floorSize: FloorBrushSize
  /** Direction lanes of rolled floor run when the brush lays them. */
  rollDir: RollDir
  pointer: Pick<PlanPointer, 'hover' | 'dragging' | 'rollPending' | 'stroke'>
  /** What the pen would store at the pointer (next.ts). */
  next: NextOutcome | null
  mini?: boolean
  onHint?: (text: string | null) => void
}

export function PreviewLayer(p: Props) {
  const { v, tool, brush, selection, mini, next } = p
  const { hover, dragging, rollPending, stroke } = p.pointer
  const sc = usePlanScale()
  const { width: W, depth: D } = v.stand
  const centre: [number, number] = [W / 2, D / 2]
  const rollWidth = rollWidthOf(brush)

  // Carpet tiles paint while dragging, so only the area painted so far is measured
  const tileDrag = dragging?.kind === 'floor' && dragging.anchor && hover && !rollWidth && brush?.kind === 'floor'
    ? tileArea(dragging.anchor, hover, p.floorSize, standCells(v.stand))
    : null
  // Bane: the lanes being dragged out
  const lanes = rollPending && brush?.kind === 'floor' && rollWidth ? lanesLaid(rollPending, brush.product, p.rollDir) : []

  // The chosen engangsteppe (Velg): its lanes, outlined while its drawer is open
  const selLane = tool === 'select' && !mini && selection.lane ? laneAt(v, selection.lane.i, selection.lane.j) : undefined
  const selLanes = tool !== 'select' || mini ? [] : selection.fill ? fillTilesOf(v, selection.fill) : selLane ? [selLane] : []

  const hint = mini ? null : (next?.hint ?? null)
  const onHint = p.onHint
  useEffect(() => onHint?.(hint), [onHint, hint])
  useEffect(() => () => onHint?.(null), [onHint])

  const bad = !mini ? next?.invalid : undefined
  const pill = !mini ? next?.pill : undefined
  const print = !mini ? next?.print : undefined
  return (
    <g pointerEvents="none">
      {!mini && v.rooms.filter((r) => r.id === selection.roomId).map((r) => <RoomHandles key={r.id} r={r} />)}
      {stroke && tool === 'erase' && <EraseStroke a={stroke[0]} b={stroke[1]} centre={centre} />}
      {bad && 'seg' in bad && <InvalidSeg a={bad.seg[0]} b={bad.seg[1]} width={widthOf(sc, bad.width)} />}
      {bad && 'rect' in bad && <InvalidShape kind="rect" x={bad.rect.x0} y={bad.rect.y0} width={bad.rect.x1 - bad.rect.x0} height={bad.rect.y1 - bad.rect.y0} />}
      {bad && 'circle' in bad && <InvalidShape kind="circle" {...bad.circle} />}
      {print && <PrintBand v={v} sc={sc} mark={print} />}
      {pill && <MeasurePill a={pill.a} b={pill.b} centre={centre} stroke={widthOf(sc, pill.width)} text={pill.text} />}
      {lanes.length > 0 && lanePill(lanes, rollWidth!, centre)}
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

/** The textile face a motif prints, as the green print band at preview strength, in front of that face. */
function PrintBand({ v, sc, mark }: { v: Variant; sc: PlanScale; mark: PrintMark }) {
  const id = `print${useId().replace(/:/g, '')}`
  let seg: [Point, Point] | null = null
  let width = textileFill(sc)
  if ('freeId' in mark) {
    const t = v.freeTextiles.find((x) => x.id === mark.freeId)
    if (t) {
      const [nx, ny] = runNormal(t, mark.face)
      const o = textileWidth(sc) / 2 + sizePx(sc, 1.5)
      seg = [[t.from[0] + nx * o, t.from[1] + ny * o], [t.to[0] + nx * o, t.to[1] + ny * o]]
      width = linePx(sc, 2.4)
    }
  } else {
    const t = v.textiles.find((x) => x.id === mark.textileId)
    const w = t && v.walls.find((x) => x.id === t.wallId)
    if (t && w) seg = faceSegment(w, sideOf(v, t), t.from, t.from + t.width, textileOffset(sc))
  }
  if (!seg) return null
  return (
    <g opacity={PHANTOM.line}>
      <defs>
        <RasterPattern id={id} sc={sc} />
      </defs>
      <Seg a={seg[0]} b={seg[1]} stroke={`url(#${id})`} strokeWidth={width} />
    </g>
  )
}
