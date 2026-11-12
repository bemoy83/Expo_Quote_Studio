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
import { INK, INK_MUTED } from '../../colors'
import { idx } from '../../env'
import type { Brush, Tool } from '../../tools'
import { widthOf, type NextOutcome } from '../next'
import { linePx, sizePx, usePlanScale } from '../planScale'
import { rollWidthOf } from '../pointer/floorBrush'
import type { PlanPointer } from '../pointer/usePlanPointer'
import type { PlanSelection } from '../selection'
import { Offcut } from './FloorLayer'
import { tileArea, tileAreaMeasures } from './measures'
import { AimRect, EraseStroke, InvalidSeg, InvalidShape, MeasurePill } from './Previews'
import { RoomHandles } from './RoomLayer'
import type { CounterEnd } from '../../../domain/counterEnds'

interface Props {
  v: Variant
  tool: Tool
  brush: Brush | null
  selection: PlanSelection
  floorSize: FloorBrushSize
  pointer: Pick<PlanPointer, 'hover' | 'dragging' | 'stroke'>
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

  const bad = !mini ? next?.invalid : undefined
  const pill = !mini ? next?.pill : undefined
  return (
    <g pointerEvents="none">
      {!mini && v.rooms.filter((r) => r.id === selection.roomId).map((r) => <RoomHandles key={r.id} r={r} />)}
      {stroke && tool === 'erase' && <EraseStroke a={stroke[0]} b={stroke[1]} centre={centre} />}
      {bad && 'seg' in bad && <InvalidSeg a={bad.seg[0]} b={bad.seg[1]} width={widthOf(sc, bad.width)} />}
      {bad && 'rect' in bad && <InvalidShape kind="rect" x={bad.rect.x0} y={bad.rect.y0} width={bad.rect.x1 - bad.rect.x0} height={bad.rect.y1 - bad.rect.y0} />}
      {bad && 'circle' in bad && <InvalidShape kind="circle" {...bad.circle} />}
      {next?.handle && !mini && <CounterHandle h={next.handle} />}
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

/** A counter's end under the pen (K7, K8): outlined as the thing to take hold of, with an arrow for each way a drag can
 *  go and what it does, so the pointer says what a drag from here makes before it starts (Bjørn 12.11.2026). */
function CounterHandle({ h }: { h: CounterEnd }) {
  const sc = usePlanScale()
  const c: [number, number] = [(h.box.x0 + h.box.x1) / 2, (h.box.y0 + h.box.y1) / 2]
  const arrows: { d: readonly [number, number]; text: string }[] = [
    ...h.out.map((d) => ({ d, text: 'lengre' })),
    ...(h.in ? [{ d: h.in, text: 'kortere' }] : []),
    { d: h.back, text: 'hjørne' },
  ]
  const from = sizePx(sc, 7)
  const to = sizePx(sc, 26)
  const head = sizePx(sc, 5)
  const fs = sizePx(sc, 10)
  return (
    <g>
      <AimRect x={h.box.x0} y={h.box.y0} width={h.box.x1 - h.box.x0} height={h.box.y1 - h.box.y0} halo />
      {arrows.map(({ d, text }) => {
        const [dx, dy] = d
        const tip: [number, number] = [c[0] + dx * to, c[1] + dy * to]
        const side: [number, number] = [-dy, dx]
        const wing = (s: number) => `${tip[0] - dx * head + side[0] * head * s * 0.7},${tip[1] - dy * head + side[1] * head * s * 0.7}`
        const label: [number, number] = [tip[0] + dx * sizePx(sc, 4) + (dy ? sizePx(sc, 4) : 0), tip[1] + dy * sizePx(sc, 4) + (dx ? -sizePx(sc, 4) : fs * 0.35)]
        return (
          <g key={text + dx + dy}>
            <line x1={c[0] + dx * from} y1={c[1] + dy * from} x2={tip[0]} y2={tip[1]} stroke={INK} strokeWidth={linePx(sc, 1.4)} strokeLinecap="round" />
            <polyline points={`${wing(1)} ${tip[0]},${tip[1]} ${wing(-1)}`} fill="none" stroke={INK} strokeWidth={linePx(sc, 1.4)} strokeLinecap="round" strokeLinejoin="round" />
            <text x={label[0]} y={label[1]} textAnchor={dx > 0 ? 'start' : dx < 0 ? 'end' : 'start'} style={{ font: `500 ${fs}px var(--font-sans, system-ui)`, fill: INK_MUTED }}>
              {text}
            </text>
          </g>
        )
      })}
    </g>
  )
}

