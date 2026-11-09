// 2D plan. Explicit layers, bottom to top: ground, floor, grid, walls, openings, textiles, shelves, beams and posts,
// objects, labels, interaction preview. Pointer handling is done on the svg with model coordinates, so the
// draw order never decides what can be clicked. Each product's layer is drawn in plan/layers/ (FloorLayer, WallLayer,
// TextileLayer, BeamLayer, ObjectLayer, RoomLayer, Labels, PreviewLayer), and the pointer handling lives in plan/pointer/
// (usePlanPointer, one file per drag kind). This file puts them together with the cursor.
import { useId, useMemo, type ReactNode } from 'react'
import type { CalcResult } from '../../calc/calc'
import { canMoveWall } from '../../domain/edit'
import type { FloorBrushSize } from '../../domain/floor/brush'
import type { RollDir } from '../../domain/floor/lanes'
import { CELL, openSides, sideLength, sidePoint } from '../../domain/grid'
import type { Run } from '../../domain/innerBeams'
import { conflicts } from '../../domain/objects'
import { roomAt, sideIsHorizontal } from '../../domain/rooms'
import { freeTextileAt } from '../../domain/textile/free'
import type { Side, Variant } from '../../domain/types'
import { builtModules, standWallKeys } from '../../domain/walls'
import type { Motif } from '../../persistence/file'
import { SURFACE } from '../colors'
import { place, rules } from '../env'
import { penLayers, type Brush, type Highlight, type Layer, type RollMode, type Tool } from '../tools'
import { totalSides } from './dims'
import { nearestEdge } from './geometry'
import { BeamLayer } from './layers/BeamLayer'
import { DimLayer } from './layers/DimLayer'
import { ErasingProvider } from './layers/ErasingProvider'
import { FloorLayer } from './layers/FloorLayer'
import { Labels } from './layers/Labels'
import { Legend } from './layers/Legend'
import { ObjectLayer } from './layers/ObjectLayer'
import { PosLayer } from './layers/PosLayer'
import { NextDefs } from './layers/NextDefs'
import { PickLayer } from './layers/PickLayer'
import { PreviewLayer } from './layers/PreviewLayer'
import { SnapDots } from './layers/Previews'
import { RoomLayer } from './layers/RoomLayer'
import { ShelfLayer } from './layers/ShelfLayer'
import { TextileLayer } from './layers/TextileLayer'
import { WallLayer } from './layers/WallLayer'
import { nextTarget } from './next'
import { nextOf, type Preview } from './nextState'
import type { AreaLayer, PlanState } from './nextArea'
import { linePx, planScale, PlanScaleContext, sizePx, usePxPerMetre, type PlanScale } from './planScale'
import { DIMMED, GRID, GRID_FINE, GRID_PX, PLAN_MARGIN } from './planStyle'
import { eraseTargetAt, type Erasing } from './pointer/erase'
import { floorBrush } from './pointer/floorBrush'
import { planHits } from './pointer/hits'
import { pens } from './pointer/pens'
import { usePlanPointer } from './pointer/usePlanPointer'
import { pillAnchor, type PillPlace } from './pillAnchor'
import { SelectionPill } from './SelectionPill'
import { selectionKey, type PlanSelection } from './selection'

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
  /** The drawer under the plan is open (it follows the selection). */
  drawerOpen?: boolean
  /** Double click in Velg: select and open the drawer. */
  onOpenDrawer?: (s: PlanSelection) => void
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
  /** Work order: textile walls show their textile labels (T1, F1A, F1B …) instead of the quote number. */
  textileLabels?: boolean
  /** Why what the pointer aims at cannot be stored (or that it is already there), for the hint line; null when it can. */
  onHint?: (text: string | null) => void
  /** What an edit would store (App's onEdit without storing it) and its calc: the plan shows it dimmed before the click.
   *  Left out on the read-only plans. */
  preview?: Preview
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
  const { wallTool, floorTool, textileTool, beamTool } = pen
  // The scale is worked out further down, from the svg the pointer hook gives; the hit tests read it when called
  let scaleNow: PlanScale | undefined
  const hits = planHits(v, mods, selection, () => scaleNow)
  const { moduleAt, beamAt, roomEdgeAt, objectAt } = hits
  const fb = floorBrush(v, { tool, brush, floorSize: p.floorSize, rollDir: p.rollDir, rollMode: p.rollMode })
  /** Snap points show only while a brush snaps to them, at its own grid. */
  const dotStep = textileTool ? step : wallTool || beamTool ? rules.wall.cc : null

  const pointer = usePlanPointer({
    v,
    tool,
    brush,
    selection,
    pens: pen,
    hits,
    mods,
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
    drawerOpen: p.drawerOpen,
    onOpenDrawer: p.onOpenDrawer,
  })
  const { svg, svgRef, svgEl, hover, dragging, stroke, erasing, handlers } = pointer

  // What the pen would store at the pointer (docs/forhandsvisning.md): worked out again only when the target changes,
  // then drawn through the layers below, dimmed, where the plan changes (nextArea.ts)
  const base: PlanState = { v, res, mods, bad }
  const target = p.mini || !p.preview ? null : nextTarget({ v, tool, brush, pens: pen, hits, mods, floor: fb, standardRuns, motifs: p.motifs, ...pointer })
  const next = target && p.preview ? nextOf(target, base, p.preview) : null
  const ghost = next?.scene ?? null
  const ids = `next${useId().replace(/:/g, '')}`
  /**
   * One plan layer as it is, and over it, where the next variant differs, the same layer drawn from the next variant at
   * preview strength; the old things there are hidden, so nothing is drawn twice.
   */
  const twin = (layer: AreaLayer, draw: (s: PlanState) => ReactNode) => {
    const a = ghost?.areas[layer]
    const on = !!a && a.clip.length > 0
    return (
      <>
        <g mask={on && a.mask.length ? `url(#${ids}-m-${layer})` : undefined}>{draw(base)}</g>
        {on && (
          <g clipPath={`url(#${ids}-c-${layer})`} opacity={next!.outcome.strength}>
            {draw(ghost!)}
          </g>
        )}
      </>
    )
  }

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
    if (d?.kind === 'wall' || d?.kind === 'beam' || d?.kind === 'freeMove' || (d?.kind === 'shelfMove' && d.moved)) return d.kind === 'shelfMove' && d.copy ? 'copy' : 'grabbing'
    if (freeTextileAt(v, hover, 0.15)) return 'move'
    if (objectAt(hover)) return 'default'
    if (beamAt(hover)) return 'move'
    const m = moduleAt(hover)
    const w = m && v.walls.find((x) => x.id === m.wallId)
    if (w) return canMoveWall(w) ? 'move' : 'default'
    return roomAt(v, hover.x, hover.y) ? 'move' : 'default'
  }

  // Tøm: what a click takes, from the hover (PC) or the press (touch, no hover), dimmed and hatched in its own layer.
  // A stroke along walls shows its own line.
  const hoverTarget = tool === 'erase' && !p.mini && hover && !dragging && !stroke ? eraseTargetAt(v, hits, standKeys, hover) : null
  const erasingShown: Erasing | null = erasing ?? (hoverTarget && hoverTarget.group !== 'locked' ? { group: hoverTarget.group, id: hoverTarget.id } : null)

  // Line widths in screen pixels (planScale.ts): measure how many pixels a metre takes
  const vb = p.mini ? { x: -0.4, y: -0.4, w: W + 0.8, h: D + 0.8 } : { x: -M, y: -M, w: W + 2 * M, h: D + 2 * M }
  const pxPerM = usePxPerMetre(svg, vb.w, vb.h)
  const scale = useMemo(() => planScale(pxPerM, { doc: p.doc, mini: p.mini }), [pxPerM, p.doc, p.mini])
  scaleNow = scale

  const totals = useMemo(() => new Set(totalSides(v)), [v])

  // The selection pill (docs/pille-og-skuff.md): as soon as a click selects
  const pillShown = !p.mini && !!p.onOpenDrawer && tool === 'select' && !dragging && !p.drawerOpen && !!selectionKey(selection)
  const pillPlace = pillShown ? placeOf(svgEl, pillAnchor(v, selection)) : null

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
    <>
    <svg
      ref={svgRef}
      className="plan-svg"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ cursor }}
      data-selection={p.mini ? undefined : selectionKey(selection)}
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

      {ghost && <NextDefs id={ids} areas={ghost.areas} />}

      <ErasingProvider erasing={erasingShown}>
      {/* Floor: carpet tiles with a joint at every tile edge, rolled floor without */}
      {twin('floor', (s) => <FloorLayer v={s.v} dim={dim} full={!!p.floorFull || floorTool || highlight === 'floor' || !!selection.lane || !!selection.fill} />)}

      {/* Drawing grids: every half metre while painting floor, snap dots for straight runs */}
      <g pointerEvents="none">
        {floorTool && (
          <g stroke={GRID_FINE.stroke} strokeWidth={linePx(scale, GRID_FINE.width)} strokeDasharray={`${sizePx(scale, GRID_FINE.dash)} ${sizePx(scale, GRID_FINE.gap)}`}>
            {Array.from({ length: Math.round(W / CELL) - 1 }, (_, i) => (
              <line key={`hx${i}`} x1={(i + 1) * CELL} y1={0} x2={(i + 1) * CELL} y2={D} />
            ))}
            {Array.from({ length: Math.round(D / CELL) - 1 }, (_, j) => (
              <line key={`hy${j}`} x1={0} y1={(j + 1) * CELL} x2={W} y2={(j + 1) * CELL} />
            ))}
          </g>
        )}
        {dotStep && <SnapDots W={W} D={D} step={dotStep} />}
      </g>

      {/* Walls and openings */}
      {twin('walls', (s) => <WallLayer v={s.v} mods={s.mods} selection={selection} dim={dim} />)}

      {/* Free-standing textile walls, textile walls on a wall face, foil decor */}
      {twin('textile', (s) => <TextileLayer v={s.v} res={s.res} selection={selection} dim={dim} />)}

      {/* Shelves in front of their wall face */}
      {twin('shelves', (s) => <ShelfLayer v={s.v} selection={selection} dim={dim} />)}

      {/* Beams and posts */}
      {twin('beams', (s) => <BeamLayer v={s.v} res={s.res} selection={selection} dim={dim} />)}

      {/* Objects */}
      {twin('objects', (s) => <ObjectLayer v={s.v} selection={selection} tool={tool} bad={s.bad} dim={dim} off={off} />)}

      {/* Rooms: name and size over the floor and furniture, the selected one outlined */}
      {!p.mini && twin('rooms', (s) => <RoomLayer v={s.v} selection={selection} />)}

      </ErasingProvider>

      {/* Labels */}
      {!p.mini && <Labels W={W} D={D} sideText={sideText} totals={totals} />}

      {/* Dimension chains in millimetres: totals, placement rows, module chain of the selected wall */}
      {!p.mini && <DimLayer v={v} selection={selection} />}
      {p.positions && <PosLayer v={v} res={res} dim={dim} textileLabels={p.textileLabels} />}

      {/* Legend and drawing head in the front aisle: always on the documents; while drawing only with Velg, when no
          quick picks float over the bottom of the plan */}
      {!p.mini && (p.doc || tool === 'select') && <Legend v={v} res={res} doc={!!p.doc} />}

      {/* Velg: what a click would select, faintly */}
      {!p.mini && tool === 'select' && <PickLayer v={v} mods={mods} picked={pointer.picked} selection={selection} />}

      {/* Interaction preview: measure pill, invalid hatch and hint of the pen in hand, Tøm, room handles, the chosen lanes */}
      <PreviewLayer v={v} tool={tool} brush={brush} selection={selection} floorSize={p.floorSize} rollDir={fb.dir} pointer={pointer} next={next?.outcome ?? null} mini={p.mini} onHint={p.onHint} />
      </PlanScaleContext.Provider>
    </svg>
    {pillPlace && (
      <SelectionPill
        place={pillPlace}
        v={v}
        res={res}
        selection={selection}
        motifs={p.motifs ?? []}
        onEdit={p.onEdit}
        onSelect={p.onSelect}
        onOpenDrawer={p.onOpenDrawer!}
        onToast={p.onToast}
      />
    )}
    </>
  )
}

/** What floats over the plan, which the pill keeps clear of: the stand chip and hint line, the mini map, the dock. */
const PILL_AVOID = '.stand-top > *, .minimap, .dock .dock-pill, .price-pill'

/** The anchor's box on screen, px from the corner of the plan's box (where the pill is placed). */
function placeOf(el: SVGSVGElement | null, anchor: ReturnType<typeof pillAnchor>): PillPlace | null {
  const m = el?.getScreenCTM()
  const box = el?.parentElement?.getBoundingClientRect()
  if (!el || !m || !box || !anchor) return null
  const at = (x: number, y: number) => {
    const pt = el.createSVGPoint()
    pt.x = x
    pt.y = y
    const s = pt.matrixTransform(m)
    return { x: s.x - box.left, y: s.y - box.top }
  }
  const a = at(anchor.x0, anchor.y0)
  const b = at(anchor.x1, anchor.y1)
  const avoid = [...el.parentElement!.querySelectorAll(PILL_AVOID)].map((x) => {
    const r = x.getBoundingClientRect()
    return { left: r.left - box.left, top: r.top - box.top, right: r.right - box.left, bottom: r.bottom - box.top }
  })
  return {
    anchor,
    box: { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), right: Math.max(a.x, b.x), bottom: Math.max(a.y, b.y) },
    size: { w: box.width, h: box.height },
    avoid,
  }
}
