// The interaction layer on top of the plan (docs/forhandsvisning.md): what the pen in hand aims at while hovering, the
// phantom of what a release stores while pressed or dragging, and why it would store nothing (for the hint line). It
// reads the pointer state from usePlanPointer and draws with the phantoms in strokePhantoms.tsx, floorPhantoms.tsx and
// placePhantoms.tsx. The selected room's handles and the chosen engangsteppe's lanes are drawn here too.
import { useEffect, useMemo } from 'react'
import { CELL } from '../../../domain/grid'
import { faceSegment } from '../../../domain/faces'
import { lanesLaid, type FloorBrushSize } from '../../../domain/floor/brush'
import { laneAt } from '../../../domain/floor/edit'
import { fillProposalsFor, fillTilesOf } from '../../../domain/floor/rollFill'
import { standCells } from '../../../domain/floor/tiles'
import type { Run } from '../../../domain/innerBeams'
import { fillFace } from '../../../domain/textile/brush'
import { freeStroke } from '../../../domain/textile/free'
import type { Variant } from '../../../domain/types'
import type { Motif } from '../../../persistence/file'
import { INK } from '../../colors'
import { idx, rules } from '../../env'
import type { Brush, RollMode, Tool } from '../../tools'
import { usePlanScale } from '../planScale'
import { textileOffset } from '../planStyle'
import { ratioOf } from '../pointer/decor'
import { isCarpetFill, rollWidthOf, type FloorBrush } from '../pointer/floorBrush'
import type { PlanHits } from '../pointer/hits'
import { openingEdge } from '../pointer/opening'
import type { Pens } from '../pointer/pens'
import { placeHolds } from '../pointer/place'
import type { PlanPointer } from '../pointer/usePlanPointer'
import type { PlanSelection } from '../selection'
import { Offcut, RollPreview } from './FloorLayer'
import { lanePill, tileArea, tileAreaMeasures } from './floorPhantoms'
import { doorAim, doorHeld, motifPreview, objectPreview } from './placePhantoms'
import { AimRect, AimSeg, EraseStroke, Ring } from './Previews'
import { RoomHandles } from './RoomLayer'
import { beamPhantom, dropPhantom, textilePhantom, wallPhantom, type Phantom } from './strokePhantoms'

interface Props {
  v: Variant
  tool: Tool
  brush: Brush | null
  selection: PlanSelection
  pen: Pens
  hits: PlanHits
  floor: FloorBrush
  floorSize: FloorBrushSize
  rollMode?: RollMode
  /** Cell size of the textile brush's drawing grid, m. */
  step: number
  /** Standard beams, which a drawn takdrager may not lie along. */
  standardRuns: Run[]
  pointer: Pick<PlanPointer, 'hover' | 'dragging' | 'rollPending' | 'fillRect' | 'stroke' | 'textileStroke' | 'dropHover'>
  motifs?: Motif[]
  mini?: boolean
  onHint?: (text: string | null) => void
}

export function PreviewLayer(p: Props) {
  const { v, tool, brush, selection, pen, hits, mini } = p
  const { hover, dragging, rollPending, fillRect, stroke, textileStroke, dropHover } = p.pointer
  const { wallTool, floorTool, openingTool, decorTool, textileTool, beamTool, objectTool } = pen
  const { onStand, faceHit } = hits
  const sc = usePlanScale()
  const { width: W, depth: D } = v.stand
  const centre: [number, number] = [W / 2, D / 2]
  const rollWidth = rollWidthOf(brush)
  const carpetFill = isCarpetFill(tool, brush, p.rollMode)

  // Wall and takdrager aim at a point: the grid node nearest the pointer (a press shows the module it lays)
  const wallNode: [number, number] | null =
    (wallTool || beamTool) && hover && !stroke && onStand(hover) ? [Math.max(0, Math.min(W, Math.round(hover.x))), Math.max(0, Math.min(D, Math.round(hover.y)))] : null

  // Textile brush: next to a wall the click target is the free part of that face (or why there is none); elsewhere
  // the grid node a stroke starts from
  const textileFace = textileTool && hover && !textileStroke ? faceHit(hover, 0.2) : null
  const textileAim = textileFace ? fillFace(v, rules, textileFace.w.id, textileFace.s, textileFace.t) : null
  const textileAimSeg = textileAim && 'mounted' in textileAim ? (() => {
    const t = textileAim.v.textiles.find((x) => x.id === textileAim.mounted.id)!
    return faceSegment(textileFace!.w, textileFace!.s, t.from, t.from + t.width, textileOffset(sc))
  })() : null
  const freeNode = textileTool && !textileFace && hover && !textileStroke && onStand(hover) ? freeStroke(v, rules, hover, hover, p.step)[0] : null

  // Stroke tools pressed or dragging: what a release stores, or why it stores nothing
  const phantom: Phantom | null =
    stroke && tool !== 'erase' && wallTool
      ? wallPhantom(sc, { v, a: stroke[0], b: stroke[1], ral: brush?.kind === 'wall' ? brush.ral : undefined, centre })
      : stroke && tool !== 'erase' && beamTool
        ? beamPhantom(sc, { v, a: stroke[0], b: stroke[1], standard: p.standardRuns, centre })
        : textileStroke
          ? textilePhantom(sc, { v, line: textileStroke, face: faceHit(textileStroke.at), centre })
          : dropHover
            ? dropPhantom(sc, { v, h: dropHover.h, d: dropHover.d, centre })
            : null

  // Door, motif and furniture: aim while hovering, the phantom while pressed over the target the press hit
  // (pointer/place.ts); dragged off it, the aim of the new target shows and a release stores nothing. A door pressed
  // follows the pointer out to the side it is to swing to
  const placing = dragging?.kind === 'place' ? dragging : null
  const held = (what: 'opening' | 'decor' | 'object') => !!placing && placing.what === what && !!hover && placeHolds({ v, hits, brush }, placing, hover)
  const doorEdge = openingTool && hover && !placing ? openingEdge({ v, hits }, hover) : null
  const placed: Phantom | null =
    mini || !hover
      ? null
      : brush?.kind === 'opening' && placing?.what === 'opening' && placing.module
        ? doorHeld(sc, v, placing.module, brush.product, !!placing.door, hover, held('opening'))
        : brush?.kind === 'opening' && doorEdge
          ? doorAim(sc, v, doorEdge)
          : decorTool && brush?.kind === 'motif'
            ? motifPreview(sc, v, hits, hover, brush.motif, ratioOf(p.motifs)(brush.motif), held('decor'))
            : objectTool && brush?.kind === 'object' && onStand(hover)
              ? objectPreview(sc, v, brush.product, hover, held('object'))
              : null

  // Floor: carpet tiles paint while dragging, so only the area painted so far is measured
  const hoverAction = floorTool && hover && !dragging ? p.floor.floorTouch(hover, null) : null
  const hoverFloor = hoverAction && hoverAction.kind !== 'none' && !rollWidth && !carpetFill ? hoverAction : null
  const tileDrag = dragging?.kind === 'floor' && dragging.anchor && hover && !rollWidth && brush?.kind === 'floor'
    ? tileArea(dragging.anchor, hover, p.floorSize, standCells(v.stand))
    : null
  // Bane: the lanes as they will be laid only while pressed; the hover aims with a ring in the cell
  const lanes = rollWidth && tool === 'brush' && !carpetFill
  const rollPreview = lanes && rollPending && brush?.kind === 'floor' ? lanesLaid(rollPending, brush.product, p.floor.dir) : []
  const rollAim = lanes && !rollPending && hoverAction && hoverAction.kind !== 'none' && hover
    ? ([(Math.floor(hover.x / CELL) + 0.5) * CELL, (Math.floor(hover.y / CELL) + 0.5) * CELL] as [number, number])
    : null
  // Fyll: the cheapest way to lay the area being dragged, or the whole stand that a click fills. Only while pressed or
  // dragging; the hover aims at the stand with a dashed outline
  const fillProduct = brush?.kind === 'floor' ? brush.product : ''
  const hoverOnStand = !!hover && hover.x >= 0 && hover.y >= 0 && hover.x < W && hover.y < D
  const fillHeld = dragging?.kind === 'carpetFill'
  const fillKey = fillRect ? `${fillRect.i},${fillRect.j},${fillRect.w},${fillRect.h}` : carpetFill && fillHeld && hoverOnStand ? 'stand' : ''
  const fillAim = carpetFill && !fillHeld && hoverOnStand && !mini
  // Only the floor, the stand and the area change the proposal, so moving the pointer inside the stand reuses it
  const fillPreview = useMemo(
    () => (carpetFill && fillKey && rollWidth ? (fillProposalsFor(v, fillProduct, rollWidth, rules.carpet, fillRect ?? undefined)[0] ?? null) : null),
    [carpetFill, fillKey, fillProduct, rollWidth, v, fillRect],
  )

  // The chosen engangsteppe (Velg): its lanes, outlined while its drawer is open
  const selLane = tool === 'select' && !mini && selection.lane ? laneAt(v, selection.lane.i, selection.lane.j) : undefined
  const selLanes = tool !== 'select' || mini ? [] : selection.fill ? fillTilesOf(v, selection.fill) : selLane ? [selLane] : []

  const hint = mini ? null : (phantom?.hint ?? placed?.hint ?? (textileAim && 'error' in textileAim ? textileAim.error : null))
  const onHint = p.onHint
  useEffect(() => onHint?.(hint), [onHint, hint])
  useEffect(() => () => onHint?.(null), [onHint])

  return (
    <g pointerEvents="none">
      {!mini && v.rooms.filter((r) => r.id === selection.roomId).map((r) => <RoomHandles key={r.id} r={r} />)}
      {wallNode && <Ring at={wallNode} />}
      {stroke && tool === 'erase' && <EraseStroke a={stroke[0]} b={stroke[1]} centre={centre} />}
      {phantom?.el}
      {freeNode && <Ring at={freeNode} />}
      {textileAimSeg && <AimSeg a={textileAimSeg[0]} b={textileAimSeg[1]} />}
      {placed?.el}
      {rollPreview.length > 0 && <RollPreview tiles={rollPreview} color={idx.byArtnr.get(rollPreview[0].product)?.variant.color} roll={rollWidth!} stand={standCells(v.stand)} />}
      {rollPreview.length > 0 && lanePill(rollPreview, rollWidth!, centre)}
      {rollAim && <Ring at={rollAim} />}
      {fillPreview && <RollPreview tiles={fillPreview.tiles} color={idx.byArtnr.get(fillProduct)?.variant.color} roll={rollWidth!} />}
      {fillRect && <AimRect x={fillRect.i * CELL} y={fillRect.j * CELL} width={fillRect.w * CELL} height={fillRect.h * CELL} halo />}
      {fillAim && <AimRect x={0} y={0} width={W} height={D} halo />}
      {tileDrag && brush?.kind === 'floor' && tileAreaMeasures(v, tileDrag, brush.product, centre)}
      {selLanes.length > 0 && (
        <g>
          {selLane && <Offcut t={selLane} roll={idx.byArtnr.get(selLane.product)?.product.roll ?? 2} stand={standCells(v.stand)} />}
          {selLanes.map((t) => (
            <rect key={`${t.i},${t.j}`} x={t.i * CELL} y={t.j * CELL} width={t.w * CELL} height={t.h * CELL} fill={INK} fillOpacity={0.06} stroke={INK} strokeWidth={0.025} strokeDasharray=".1 .06" />
          ))}
        </g>
      )}
      {hoverFloor && <AimRect x={hoverFloor.rect.i * CELL} y={hoverFloor.rect.j * CELL} width={hoverFloor.rect.w * CELL} height={hoverFloor.rect.h * CELL} halo />}
    </g>
  )
}
