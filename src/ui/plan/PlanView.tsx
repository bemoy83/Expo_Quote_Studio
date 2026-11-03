// 2D plan. Explicit layers, bottom to top: ground, floor, grid, walls, openings, textiles, beams and posts,
// objects, labels, interaction preview. Pointer handling is done on the svg with model coordinates, so the
// draw order never decides what can be clicked. Each product's layer is drawn in plan/layers/ (FloorLayer, WallLayer,
// TextileLayer, BeamLayer, ObjectLayer, RoomLayer, Labels, Previews), and the pointer handling lives in plan/pointer/
// (usePlanPointer, one file per drag kind). This file puts them together with the cursor and the hover previews.
import { useMemo } from 'react'
import type { CalcResult } from '../../calc/calc'
import { canMoveWall } from '../../domain/edit'
import { CELL, openSides, sideLength, sidePoint } from '../../domain/grid'
import { conflicts } from '../../domain/objects'
import { freeStroke, freeTextileAt } from '../../domain/textile/free'
import type { Motif } from '../../persistence/file'
import type { Side, Variant } from '../../domain/types'
import { builtModules, doorAllowed, standWallKeys } from '../../domain/walls'
import { BORDER, INK, SURFACE } from '../colors'
import type { Run } from '../../domain/innerBeams'
import { roomAt, sideIsHorizontal } from '../../domain/rooms'
import { idx, place, rules } from '../env'
import { penLayers, type Brush, type Highlight, type Layer, type Tool } from '../tools'
import type { RollDir } from '../../domain/floor/lanes'
import { type FloorBrushSize, lanesLaid } from '../../domain/floor/brush'
import { standCells } from '../../domain/floor/tiles'
import { fillProposalsFor, fillTilesOf } from '../../domain/floor/rollFill'
import { laneAt } from '../../domain/floor/edit'
import type { RollMode } from '../tools'
import { nearestEdge } from './geometry'
import type { PlanSelection } from './selection'
import { DIMMED, GRID_FINE, PLAN_MARGIN, PLAN_WALL, TEXTILE, WALL } from './planStyle'
import { Seg } from './layers/Seg'
import { FloorLayer, Offcut, RollPreview } from './layers/FloorLayer'
import { WallLayer } from './layers/WallLayer'
import { TextileLayer } from './layers/TextileLayer'
import { BeamLayer } from './layers/BeamLayer'
import { ObjectLayer } from './layers/ObjectLayer'
import { RoomHandles, RoomLayer } from './layers/RoomLayer'
import { Labels } from './layers/Labels'
import { floorBrush, isCarpetFill, rollWidthOf } from './pointer/floorBrush'
import { planHits } from './pointer/hits'
import { openingEdge } from './pointer/opening'
import { pens } from './pointer/pens'
import { usePlanPointer } from './pointer/usePlanPointer'
import { EraseMarkView, FacePreview, HoverModule, SnapDots, StrokePreview, TextilePreview } from './layers/Previews'
import { eraseTargetAt } from './pointer/erase'

interface Props {
  v: Variant
  res: CalcResult
  tool: Tool
  brush: Brush | null
  floorSize: FloorBrushSize
  /** Direction lanes of rolled floor run when the brush lays them. */
  rollDir?: RollDir
  /** Rolled floor: Fyll marks an area the engine lays, Bane places one lane. */
  rollMode?: RollMode
  /** Cell size of the drawing grid for the textile brush, m (domain/snapGrid). */
  gridStep?: number
  highlight: Highlight
  selection: PlanSelection
  onSelect: (s: PlanSelection) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onCheckpoint: () => void
  onToast: (text: string) => void
  /** Small overview (the 3D view's mini plan): no labels, tighter margin. */
  mini?: boolean
  /** Motif library, for the decal ratio when a motif is put on a wall panel. */
  motifs?: Motif[]
  /** Main groups (catalog/groups.ts) to show at full strength; the rest are dimmed. All when left out. */
  groups?: ReadonlySet<string>
}

/** Main group of each plan layer. Objects go by their own product. */
const LAYER_GROUP: Record<Exclude<Highlight, null | 'objects'>, string> = { walls: 'vegg', beams: 'vegg', openings: 'vegg', floor: 'gulv', textile: 'prof', foil: 'prof' }

const M = PLAN_MARGIN
/** The aisle in the margin along each side, as x, y, width, height. It runs the whole margin, past the corners. */
const AISLE_BAND: Record<Side, (W: number, D: number) => [number, number, number, number]> = {
  front: (W, D) => [-M, D, W + 2 * M, M],
  back: (W) => [-M, -M, W + 2 * M, M],
  left: (_, D) => [-M, -M, M, D + 2 * M],
  right: (W, D) => [W, -M, M, D + 2 * M],
}

/** Opacity of layers the pen in hand does not work on: lighter than the calc hover, they still give the context. */
const PEN_DIMMED = 0.45

export function PlanView(p: Props) {
  const { v, res, tool, brush, highlight, selection } = p
  const step = p.gridStep ?? rules.textile.grid
  const { width: W, depth: D } = v.stand

  const mods = useMemo(() => builtModules(v), [v])
  const bad = useMemo(() => conflicts(v, place), [v])
  /** Edges carrying a stand wall: locked, and the only ones the side labels count (an inner wall leaves a side open). */
  const standKeys = useMemo(() => standWallKeys(v), [v])
  /** Standard beams: a drawn one may not lie along them. A støttedrager may be drawn over: the drawn beam replaces it. */
  const standardRuns: Run[] = useMemo(() => res.beams.segments.filter((s) => !s.inner && !s.support), [res])

  const pen = pens(tool, brush)
  const { wallTool, floorTool, openingTool, decorTool, textileTool, beamTool } = pen
  const hits = planHits(v, mods, selection)
  const { onStand, moduleAt, beamAt, faceHit, roomEdgeAt, objectAt } = hits
  const fb = floorBrush(v, { tool, brush, floorSize: p.floorSize, rollDir: p.rollDir, rollMode: p.rollMode })
  const { dir, floorTouch } = fb
  const rollWidth = rollWidthOf(brush)
  const carpetFill = isCarpetFill(tool, brush, p.rollMode)
  /** Snap points show only while a brush snaps to them, at its own grid. */
  const dotStep = textileTool ? step : wallTool || beamTool ? rules.wall.cc : null

  const { svg, hover, dragging, rollPending, fillRect, stroke, textileStroke, dropHover, eraseMark, handlers } = usePlanPointer({
    v,
    tool,
    brush,
    selection,
    pens: pen,
    hits,
    floor: fb,
    step,
    standardRuns,
    standKeys,
    motifs: p.motifs,
    mini: p.mini,
    onEdit: p.onEdit,
    onCheckpoint: p.onCheckpoint,
    onToast: p.onToast,
    onSelect: p.onSelect,
  })

  const off = (group: string) => !!p.groups && !p.groups.has(group)
  const keep = p.mini ? null : penLayers(tool, brush)
  /** Opacity of a layer group: the hovered calc group and the shown product groups win, then the pen in hand. */
  const dim = (...layers: Layer[]) =>
    (highlight && !layers.includes(highlight)) || layers.every((l) => l !== 'objects' && off(LAYER_GROUP[l]))
      ? DIMMED
      : keep && !layers.some((l) => keep.has(l))
        ? PEN_DIMMED
        : 1
  const cursor = tool !== 'select' ? 'crosshair' : roomCursor()
  function roomCursor() {
    const d = dragging
    if (d?.kind === 'room') return d.mode === 'move' ? 'grabbing' : d.horizontal ? 'ns-resize' : 'ew-resize'
    if (!hover || p.mini) return 'default'
    const e = roomEdgeAt(hover)
    if (e) return sideIsHorizontal(e.room, e.side) ? 'ns-resize' : 'ew-resize'
    if (d?.kind === 'wall' || d?.kind === 'beam' || d?.kind === 'freeMove') return 'grabbing'
    if (freeTextileAt(v, hover, 0.15)) return 'move'
    if (objectAt(hover)) return 'default'
    if (beamAt(hover)) return 'move'
    const m = moduleAt(hover)
    const w = m && v.walls.find((x) => x.id === m.wallId)
    if (w) return canMoveWall(w) ? 'move' : 'default'
    return roomAt(v, hover.x, hover.y) ? 'move' : 'default'
  }

  // Hover previews
  const hoverEdge = openingTool && hover ? openingEdge({ v, hits }, hover) : null
  const hoverModule = hoverEdge && doorAllowed(v, hoverEdge.a, hoverEdge.b) ? hoverEdge : null
  const hoverAction = floorTool && hover && !dragging ? floorTouch(hover, null) : null
  // Roll brush: the lanes as they will be laid, from the hover or the stroke in progress
  const rollTouch = rollWidth && tool === 'brush' && !carpetFill ? (rollPending ?? hoverAction) : null
  const rollPreview = rollTouch && brush?.kind === 'floor' ? lanesLaid(rollTouch, brush.product, dir) : []
  const hoverFloor = hoverAction && hoverAction.kind !== 'none' && !rollPreview.length && !carpetFill ? hoverAction : null
  // Fyll: the cheapest way to lay the area being dragged, or the whole stand that a click fills
  const fillProduct = brush?.kind === 'floor' ? brush.product : ''
  const hoverOnStand = !!hover && hover.x >= 0 && hover.y >= 0 && hover.x < W && hover.y < D
  const fillKey = fillRect ? `${fillRect.i},${fillRect.j},${fillRect.w},${fillRect.h}` : carpetFill && hoverOnStand ? 'stand' : ''
  // Only the floor, the stand and the area change the proposal, so moving the pointer inside the stand reuses it
  const fillPreview = useMemo(
    () => (carpetFill && fillKey && rollWidth ? (fillProposalsFor(v, fillProduct, rollWidth, rules.carpet, fillRect ?? undefined)[0] ?? null) : null),
    [carpetFill, fillKey, fillProduct, rollWidth, v, fillRect],
  )
  // The chosen engangsteppe (Velg): its lanes, outlined while its drawer is open
  const selLane = tool === 'select' && !p.mini && selection.lane ? laneAt(v, selection.lane.i, selection.lane.j) : undefined
  const selLanes = tool !== 'select' || p.mini ? [] : selection.fill ? fillTilesOf(v, selection.fill) : selLane ? [selLane] : []
  // Textile brush: next to a wall the click target is that face; elsewhere the grid node a stroke starts from
  const textileFace = textileTool && hover && !textileStroke ? faceHit(hover, 0.2) : null
  const hoverFace = (decorTool && hover ? faceHit(hover) : null) ?? textileFace
  const hoverWallEdge = (wallTool || beamTool) && hover && !stroke && onStand(hover) ? nearestEdge(v.stand, hover) : null
  const hoverFree = textileTool && !textileFace && hover && !textileStroke && onStand(hover) ? freeStroke(v, rules, hover, hover, step)[0] : null

  // Tøm: what a click takes, from the hover (PC) or the press (touch, no hover). A stroke shows its own line.
  const eraseHover = tool === 'erase' && !p.mini && hover && !dragging && !stroke ? (eraseTargetAt(v, hits, standKeys, hover)?.mark ?? null) : null
  const eraseShown = eraseMark ?? eraseHover

  const sideText = (s: Side) => {
    const n = sideLength(v.stand, s)
    let c = 0
    for (let t = 0; t < n; t++) {
      const a = sidePoint(v.stand, s, t)
      const b = sidePoint(v.stand, s, t + 1)
      if (standKeys.has(nearestEdge(v.stand, { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 }).key)) c++
    }
    return c === 0 ? 'gang' : c === n ? 'standvegg' : 'delvis standvegg'
  }

  return (
    <svg
      ref={svg}
      className="plan-svg"
      viewBox={p.mini ? `-0.4 -0.4 ${W + 0.8} ${D + 0.8}` : `${-M} ${-M} ${W + 2 * M} ${D + 2 * M}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ cursor }}
      {...handlers}
      role="img"
      aria-label={`Plan for standen, ${W} × ${D} m`}
    >
      {/* Ground: an aisle along every open side, and the stand surface */}
      <g>
        {openSides(v.stand).map((s) => {
          const r = AISLE_BAND[s](W, D)
          return <rect key={s} x={r[0]} y={r[1]} width={r[2]} height={r[3]} fill="var(--sunken-2)" />
        })}
        <rect x={0} y={0} width={W} height={D} fill={SURFACE} />
      </g>

      {/* Grid, under the floor: a laid floor shows its own joints */}
      <g pointerEvents="none">
        {Array.from({ length: W - 1 }, (_, i) => (
          <line key={`gx${i}`} x1={i + 1} y1={0} x2={i + 1} y2={D} stroke={BORDER} strokeWidth={0.012} />
        ))}
        {Array.from({ length: D - 1 }, (_, j) => (
          <line key={`gy${j}`} x1={0} y1={j + 1} x2={W} y2={j + 1} stroke={BORDER} strokeWidth={0.012} />
        ))}
      </g>

      {/* Floor: carpet tiles with a joint at every tile edge, rolled floor without */}
      <FloorLayer v={v} dim={dim} />

      {/* Drawing grids: every half metre while painting floor, snap dots for straight runs */}
      <g pointerEvents="none">
        {floorTool &&
          Array.from({ length: Math.round(W / CELL) - 1 }, (_, i) => (
            <line key={`hx${i}`} x1={(i + 1) * CELL} y1={0} x2={(i + 1) * CELL} y2={D} stroke={GRID_FINE} strokeWidth={0.008} strokeDasharray=".04 .04" />
          ))}
        {floorTool &&
          Array.from({ length: Math.round(D / CELL) - 1 }, (_, j) => (
            <line key={`hy${j}`} x1={0} y1={(j + 1) * CELL} x2={W} y2={(j + 1) * CELL} stroke={GRID_FINE} strokeWidth={0.008} strokeDasharray=".04 .04" />
          ))}
        {dotStep && <SnapDots W={W} D={D} step={dotStep} />}
      </g>

      {/* Walls and openings */}
      <WallLayer v={v} mods={mods} selection={selection} dim={dim} />

      {/* Free-standing textile walls, textile walls on a wall face, foil decor */}
      <TextileLayer v={v} res={res} selection={selection} mini={p.mini} dim={dim} />

      {/* Beams and posts */}
      <BeamLayer v={v} res={res} selection={selection} dim={dim} />

      {/* Objects */}
      <ObjectLayer v={v} selection={selection} tool={tool} bad={bad} dim={dim} off={off} />

      {/* Rooms: name and size over the floor and furniture, the selected one outlined */}
      {!p.mini && <RoomLayer v={v} selection={selection} />}

      {/* Labels */}
      {!p.mini && <Labels W={W} D={D} sideText={sideText} floorAreas={res.keyFigures.floor} />}

      {/* Interaction preview */}
      <g pointerEvents="none">
        {!p.mini && v.rooms.filter((r) => r.id === selection.roomId).map((r) => <RoomHandles key={r.id} r={r} />)}
        {hoverWallEdge && <Seg a={hoverWallEdge.a} b={hoverWallEdge.b} stroke={beamTool ? INK : WALL} strokeOpacity={0.6} strokeWidth={PLAN_WALL} strokeDasharray={beamTool ? '.16 .08' : undefined} />}
        {stroke && <StrokePreview a={stroke[0]} b={stroke[1]} erase={tool === 'erase'} beam={beamTool} />}
        {textileStroke && <TextilePreview v={v} line={textileStroke} />}
        {hoverFree && <circle cx={hoverFree[0]} cy={hoverFree[1]} r={0.06} fill={TEXTILE} />}
        {hoverModule && <HoverModule m={hoverModule} />}
        {hoverFace && <FacePreview v={v} h={hoverFace} brush={brush!} />}
        {dropHover && <FacePreview v={v} h={dropHover.h} brush={dropHover.d} />}
        {rollPreview.length > 0 && <RollPreview tiles={rollPreview} color={idx.byArtnr.get(rollPreview[0].product)?.variant.color} roll={rollWidth!} stand={standCells(v.stand)} />}
        {fillPreview && <RollPreview tiles={fillPreview.tiles} color={idx.byArtnr.get(fillProduct)?.variant.color} roll={rollWidth!} />}
        {fillRect && (
          <rect x={fillRect.i * CELL} y={fillRect.j * CELL} width={fillRect.w * CELL} height={fillRect.h * CELL} fill="none" stroke={INK} strokeWidth={0.03} strokeDasharray=".08 .06" />
        )}
        {selLanes.length > 0 && (
          <g>
            {selLane && <Offcut t={selLane} roll={idx.byArtnr.get(selLane.product)?.product.roll ?? 2} stand={standCells(v.stand)} />}
            {selLanes.map((t) => (
              <rect key={`${t.i},${t.j}`} x={t.i * CELL} y={t.j * CELL} width={t.w * CELL} height={t.h * CELL} fill={INK} fillOpacity={0.06} stroke={INK} strokeWidth={0.025} strokeDasharray=".1 .06" />
            ))}
          </g>
        )}
        {hoverFloor && (
          <rect
            x={hoverFloor.rect.i * CELL}
            y={hoverFloor.rect.j * CELL}
            width={hoverFloor.rect.w * CELL}
            height={hoverFloor.rect.h * CELL}
            rx={0.02}
            fill={brush?.kind !== 'floor' ? SURFACE : idx.byArtnr.get(brush.product)?.variant.color}
            fillOpacity={0.75}
            stroke={INK}
            strokeWidth={0.03}
          />
        )}
        {eraseShown && <EraseMarkView m={eraseShown} />}
      </g>
    </svg>
  )
}
