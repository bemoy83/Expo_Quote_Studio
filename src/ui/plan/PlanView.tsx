// 2D plan. Explicit layers, bottom to top: ground, floor, grid, walls, openings, textiles, beams and posts,
// objects, labels, interaction preview. Pointer handling is done on the svg with model coordinates, so the
// draw order never decides what can be clicked. Each product's layer is drawn in plan/layers/ (FloorLayer, WallLayer,
// TextileLayer, BeamLayer, ObjectLayer, RoomLayer, Labels, Previews), and the pointer handling lives in plan/pointer/
// (usePlanPointer, one file per drag kind). This file puts them together with the cursor and the hover previews.
import { useEffect, useMemo } from 'react'
import type { CalcResult } from '../../calc/calc'
import { canMoveWall } from '../../domain/edit'
import { CELL, openSides, sideLength, sidePoint } from '../../domain/grid'
import { conflicts } from '../../domain/objects'
import { freeStroke, freeTextileAt } from '../../domain/textile/free'
import type { Motif } from '../../persistence/file'
import type { Side, Variant } from '../../domain/types'
import { builtModules, standWallKeys } from '../../domain/walls'
import { INK, SURFACE } from '../colors'
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
import { DIMMED, GRID, GRID_FINE, GRID_PX, PLAN_MARGIN, textileOffset } from './planStyle'
import { FloorLayer, Offcut, RollPreview } from './layers/FloorLayer'
import { WallLayer } from './layers/WallLayer'
import { TextileLayer } from './layers/TextileLayer'
import { BeamLayer } from './layers/BeamLayer'
import { ObjectLayer } from './layers/ObjectLayer'
import { RoomHandles, RoomLayer } from './layers/RoomLayer'
import { Labels } from './layers/Labels'
import { DimLayer } from './layers/DimLayer'
import { Legend } from './layers/Legend'
import { PosLayer } from './layers/PosLayer'
import { totalSides } from './dims'
import { floorBrush, isCarpetFill, rollWidthOf } from './pointer/floorBrush'
import { planHits } from './pointer/hits'
import { openingEdge } from './pointer/opening'
import { pens } from './pointer/pens'
import { usePlanPointer } from './pointer/usePlanPointer'
import { AimRect, AimSeg, EraseStroke, Ring, SnapDots } from './layers/Previews'
import { doorPreview, motifPreview, objectPreview } from './layers/placePhantoms'
import { placeKey } from './pointer/place'
import { ratioOf } from './pointer/decor'
import { lanePill, tileArea, tileAreaMeasures } from './layers/floorPhantoms'
import { beamPhantom, dropPhantom, textilePhantom, wallPhantom, type Phantom } from './layers/strokePhantoms'
import { faceSegment } from '../../domain/faces'
import { fillFace } from '../../domain/textile/brush'
import { eraseTargetAt, type Erasing } from './pointer/erase'
import { ErasingProvider } from './layers/ErasingProvider'
import { linePx, planScale, PlanScaleContext, usePxPerMetre } from './planScale'

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
  /** Drawn on the quote or the work order: lines 1,5 times as wide, so they survive printing. */
  doc?: boolean
  /** The floor in full colour with joints (the work order with floor shown). While drawing, the floor pen or the floor
   * group hovered in the calc or a chosen lane does it; otherwise the floor is a muted layer. */
  floorFull?: boolean
  /** Position numbers (the quote's and the work order's small plan; never on the drawing surface). */
  positions?: boolean
  /** Why what the pointer aims at cannot be stored (or that it is already there), for the hint line; null when it can. */
  onHint?: (text: string | null) => void
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

  const { svg, hover, dragging, rollPending, fillRect, stroke, textileStroke, dropHover, erasing, handlers } = usePlanPointer({
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
  const hoverAction = floorTool && hover && !dragging ? floorTouch(hover, null) : null
  // Roll brush: the lanes as they will be laid, from the hover or the stroke in progress
  // Bane: the lanes only while pressed; the hover aims with a ring in the cell
  const rollTouch = rollWidth && tool === 'brush' && !carpetFill ? rollPending : null
  const rollAim = rollWidth && tool === 'brush' && !carpetFill && !rollPending && hoverAction && hoverAction.kind !== 'none' && hover
    ? ([(Math.floor(hover.x / CELL) + 0.5) * CELL, (Math.floor(hover.y / CELL) + 0.5) * CELL] as [number, number])
    : null
  const rollPreview = rollTouch && brush?.kind === 'floor' ? lanesLaid(rollTouch, brush.product, dir) : []
  const hoverFloor = hoverAction && hoverAction.kind !== 'none' && !rollWidth && !carpetFill ? hoverAction : null
  // Carpet tiles: the area painted so far in this stroke, measured
  const tileDrag = dragging?.kind === 'floor' && dragging.anchor && hover && !rollWidth && brush?.kind === 'floor'
    ? tileArea(dragging.anchor, hover, p.floorSize, standCells(v.stand))
    : null
  // Fyll: the cheapest way to lay the area being dragged, or the whole stand that a click fills
  const fillProduct = brush?.kind === 'floor' ? brush.product : ''
  const hoverOnStand = !!hover && hover.x >= 0 && hover.y >= 0 && hover.x < W && hover.y < D
  // Only while pressed or dragging: the hover aims at the stand with a dashed outline
  const fillHeld = dragging?.kind === 'carpetFill'
  const fillKey = fillRect ? `${fillRect.i},${fillRect.j},${fillRect.w},${fillRect.h}` : carpetFill && fillHeld && hoverOnStand ? 'stand' : ''
  const fillAim = carpetFill && !fillHeld && hoverOnStand && !p.mini
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
  // Wall and takdrager aim at a point: the grid node nearest the pointer (a press shows the module it lays)
  const hoverWallNode: [number, number] | null =
    (wallTool || beamTool) && hover && !stroke && onStand(hover) ? [Math.max(0, Math.min(W, Math.round(hover.x))), Math.max(0, Math.min(D, Math.round(hover.y)))] : null
  const hoverFree = textileTool && !textileFace && hover && !textileStroke && onStand(hover) ? freeStroke(v, rules, hover, hover, step)[0] : null

  // Tøm: what a click takes, from the hover (PC) or the press (touch, no hover), dimmed and hatched in its own layer.
  // A stroke along walls shows its own line.
  const hoverTarget = tool === 'erase' && !p.mini && hover && !dragging && !stroke ? eraseTargetAt(v, hits, standKeys, hover) : null
  const erasingShown: Erasing | null = erasing ?? (hoverTarget && hoverTarget.group !== 'locked' ? { group: hoverTarget.group, id: hoverTarget.id } : null)

  // Line widths in screen pixels (planScale.ts): measure how many pixels a metre takes
  const vb = p.mini ? { x: -0.4, y: -0.4, w: W + 0.8, h: D + 0.8 } : { x: -M, y: -M, w: W + 2 * M, h: D + 2 * M }
  const pxPerM = usePxPerMetre(svg, vb.w, vb.h)
  const scale = useMemo(() => planScale(pxPerM, { doc: p.doc, mini: p.mini }), [pxPerM, p.doc, p.mini])

  // Phantoms while pressed or dragging (docs/forhandsvisning.md): what a release stores, or why it stores nothing
  const centre: [number, number] = [W / 2, D / 2]
  const phantom: Phantom | null =
    stroke && tool !== 'erase' && wallTool
      ? wallPhantom(scale, { v, a: stroke[0], b: stroke[1], ral: brush?.kind === 'wall' ? brush.ral : undefined, centre })
      : stroke && tool !== 'erase' && beamTool
        ? beamPhantom(scale, { v, a: stroke[0], b: stroke[1], standard: standardRuns, centre })
        : textileStroke
          ? textilePhantom(scale, { v, line: textileStroke, face: faceHit(textileStroke.at), centre })
          : dropHover
            ? dropPhantom(scale, { v, h: dropHover.h, d: dropHover.d, centre })
            : null
  // Aim of the textile brush next to a wall: the free part of the face a click fills, or why there is none
  const textileAim = textileFace ? fillFace(v, rules, textileFace.w.id, textileFace.s, textileFace.t) : null
  const textileAimSeg = textileAim && 'mounted' in textileAim ? (() => {
    const t = textileAim.v.textiles.find((x) => x.id === textileAim.mounted.id)!
    return faceSegment(textileFace!.w, textileFace!.s, t.from, t.from + t.width, textileOffset(scale))
  })() : null
  // Door, motif and furniture: aim while hovering, the phantom while pressed over the target the press hit
  // (pointer/place.ts); dragged off it, the aim of the new target shows and a release stores nothing
  const placing = dragging?.kind === 'place' ? dragging : null
  const held = (what: 'opening' | 'decor' | 'object') => !!placing && placing.what === what && !!hover && placeKey({ v, hits, brush }, what, hover) === placing.key
  const placePreview =
    p.mini || !hover
      ? null
      : hoverEdge && brush?.kind === 'opening'
        ? doorPreview(scale, v, hoverEdge, !!hits.moduleAt(hover, 0.4), brush.product, held('opening'))
        : decorTool && brush?.kind === 'motif'
          ? motifPreview(scale, v, hits, hover, brush.motif, ratioOf(p.motifs)(brush.motif), held('decor'))
          : pen.objectTool && brush?.kind === 'object' && onStand(hover)
            ? objectPreview(scale, v, brush.product, hover, held('object'))
            : null
  const planHint = p.mini ? null : (phantom?.hint ?? placePreview?.hint ?? (textileAim && 'error' in textileAim ? textileAim.error : null))
  const onHint = p.onHint
  useEffect(() => onHint?.(planHint), [onHint, planHint])
  useEffect(() => () => onHint?.(null), [onHint])

  const totals = useMemo(() => new Set(totalSides(v)), [v])

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
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ cursor }}
      {...handlers}
      role="img"
      aria-label={`Plan for standen, ${W} × ${D} m`}
    >
      <PlanScaleContext.Provider value={scale}>
      {/* Ground: an aisle along every open side, and the stand surface */}
      <g>
        {openSides(v.stand).map((s) => {
          const r = AISLE_BAND[s](W, D)
          return <rect key={s} x={r[0]} y={r[1]} width={r[2]} height={r[3]} fill="var(--sunken-2)" />
        })}
        <rect x={0} y={0} width={W} height={D} fill={SURFACE} />
      </g>

      {/* Grid, under the floor: a laid floor shows its own joints. Metre lines in faint ink, a hairline */}
      <g pointerEvents="none" stroke={GRID} strokeWidth={linePx(scale, GRID_PX)}>
        {Array.from({ length: W - 1 }, (_, i) => (
          <line key={`gx${i}`} x1={i + 1} y1={0} x2={i + 1} y2={D} />
        ))}
        {Array.from({ length: D - 1 }, (_, j) => (
          <line key={`gy${j}`} x1={0} y1={j + 1} x2={W} y2={j + 1} />
        ))}
      </g>

      <ErasingProvider erasing={erasingShown}>
      {/* Floor: carpet tiles with a joint at every tile edge, rolled floor without */}
      <FloorLayer v={v} dim={dim} full={!!p.floorFull || floorTool || highlight === 'floor' || !!selection.lane || !!selection.fill} />

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

      </ErasingProvider>

      {/* Labels */}
      {!p.mini && <Labels W={W} D={D} sideText={sideText} totals={totals} />}

      {/* Dimension chains in millimetres: totals, placement rows, module chain of the selected wall */}
      {!p.mini && <DimLayer v={v} selection={selection} />}
      {p.positions && <PosLayer v={v} res={res} dim={dim} />}

      {/* Legend and drawing head in the front aisle: always on the documents; while drawing only with Velg, when no
          quick picks float over the bottom of the plan */}
      {!p.mini && (p.doc || tool === 'select') && <Legend v={v} res={res} doc={!!p.doc} />}

      {/* Interaction preview */}
      <g pointerEvents="none">
        {!p.mini && v.rooms.filter((r) => r.id === selection.roomId).map((r) => <RoomHandles key={r.id} r={r} />)}
        {hoverWallNode && <Ring at={hoverWallNode} />}
        {stroke && tool === 'erase' && <EraseStroke a={stroke[0]} b={stroke[1]} centre={centre} />}
        {phantom?.el}
        {hoverFree && <Ring at={hoverFree} />}
        {textileAimSeg && <AimSeg a={textileAimSeg[0]} b={textileAimSeg[1]} />}
        {placePreview?.el}
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
      </PlanScaleContext.Provider>
    </svg>
  )
}
