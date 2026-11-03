// 2D plan. Explicit layers, bottom to top: ground, floor, grid, walls, openings, textiles, beams and posts,
// objects, labels, interaction preview. Pointer handling is done on the svg with model coordinates, so the
// draw order never decides what can be clicked. Each product's layer is drawn in plan/layers/ (FloorLayer, WallLayer,
// TextileLayer, BeamLayer, ObjectLayer, RoomLayer, Labels, Previews); this file holds the pointer handling and the
// previews' state.
import { useEffect, useMemo, useRef, useState, type DragEvent as RDragEvent, type PointerEvent as RPointerEvent } from 'react'
import type { CalcResult } from '../../calc/calc'
import { canMoveWall, eraseWalls, paintWalls } from '../../domain/edit'
import { CELL, openSides, segmentKeys, sideLength, sidePoint, wallDirection, wallLength } from '../../domain/grid'
import { addObject, conflicts, footprintBox, moveObject, removeObject } from '../../domain/objects'
import { addFoil, foilAt, removeFoil } from '../../domain/decor'
import { drawTextile, fillFace } from '../../domain/textile/brush'
import { faceOfPoint, freeStroke, freeTextileAt, moveFreeTextile, removeFreeTextile, runLength, updateFace } from '../../domain/textile/free'
import type { Motif } from '../../persistence/file'
import type { Point, Room, Side, Variant } from '../../domain/types'
import { drawOpening, setOpening } from '../../domain/doors'
import { type BuiltModule, builtModules, doorAllowed, standWallKeys } from '../../domain/walls'
import { BORDER, INK, INK_FAINT, SURFACE } from '../colors'
import { applyDrop, decorDrag, endDecorDrag, type DecorDrag } from '../dnd'
import { drawInnerBeam, eraseInnerBeams, innerBeamAt, type Run } from '../../domain/innerBeams'
import { dragInnerBeam, dragRoom, dragWall, dropObject, dropRoom, roomDrag, type RoomDrag, type WallDrag } from '../drag'
import { OUTSIDE, roomAt, roomSideAt, sideIsHorizontal } from '../../domain/rooms'
import { fmt } from '../format'
import { idx, place, productOf, rules } from '../env'
import { findMotif } from '../motifs'
import { penLayers, type Brush, type Highlight, type Layer, type Tool } from '../tools'
import type { RollDir } from '../../domain/floor/lanes'
import { applyFloor, floorAction, type FloorAction, type FloorBrushSize, lanesLaid } from '../../domain/floor/brush'
import { type Rect, standCells } from '../../domain/floor/tiles'
import { fillCarpet, fillProposalsFor, fillTilesOf } from '../../domain/floor/rollFill'
import { laneAt } from '../../domain/floor/edit'
import type { RollMode } from '../tools'
import { distToSegment, nearestEdge, strokeFrom } from './geometry'
import { faceAt } from '../../domain/faces'
import { removeTextile, textileAt, updateTextile } from '../../domain/textile/inFrame'
import type { PlanSelection } from './selection'
import { DIMMED, GRID_FINE, PLAN_MARGIN, PLAN_TEXTILE, PLAN_WALL, TEXTILE, WALL } from './planStyle'
import { Seg } from './layers/Seg'
import { FloorLayer, Offcut, RollPreview } from './layers/FloorLayer'
import { WallLayer } from './layers/WallLayer'
import { TextileLayer } from './layers/TextileLayer'
import { BeamLayer } from './layers/BeamLayer'
import { ObjectLayer } from './layers/ObjectLayer'
import { RoomHandles, RoomLayer } from './layers/RoomLayer'
import { Labels } from './layers/Labels'
import { FacePreview, HoverModule, SnapDots, StrokePreview, TextilePreview, type FaceHit, type TextileLine } from './layers/Previews'

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

/** Stand walls separate exhibitors and follow the stand type: erasing them is refused. */
const STAND_WALL_LOCKED = 'Standvegger følger standtypen og kan ikke fjernes'

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

/**
 * A press in Velg selects on release (`select`), so the wall drawer does not open, and shrink the plan, mid-drag.
 * A wall dragged away is not selected; furniture and rooms are.
 */
type Drag =
  | { kind: 'stroke'; p0: P; moved: boolean }
  /** A floor stroke: the tiles after the first line up with it (`anchor`). */
  | { kind: 'floor'; last: string | null; anchor: { i: number; j: number } | null }
  /** A stroke of rolled floor from `from`: whole lanes, laid on release (`rollPending` until then). */
  | { kind: 'roll'; from: P; moved: boolean }
  /** Fyll with rolled floor: an area from cell `from`; a click without a drag fills the stand. */
  | { kind: 'carpetFill'; from: { i: number; j: number }; moved: boolean }
  | { kind: 'click'; select: PlanSelection }
  | { kind: 'object'; id: string; dx: number; dy: number; start: P; moved: boolean; select: PlanSelection }
  | ({ kind: 'wall'; moved: boolean; select: PlanSelection } & WallDrag)
  | ({ kind: 'beam'; moved: boolean } & WallDrag)
  | ({ kind: 'room'; select: PlanSelection | null } & RoomDrag)
  | { kind: 'textile'; p0: P }
  | { kind: 'freeMove'; id: string; p0: P; v0: Variant; moved: boolean; select: PlanSelection }

interface P {
  x: number
  y: number
}

export function PlanView(p: Props) {
  const { v, res, tool, brush, floorSize, highlight, selection } = p
  const step = p.gridStep ?? rules.textile.grid
  const textileLine = (p0: P, q: P): TextileLine => {
    const [a, b] = freeStroke(v, rules, p0, q, step)
    return { a, b, at: p0 }
  }
  const { width: W, depth: D } = v.stand
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [hover, setHover] = useState<P | null>(null)
  // The drag under way as of the last pointer move, for rendering (hover previews pause, the cursor grabs): the ref
  // itself is only read in the handlers
  const [dragging, setDragging] = useState<Drag | null>(null)
  /** What the roll stroke in progress will lay on release: the preview shows it, the floor is untouched until then. */
  const [rollPending, setRollPending] = useState<FloorAction | null>(null)
  /** Fyll area being dragged, in cells. */
  const [fillRect, setFillRect] = useState<Rect | null>(null)
  const [stroke, setStroke] = useState<[Point, Point] | null>(null)
  /** Textile stroke being drawn, with where it started (picks the wall face when it lies on a wall). */
  const [textileStroke, setTextileStroke] = useState<TextileLine | null>(null)
  /** A frame or motif dragged from Profilering, over a wall face. */
  const [dropHover, setDropHover] = useState<{ h: FaceHit; d: DecorDrag } | null>(null)

  const mods = useMemo(() => builtModules(v), [v])
  const bad = useMemo(() => conflicts(v, place), [v])
  /** Edges carrying a stand wall: locked, and the only ones the side labels count (an inner wall leaves a side open). */
  const standKeys = useMemo(() => standWallKeys(v), [v])

  // A new tool or pen drops whatever stroke was under way
  const [penNow, setPenNow] = useState({ tool, brush })
  if (penNow.tool !== tool || penNow.brush !== brush) {
    setPenNow({ tool, brush })
    setStroke(null)
    setTextileStroke(null)
    setFillRect(null)
  }
  useEffect(() => {
    drag.current = null
  }, [tool, brush])

  const toModel = (e: { clientX: number; clientY: number }): P => {
    const el = svg.current!
    const pt = el.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = pt.matrixTransform(el.getScreenCTM()!.inverse())
    return { x: m.x, y: m.y }
  }

  const wallTool = tool !== 'select' && (brush?.kind === 'wall' || (tool === 'erase' && !brush))
  const floorTool = tool !== 'select' && brush?.kind === 'floor'
  const openingTool = tool !== 'select' && brush?.kind === 'opening'
  const objectTool = tool !== 'select' && brush?.kind === 'object'
  const decorTool = tool !== 'select' && brush?.kind === 'motif'
  /** One textile brush: on a system wall it is mounted there, anywhere else it stands free (domain/textileBrush). */
  const textileTool = tool !== 'select' && brush?.kind === 'textile'
  /** Innvendig takdrager, drawn on the wall grid like a wall. */
  const beamTool = tool !== 'select' && brush?.kind === 'beam'
  /** Standard beams: a drawn one may not lie along them. A støttedrager may be drawn over: the drawn beam replaces it. */
  const standardRuns: Run[] = useMemo(() => res.beams.segments.filter((s) => !s.inner && !s.support), [res])
  /** Snap points show only while a brush snaps to them, at its own grid. */
  const dotStep = textileTool ? step : wallTool || beamTool ? rules.wall.cc : null

  /** On the stand, or just outside its edge (where its edge walls are drawn). */
  const onStand = (q: P) => q.x > -0.4 && q.y > -0.4 && q.x < W + 0.4 && q.y < D + 0.4
  const moduleAt = (q: P, within = 0.3): BuiltModule | null => {
    let best: BuiltModule | null = null
    let bd = within
    for (const m of mods) {
      const d = distToSegment(q, m.a, m.b)
      if (d < bd) {
        bd = d
        best = m
      }
    }
    return best
  }
  /** A drawn takdrager under the pointer, unless a wall is closer (a beam can end on a wall). */
  const beamAt = (q: P) => (moduleAt(q, 0.12) ? undefined : innerBeamAt(v, q))

  /** The wall face under the pointer. */
  const faceHit = (q: P, within = 0.4): FaceHit | null => {
    const m = moduleAt(q, within)
    if (!m) return null
    const w = v.walls.find((x) => x.id === m.wallId)!
    const [dx, dy] = wallDirection(w)
    const L = wallLength(w)
    const t = Math.max(0, Math.min(L, (q.x - w.from[0]) * dx + (q.y - w.from[1]) * dy))
    return { w, s: faceAt(v, w, q), t, module: Math.min(Math.floor(t), L - 1) }
  }
  const ratioOf = (id: string) => findMotif(p.motifs, id)?.ratio ?? 1

  /** The side of a room under the pointer: its own walls always, any side of the selected room. */
  const roomEdgeAt = (q: P): { room: Room; side: number } | null => {
    const m = moduleAt(q, 0.2)
    const w = m && v.walls.find((x) => x.id === m.wallId)
    if (w?.room) {
      const room = v.rooms.find((r) => r.id === w.room!.id)
      if (room) return { room, side: w.room.side }
    }
    const sel = v.rooms.find((r) => r.id === selection.roomId)
    return (sel && roomSideAt({ ...v, rooms: [sel] }, q.x, q.y, 0.2)) ?? null
  }
  const startRoomDrag = (room: Room, mode: RoomDrag['mode'], q: P, select: PlanSelection | null) => {
    drag.current = { kind: 'room', ...roomDrag(room.id, mode, q, v), select }
  }

  /** Motif brush: print on a textile, or foil on a wall panel. */
  const decorClick = (q: P) => {
    // A motif on a free-standing textile wall prints the face it was clicked on
    const ft = brush?.kind === 'motif' ? freeTextileAt(v, q, 0.15) : undefined
    if (ft) {
      const face = faceOfPoint(ft, q)
      if (tool === 'erase') return ft[face]?.motif ? p.onEdit((x) => updateFace(x, ft.id, face, { motif: null })) : p.onToast('Ingen grafikk her')
      return p.onEdit((x) => updateFace(x, ft.id, face, { motif: brush!.kind === 'motif' ? brush!.motif : null }))
    }
    const h = faceHit(q)
    if (!h) return p.onToast('Klikk ved en vegg eller en tekstilvegg')
    const tx = textileAt(v, h.w.id, h.s, h.t)
    if (tool === 'erase') {
      const f = foilAt(v, rules, h.w.id, h.s, h.t)
      if (f) return p.onEdit((x) => removeFoil(x, f.id))
      if (tx?.motif) return p.onEdit((x) => updateTextile(x, rules, tx.id, { motif: null }))
      return p.onToast('Ingen grafikk her')
    }
    if (brush?.kind !== 'motif') return
    if (tx) return p.onEdit((x) => updateTextile(x, rules, tx.id, { motif: brush.motif }))
    const r = addFoil(v, rules, h.w.id, h.module, h.s, brush.motif, ratioOf(brush.motif))
    if ('error' in r) return p.onToast(r.error)
    p.onEdit(() => r.v)
  }

  const objectAt = (q: P) =>
    [...v.objects].reverse().find((o) => {
      const f = productOf(o.product)?.footprint
      if (!f) return false
      const b = footprintBox(o, f)
      return q.x >= b.x0 && q.x <= b.x1 && q.y >= b.y0 && q.y <= b.y1
    })

  // Rolled floor (engangsteppe) is laid in lanes one roll wide
  const rollWidth = brush?.kind === 'floor' ? idx.byArtnr.get(brush.product)?.product.roll : undefined
  const dir = p.rollDir ?? 'x'
  const brushSize = rollWidth ? { roll: dir, width: Math.round(rollWidth / CELL) } : floorSize
  const floorTouch = (q: P, anchor: { i: number; j: number } | null, from: P | null = null): FloorAction =>
    brush?.kind === 'floor'
      ? floorAction(v, { x: q.x / CELL, y: q.y / CELL, size: brushSize, erase: tool === 'erase', product: brush.product, anchor, from })
      : { kind: 'none' }
  const laneAction = (d: { from: P }, q: P | null) => floorTouch(q ?? d.from, null, q && { x: d.from.x / CELL, y: d.from.y / CELL })
  /** Fyll with engangsteppe: drag an area, the engine lays it the cheapest way. */
  const carpetFill = !!rollWidth && tool === 'brush' && p.rollMode !== 'lane'
  const cellOf = (q: P) => {
    const { nx, ny } = standCells(v.stand)
    return { i: Math.max(0, Math.min(nx - 1, Math.floor(q.x / CELL))), j: Math.max(0, Math.min(ny - 1, Math.floor(q.y / CELL))) }
  }
  const rectOf = (a: { i: number; j: number }, b: { i: number; j: number }): Rect => ({
    i: Math.min(a.i, b.i),
    j: Math.min(a.j, b.j),
    w: Math.abs(a.i - b.i) + 1,
    h: Math.abs(a.j - b.j) + 1,
  })

  const paintFloorAt = (q: P) => {
    const d = drag.current
    if (d?.kind !== 'floor' || brush?.kind !== 'floor') return
    const a = floorTouch(q, d.anchor)
    if (a.kind === 'none') return
    const k = `${a.kind}|${a.rect.i},${a.rect.j},${a.rect.w},${a.rect.h}`
    if (d.last === k) return
    d.last = k
    if (!d.anchor && a.kind === 'place') d.anchor = { i: a.rect.i, j: a.rect.j }
    p.onEdit((x) => applyFloor(x, a, brush.product), false)
  }

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const q = toModel(e)
    svg.current!.setPointerCapture(e.pointerId)
    if (carpetFill) {
      if (!onStand(q)) return
      drag.current = { kind: 'carpetFill', from: cellOf(q), moved: false }
      return
    }
    if (floorTool && rollWidth && tool === 'brush') {
      const d = { kind: 'roll' as const, from: q, moved: false }
      drag.current = d
      setRollPending(laneAction(d, null))
      return
    }
    if (floorTool) {
      p.onCheckpoint()
      drag.current = { kind: 'floor', last: null, anchor: null }
      paintFloorAt(q)
      return
    }
    if (wallTool || beamTool) {
      drag.current = { kind: 'stroke', p0: q, moved: false }
      const e0 = nearestEdge(v.stand, q)
      setStroke([e0.a, e0.b])
      return
    }
    if (openingTool) {
      const m = moduleAt(q, 0.4)
      const e = m ?? (tool !== 'erase' && onStand(q) ? nearestEdge(v.stand, q) : null)
      if (!e) return
      if (tool !== 'erase' && !doorAllowed(v, e.a, e.b)) p.onToast('Dører og forheng kan ikke stå i standveggen')
      else if (m) p.onEdit((x) => setOpening(x, m.key, tool === 'erase' ? null : brush!.product))
      // No wall there: the door or curtain draws its own wall module
      else p.onEdit((x) => drawOpening(x, e.a, e.b, brush!.product))
      return
    }
    if (decorTool) {
      decorClick(q)
      return
    }
    if (textileTool) {
      if (tool === 'erase') {
        const t = freeTextileAt(v, q)
        if (t) return p.onEdit((x) => removeFreeTextile(x, t.id))
        const h = faceHit(q)
        const tx = h && textileAt(v, h.w.id, h.s, h.t)
        if (tx) return p.onEdit((x) => removeTextile(x, tx.id))
        return p.onToast('Ingen tekstilvegg her')
      }
      drag.current = { kind: 'textile', p0: q }
      setTextileStroke(textileLine(q, q))
      return
    }
    if (objectTool) {
      if (tool === 'erase') {
        const o = objectAt(q)
        if (o) p.onEdit((x) => removeObject(x, o.id))
        return
      }
      const product = brush!.product
      const next = addObject(v, place, product, q.x, q.y)
      if (!next) p.onToast(`Ikke plass til ${productOf(product)?.name.toLowerCase() ?? 'varen'} her`)
      else p.onEdit(() => next)
      return
    }
    // Select. A plain click on a door or curtain chooses it (the wall drawer with the door); a drag does what it does on the wall.
    const door = moduleAt(q)?.opening
    const doorSelect: PlanSelection | null = door ? { openingId: door.id } : null
    // A side of the selected room comes first, so a side shared with a stand wall can still be dragged.
    const selEdge = selection.roomId ? roomEdgeAt(q) : null
    if (selEdge && selEdge.room.id === selection.roomId) {
      startRoomDrag(selEdge.room, selEdge.side, q, doorSelect)
      return
    }
    const ft = freeTextileAt(v, q, 0.15)
    if (ft) {
      drag.current = { kind: 'freeMove', id: ft.id, p0: q, v0: v, moved: false, select: { freeTextileId: ft.id, freeFace: faceOfPoint(ft, q) } }
      return
    }
    const o = objectAt(q)
    if (o) {
      drag.current = { kind: 'object', id: o.id, dx: q.x - o.x, dy: q.y - o.y, start: { x: o.x, y: o.y }, moved: false, select: { objectId: o.id } }
      return
    }
    const ib = beamAt(q)
    if (ib) {
      drag.current = { kind: 'beam', id: ib.id, p0: q, v0: v, delta: '0,0', horizontal: ib.from[1] === ib.to[1], moved: false }
      return
    }
    const m = moduleAt(q)
    if (m) {
      const w = v.walls.find((x) => x.id === m.wallId)!
      const h = faceHit(q)
      const tx = h && textileAt(v, w.id, h.s, h.t)
      // A room's wall opens on its outside, so print does not land inside the room unnoticed (Bjørn 2.11.2026)
      const select: PlanSelection = doorSelect ?? (tx ? { wallId: w.id, side: h.s, textileId: tx.id } : { wallId: w.id, side: w.room ? OUTSIDE : h?.s })
      // A room's own wall resizes the room; an inner wall moves
      const room = w.room && v.rooms.find((r) => r.id === w.room!.id)
      if (room) startRoomDrag(room, w.room!.side, q, select)
      else if (canMoveWall(w)) drag.current = { kind: 'wall', id: w.id, p0: q, v0: v, delta: '0,0', horizontal: w.from[1] === w.to[1], moved: false, select }
      else drag.current = { kind: 'click', select }
      return
    }
    const room = roomAt(v, q.x, q.y)
    if (room) {
      startRoomDrag(room, 'move', q, { roomId: room.id })
      return
    }
    // Engangsteppe: a fill is chosen as a whole, a lane placed on its own by itself
    const lt = q.x >= 0 && q.y >= 0 && q.x < W && q.y < D ? laneAt(v, Math.floor(q.x / CELL), Math.floor(q.y / CELL)) : undefined
    if (lt) {
      drag.current = { kind: 'click', select: lt.fill ? { fill: lt.fill } : { lane: { i: lt.i, j: lt.j } } }
      return
    }
    drag.current = { kind: 'click', select: {} }
  }

  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const q = toModel(e)
    setHover(q)
    const d = drag.current
    setDragging(d)
    if (!d) return
    if (d.kind === 'floor') paintFloorAt(q)
    else if (d.kind === 'carpetFill') {
      const c = cellOf(q)
      if (!d.moved && c.i === d.from.i && c.j === d.from.j) return
      d.moved = true
      setFillRect(rectOf(d.from, c))
    } else if (d.kind === 'roll') {
      if (!d.moved && Math.hypot(q.x - d.from.x, q.y - d.from.y) < 0.25) return
      d.moved = true
      setRollPending(laneAction(d, q))
    }
    else if (d.kind === 'textile') setTextileStroke(textileLine(d.p0, q))
    else if (d.kind === 'freeMove') {
      if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 0.15) return
      if (!d.moved) p.onCheckpoint()
      d.moved = true
      const next = moveFreeTextile(d.v0, rules, d.id, q.x - d.p0.x, q.y - d.p0.y)
      if (next) p.onEdit(() => next, false)
    } else if (d.kind === 'stroke') {
      if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > 0.35) d.moved = true
      if (d.moved) setStroke(strokeFrom(v.stand, d.p0, q, rules.wall.cc))
    } else if (d.kind === 'object') {
      if (!d.moved) {
        if (Math.hypot(q.x - d.dx - d.start.x, q.y - d.dy - d.start.y) < 0.03) return
        d.moved = true
        p.onCheckpoint()
      }
      p.onEdit((x) => moveObject(x, place, d.id, q.x - d.dx, q.y - d.dy), false)
    } else if (d.kind === 'wall') {
      if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 0.1) return
      d.moved = true
      dragWall(d, q, p.onEdit, p.onCheckpoint)
    } else if (d.kind === 'beam') {
      if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 0.1) return
      d.moved = true
      dragInnerBeam(d, q, standardRuns, p.onEdit, p.onCheckpoint)
    } else if (d.kind === 'room') dragRoom(d, q, p.onEdit, p.onCheckpoint)
  }

  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current
    drag.current = null
    setDragging(null)
    if (!d) return
    if (d.kind === 'carpetFill') {
      const rect = d.moved ? rectOf(d.from, cellOf(toModel(e))) : undefined
      setFillRect(null)
      if (brush?.kind === 'floor' && rollWidth) {
        const product = brush.product
        p.onEdit((x) => fillCarpet(x, product, rollWidth, rules.carpet, rect))
      }
    } else if (d.kind === 'roll') {
      const a = rollPending
      setRollPending(null)
      if (a && a.kind !== 'none' && brush?.kind === 'floor') {
        const product = brush.product
        p.onEdit((x) => applyFloor(x, a, product, dir))
      }
    } else if (d.kind === 'stroke') {
      const [a, b] = d.moved ? strokeFrom(v.stand, d.p0, toModel(e), rules.wall.cc) : (() => {
        const m = nearestEdge(v.stand, d.p0)
        return [m.a, m.b] as [Point, Point]
      })()
      setStroke(null)
      if (beamTool && tool === 'erase') p.onEdit((x) => eraseInnerBeams(x, a, b))
      else if (beamTool) {
        const r = drawInnerBeam(v, a, b, standardRuns)
        if ('error' in r) return p.onToast(r.error)
        p.onEdit(() => r.v)
      } else if (tool === 'erase') {
        // The plain eraser takes drawn takdrager on the stroke too
        const keys = segmentKeys(a, b)
        if (keys.some((k) => standKeys.has(k))) p.onToast(STAND_WALL_LOCKED)
        p.onEdit((x) => eraseInnerBeams(eraseWalls(x, keys), a, b))
      } else if (brush?.kind === 'wall') p.onEdit((x) => paintWalls(x, a, b, brush.ral))
    } else if (d.kind === 'textile') {
      const [a, b] = freeStroke(v, rules, d.p0, toModel(e), step)
      setTextileStroke(null)
      // A click without a stroke fills the free part of the wall face it is next to
      const click = a[0] === b[0] && a[1] === b[1]
      const h = click ? faceHit(d.p0) : null
      if (click && !h) return p.onToast('Dra en strek for en frittstående tekstilvegg, eller klikk ved en systemvegg')
      const r = h ? fillFace(v, rules, h.w.id, h.s, h.t) : drawTextile(v, rules, a, b, d.p0)
      if ('error' in r) return p.onToast(r.error)
      p.onEdit(() => r.v)
      if ('mounted' in r) {
        const t = r.v.textiles.find((x) => x.id === r.mounted.id)!
        p.onToast(`Tekstilvegg ${fmt(t.width, 2)} m på systemveggen · Velg den for å justere`)
      } else {
        const t = r.v.freeTextiles.find((x) => x.id === r.free.id)!
        p.onToast(`Tekstilvegg ${fmt(runLength(t), 2)} m frittstående på fotplater · Velg den for trykk og tekstil`)
      }
    } else if (d.kind === 'freeMove') p.onSelect(d.select)
    else if (d.kind === 'click') p.onSelect(d.select)
    else if (d.kind === 'object') {
      if (d.moved) dropObject(v, d.id, d.start, p.onEdit, p.onToast)
      p.onSelect(d.select)
    } else if (d.kind === 'wall') {
      if (!d.moved) p.onSelect(d.select)
    } else if (d.kind === 'beam') {
      if (!d.moved) p.onSelect({ beamId: d.id })
    } else if (d.kind === 'room') {
      dropRoom(d, p.onEdit, p.onToast)
      // A room moved by its floor stays selected; a resized side opens the drawer only on a plain click
      if (d.select && (d.mode === 'move' || !d.moved)) p.onSelect(d.select)
    }
  }

  // Drag and drop from Profilering: the same as a click with the textile or motif brush
  const onDragOver = (e: RDragEvent<SVGSVGElement>) => {
    const d = decorDrag(e)
    if (!d || p.mini) return
    e.preventDefault()
    const q = toModel(e)
    const h = faceHit(q)
    e.dataTransfer.dropEffect = h || (d.kind === 'motif' && freeTextileAt(v, q, 0.2)) ? 'copy' : 'none'
    setDropHover(h ? { h, d } : null)
  }
  const onDrop = (e: RDragEvent<SVGSVGElement>) => {
    const d = decorDrag(e)
    setDropHover(null)
    endDecorDrag()
    if (!d || p.mini) return
    e.preventDefault()
    const q = toModel(e)
    const ft = d.kind === 'motif' ? freeTextileAt(v, q, 0.2) : undefined
    if (ft && d.kind === 'motif') {
      const face = faceOfPoint(ft, q)
      p.onEdit((x) => updateFace(x, ft.id, face, { motif: d.motif }))
      return p.onSelect({ freeTextileId: ft.id, freeFace: face })
    }
    const h = faceHit(q)
    if (!h) return p.onToast(d.kind === 'textile' ? 'Slipp tekstilveggen ved en vegg, på siden rammen skal stå' : 'Slipp grafikken ved en vegg eller en tekstilvegg')
    const r = applyDrop(v, d, { wallId: h.w.id, s: h.s, t: h.t }, ratioOf)
    if ('error' in r) return p.onToast(r.error)
    p.onEdit(() => r.v)
    p.onSelect(r.select)
    if (r.toast) p.onToast(r.toast)
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
  const hoverEdge = openingTool && hover ? (moduleAt(hover, 0.4) ?? (tool !== 'erase' && onStand(hover) ? nearestEdge(v.stand, hover) : null)) : null
  const hoverModule = hoverEdge && (tool === 'erase' || doorAllowed(v, hoverEdge.a, hoverEdge.b)) ? hoverEdge : null
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
  const hoverFree = textileTool && !textileFace && hover && !textileStroke && onStand(hover) ? (tool === 'erase' ? (freeTextileAt(v, hover) ?? null) : freeStroke(v, rules, hover, hover, step)[0]) : null

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
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        drag.current = null
        setDragging(null)
        setStroke(null)
        setRollPending(null)
        setFillRect(null)
      }}
      onPointerLeave={() => setHover(null)}
      onDragOver={onDragOver}
      onDragLeave={() => setDropHover(null)}
      onDrop={onDrop}
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
        {hoverWallEdge && <Seg a={hoverWallEdge.a} b={hoverWallEdge.b} stroke={tool === 'erase' ? INK_FAINT : beamTool ? INK : WALL} strokeOpacity={0.6} strokeWidth={PLAN_WALL} strokeDasharray={beamTool ? '.16 .08' : undefined} />}
        {stroke && <StrokePreview a={stroke[0]} b={stroke[1]} erase={tool === 'erase'} beam={beamTool} />}
        {textileStroke && <TextilePreview v={v} line={textileStroke} />}
        {hoverFree && 'id' in hoverFree && <Seg a={hoverFree.from} b={hoverFree.to} stroke={INK} strokeOpacity={0.45} strokeWidth={PLAN_TEXTILE + 0.06} />}
        {hoverFree && !('id' in hoverFree) && <circle cx={hoverFree[0]} cy={hoverFree[1]} r={0.06} fill={TEXTILE} />}
        {hoverModule && <HoverModule m={hoverModule} />}
        {hoverFace && <FacePreview v={v} h={hoverFace} brush={brush!} erase={tool === 'erase'} />}
        {dropHover && <FacePreview v={v} h={dropHover.h} brush={dropHover.d} erase={false} />}
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
            fill={hoverFloor.kind === 'erase' || brush?.kind !== 'floor' ? SURFACE : idx.byArtnr.get(brush.product)?.variant.color}
            fillOpacity={0.75}
            stroke={INK}
            strokeWidth={0.03}
          />
        )}
      </g>
    </svg>
  )
}
