// 2D plan. Explicit layers, bottom to top: ground, floor, grid, walls, openings, textiles, beams and posts,
// objects, labels, interaction preview. Pointer handling is done on the svg with model coordinates, so the
// draw order never decides what can be clicked.
import { RECIPES } from '../../foga/recipes'
import { useEffect, useMemo, useRef, useState, type DragEvent as RDragEvent, type PointerEvent as RPointerEvent, type SVGProps } from 'react'
import type { CalcResult } from '../../calc/calc'
import { mainGroupOf } from '../../catalog/groups'
import { canMoveWall, doorAllowed, doorSwing, drawOpening, eraseWalls, paintFloor, paintWalls, segmentKeys, setOpening, standWallKeys } from '../../domain/edit'
import { CELL, openSides, parseCellKey, pointAlong, sideLength, sidePoint, wallDirection, wallLength, type Module } from '../../domain/grid'
import { addObject, conflicts, footprintBox, moveObject, removeObject } from '../../domain/objects'
import { addFoil, faceAt, faceSegment, felt, foilAt, foilCenter, freeSpans, removeFoil, removeTextile, sideOf, textileAt, updateTextile, type FaceSide } from '../../domain/decor'
import { drawTextile, fillFace, planTextile } from '../../domain/textileBrush'
import { faceOfPoint, freeStroke, freeTextileAt, moveFreeTextile, removeFreeTextile, runLength, runNormal, updateFace, type FaceKey } from '../../domain/freeTextile'
import { alongRun, cornerPosts } from '../../calc/freeFrames'
import type { Motif } from '../../persistence/file'
import type { Point, Room, Side, Variant, Wall } from '../../domain/types'
import { builtModules, type BuiltModule } from '../../domain/walls'
import { BORDER, BORDER_STRONG, BLOCK, CANVAS, INK, INK_FAINT, INK_MUTED, LAYER_COLOR, SURFACE } from '../colors'
import { applyDrop, decorDrag, endDecorDrag, type DecorDrag } from '../dnd'
import { drawInnerBeam, eraseInnerBeams, innerBeamAt, type Run } from '../../domain/innerBeams'
import { dragInnerBeam, dragRoom, dragWall, dropObject, dropRoom, roomDrag, type RoomDrag, type WallDrag } from '../drag'
import { roomAt, roomName, roomSideAt, roomSize, sideIsHorizontal } from '../../domain/rooms'
import { insetOutline, isHorizontal, labelRect, outlineSides } from '../../domain/outline'
import { fmt } from '../format'
import { idx, place, plateColor, productOf, rules } from '../env'
import { doorInset } from '../../rules/rules'
import { findMotif } from '../motifs'
import type { Brush, FloorSize, Highlight, Tool } from '../tools'
import { distToSegment, nearestEdge, strokeFrom } from './geometry'

export interface PlanSelection {
  wallId?: string
  roomId?: string
  objectId?: string
  /** Wall face shown in the wall drawer. */
  side?: FaceSide
  textileId?: string
  foilId?: string
  /** A frittstående tekstilvegg, and the face shown in its drawer. */
  freeTextileId?: string
  freeFace?: FaceKey
  /** An innvendig takdrager. */
  beamId?: string
}

interface Props {
  v: Variant
  res: CalcResult
  tool: Tool
  brush: Brush | null
  floorSize: FloorSize
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

/**
 * Line widths in the plan, m. Schematic, not to scale (3D is): a wall and a textile are both drawn 60 mm (both are 40),
 * and a textile on a wall face sits just outside the wall line so the two never overlap.
 */
const PLAN_WALL = 0.06
const PLAN_TEXTILE = PLAN_WALL
const PLAN_TEXTILE_OFFSET = PLAN_WALL / 2 + PLAN_TEXTILE / 2 + 0.005

/** Margin around the stand for the aisle and the side labels, m. */
export const PLAN_MARGIN = 1.3
const M = PLAN_MARGIN
/** The aisle in the margin along each side, as x, y, width, height. It runs the whole margin, past the corners. */
const AISLE_BAND: Record<Side, (W: number, D: number) => [number, number, number, number]> = {
  front: (W, D) => [-M, D, W + 2 * M, M],
  back: (W) => [-M, -M, W + 2 * M, M],
  left: (_, D) => [-M, -M, M, D + 2 * M],
  right: (W, D) => [W, -M, M, D + 2 * M],
}
const SIDE_LABEL: Record<Side, string> = { back: 'Bak', front: 'Front', left: 'Venstre', right: 'Høyre' }
const WALL = LAYER_COLOR.walls
const TEXTILE = LAYER_COLOR.textile

/** Grid lines over a laid floor: dark enough to read on any floor colour. */
const GRID_ON_FLOOR = 'rgb(0 0 0 / .14)'
/** Half-metre lines while painting floor. */
const GRID_FINE = 'rgb(0 0 0 / .1)'
/** Opacity of layers outside the hovered calc group. */
const DIMMED = 0.25

/**
 * A press in Velg selects on release (`select`), so the wall drawer does not open, and shrink the plan, mid-drag.
 * A wall dragged away is not selected; furniture and rooms are.
 */
type Drag =
  | { kind: 'stroke'; p0: P; moved: boolean }
  | { kind: 'floor'; last: string | null }
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

/** A wall face under the pointer: wall, face, offset along the wall and module index. */
interface FaceHit {
  w: Wall
  s: FaceSide
  t: number
  module: number
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
  const [stroke, setStroke] = useState<[Point, Point] | null>(null)
  /** Textile stroke being drawn, with where it started (picks the wall face when it lies on a wall). */
  const [textileStroke, setTextileStroke] = useState<TextileLine | null>(null)
  /** A frame or motif dragged from Profilering, over a wall face. */
  const [dropHover, setDropHover] = useState<{ h: FaceHit; d: DecorDrag } | null>(null)

  const mods = useMemo(() => builtModules(v), [v])
  const bad = useMemo(() => conflicts(v, place), [v])
  /** Edges carrying a stand wall: locked, and the only ones the side labels count (an inner wall leaves a side open). */
  const standKeys = useMemo(() => standWallKeys(v), [v])

  useEffect(() => {
    setStroke(null)
    setTextileStroke(null)
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
  /** Standard beams: a drawn one may not lie along them. */
  const standardRuns: Run[] = useMemo(() => res.beams.segments.filter((s) => !s.inner), [res])
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

  const floorBlock = (q: P) => {
    if (q.x < 0 || q.y < 0 || q.x >= W || q.y >= D) return null
    const nx = Math.round(W / CELL)
    const ny = Math.round(D / CELL)
    const i = Math.max(0, Math.min(nx - floorSize.w, Math.floor(q.x / CELL / floorSize.w) * floorSize.w))
    const j = Math.max(0, Math.min(ny - floorSize.h, Math.floor(q.y / CELL / floorSize.h) * floorSize.h))
    return { i, j }
  }

  const paintFloorAt = (q: P) => {
    const d = drag.current
    const b = floorBlock(q)
    if (!b || d?.kind !== 'floor') return
    const k = `${b.i},${b.j}`
    if (d.last === k) return
    d.last = k
    const product = tool === 'erase' ? null : brush?.kind === 'floor' ? brush.product : null
    p.onEdit((x) => paintFloor(x, b.i, b.j, floorSize.w, floorSize.h, product), false)
  }

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const q = toModel(e)
    svg.current!.setPointerCapture(e.pointerId)
    if (floorTool) {
      p.onCheckpoint()
      drag.current = { kind: 'floor', last: null }
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
    // Select. A side of the selected room comes first, so a side shared with a stand wall can still be dragged.
    const selEdge = selection.roomId ? roomEdgeAt(q) : null
    if (selEdge && selEdge.room.id === selection.roomId) {
      startRoomDrag(selEdge.room, selEdge.side, q, null)
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
      const select: PlanSelection = tx ? { wallId: w.id, side: h.s, textileId: tx.id } : { wallId: w.id, side: h?.s }
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
    drag.current = { kind: 'click', select: {} }
  }

  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const q = toModel(e)
    setHover(q)
    const d = drag.current
    if (!d) return
    if (d.kind === 'floor') paintFloorAt(q)
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
    if (!d) return
    if (d.kind === 'stroke') {
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
      dropRoom(d, p.onEdit)
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
  const dim = (layer: Exclude<Highlight, null>) =>
    (highlight && highlight !== layer) || (layer !== 'objects' && off(LAYER_GROUP[layer])) ? DIMMED : 1
  const cursor = tool !== 'select' ? 'crosshair' : roomCursor()
  function roomCursor() {
    const d = drag.current
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
  const hoverFloor = floorTool && hover && !drag.current ? floorBlock(hover) : null
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

  const floorAreas = res.keyFigures.floor
  const floorIds = Object.keys(floorAreas)

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
        setStroke(null)
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

      {/* Floor */}
      <g opacity={dim('floor')} pointerEvents="none">
        {Object.entries(v.floor.cells).map(([k, a]) => {
          const c = parseCellKey(k)
          const col = idx.byArtnr.get(a)?.variant.color
          return c && col ? <rect key={k} x={c[0] * CELL} y={c[1] * CELL} width={CELL + 0.004} height={CELL + 0.004} fill={col} /> : null
        })}
      </g>

      {/* Grid */}
      <g pointerEvents="none">
        {floorTool &&
          Array.from({ length: Math.round(W / CELL) - 1 }, (_, i) =>
            (i + 1) % 2 ? <line key={`hx${i}`} x1={(i + 1) * CELL} y1={0} x2={(i + 1) * CELL} y2={D} stroke={GRID_FINE} strokeWidth={0.008} strokeDasharray=".04 .04" /> : null,
          )}
        {floorTool &&
          Array.from({ length: Math.round(D / CELL) - 1 }, (_, j) =>
            (j + 1) % 2 ? <line key={`hy${j}`} x1={0} y1={(j + 1) * CELL} x2={W} y2={(j + 1) * CELL} stroke={GRID_FINE} strokeWidth={0.008} strokeDasharray=".04 .04" /> : null,
          )}
        {Array.from({ length: W - 1 }, (_, i) => (
          <line key={`gx${i}`} x1={i + 1} y1={0} x2={i + 1} y2={D} stroke={floorIds.length ? GRID_ON_FLOOR : BORDER} strokeWidth={0.012} />
        ))}
        {Array.from({ length: D - 1 }, (_, j) => (
          <line key={`gy${j}`} x1={0} y1={j + 1} x2={W} y2={j + 1} stroke={floorIds.length ? GRID_ON_FLOOR : BORDER} strokeWidth={0.012} />
        ))}
        {dotStep && <SnapDots W={W} D={D} step={dotStep} />}
      </g>

      {/* Walls */}
      <g opacity={dim('walls')} pointerEvents="none">
        {mods.filter((m) => !m.opening).map((m) => {
          const sel = selection.wallId === m.wallId
          return (
            <g key={m.key}>
              {sel && <Seg a={m.a} b={m.b} stroke={INK} strokeWidth={PLAN_WALL + 0.08} />}
              <Seg a={m.a} b={m.b} stroke={WALL} strokeWidth={PLAN_WALL} />
              {m.plate !== v.defaultPlate && (
                <Seg a={m.a} b={m.b} stroke={plateColor(m.plate)} strokeWidth={0.05} />
              )}
            </g>
          )
        })}
      </g>

      {/* Openings */}
      <g opacity={dim('openings')} pointerEvents="none">
        {mods.filter((m) => m.opening).map((m) => <OpeningMark key={m.key} v={v} m={m} selected={selection.wallId === m.wallId} />)}
      </g>

      {/* Frittstående tekstilvegger: foot plates under the frame, corner posts, the frame */}
      <g opacity={dim('textile')} pointerEvents="none">
        {res.production.free.map((f) => {
          const t = v.freeTextiles.find((x) => x.id === f.textileId)
          if (!t) return null
          const sel = selection.freeTextileId === t.id
          return (
            <g key={t.id}>
              {f.supports.map((at, i) => {
                const [x, y] = alongRun(t, at)
                const h = t.from[1] === t.to[1]
                const w = (h ? f.foot.along : f.foot.across) / 1000
                const d = (h ? f.foot.across : f.foot.along) / 1000
                return <rect key={i} x={x - w / 2} y={y - d / 2} width={w} height={d} fill="none" stroke={TEXTILE} strokeOpacity={0.55} strokeWidth={0.015} strokeDasharray=".04 .03" />
              })}
              {sel && <Seg a={t.from} b={t.to} stroke={INK} strokeWidth={PLAN_TEXTILE + 0.06} />}
              <Seg a={t.from} b={t.to} stroke={TEXTILE} strokeWidth={PLAN_TEXTILE} />
              {sel && selection.freeFace && <FaceMark t={t} face={selection.freeFace} />}
              {!p.mini && (
                <text {...labelAt(t)} textAnchor="middle" style={{ ...MONO, fontSize: '0.17px' }}>
                  {f.pos} · {fmt(f.length / 1000, 2)} m
                </text>
              )}
            </g>
          )
        })}
        {cornerPosts(v).map(([x, y]) => (
          <rect key={`${x},${y}`} x={x - 0.06} y={y - 0.06} width={0.12} height={0.12} fill={INK_MUTED} />
        ))}
      </g>

      {/* Textile walls: drawn in front of their face */}
      <g opacity={dim('textile')} pointerEvents="none">
        {v.textiles.map((t) => {
          const w = v.walls.find((x) => x.id === t.wallId)
          if (!w) return null
          const [a, b] = faceSegment(w, sideOf(v, t), t.from + 0.02, t.from + t.width - 0.02, PLAN_TEXTILE_OFFSET)
          const sel = selection.textileId === t.id
          return (
            <g key={t.id}>
              {sel && <Seg a={a} b={b} stroke={INK} strokeWidth={PLAN_TEXTILE + 0.06} />}
              <Seg a={a} b={b} stroke={TEXTILE} strokeWidth={PLAN_TEXTILE} />
            </g>
          )
        })}
      </g>

      {/* Foil decor: a dashed mark on its face, as wide as the decal */}
      <g opacity={dim('foil')} pointerEvents="none">
        {v.foils.map((f) => {
          const w = v.walls.find((x) => x.id === f.wallId)
          if (!w) return null
          const c = foilCenter(rules, f)
          const [a, b] = faceSegment(w, sideOf(v, f), c - f.width / 2, c + f.width / 2, PLAN_WALL / 2 + 0.02)
          const sel = selection.foilId === f.id
          return <Seg key={f.id} a={a} b={b} stroke={INK} strokeWidth={sel ? 0.05 : 0.03} strokeDasharray=".06 .04" />
        })}
      </g>

      {/* Beams and posts */}
      <g pointerEvents="none">
        <g opacity={dim('beams')}>
          {(v.innerBeams ?? []).filter((b) => b.id === selection.beamId).map((b) => (
            <Seg key={b.id} a={b.from} b={b.to} stroke={INK} strokeWidth={0.12} strokeOpacity={0.35} />
          ))}
          {res.beams.segments.map((s, i) => (
            <Seg key={i} a={s.from} b={s.to} stroke={s.inner ? INK : INK_MUTED} strokeWidth={0.05} strokeDasharray=".16 .08" />
          ))}
        </g>
        <g opacity={(highlight && highlight !== 'walls' && highlight !== 'beams') || off('vegg') ? DIMMED : 1}>
          {/* Støtteplater under walls that stand free, across the wall */}
          {res.wallSupports.map(({ at: [x, y], orientation }) => {
            const { along, across } = RECIPES.wall.support.foot
            const w = (orientation === 'h' ? along : across) / 1000
            const d = (orientation === 'h' ? across : along) / 1000
            return <rect key={`f${x},${y}`} x={x - w / 2} y={y - d / 2} width={w} height={d} fill="none" stroke={INK_MUTED} strokeWidth={0.015} strokeDasharray=".04 .03" />
          })}
          {res.posts.map((q) => (
            <rect key={`${q[0]},${q[1]}`} x={q[0] - 0.04} y={q[1] - 0.04} width={0.08} height={0.08} fill={INK} />
          ))}
        </g>
      </g>

      {/* Objects */}
      <g opacity={dim('objects')}>
        {v.objects.map((o) => {
          const f = productOf(o.product)?.footprint
          const col = idx.byArtnr.get(o.product)?.variant.color ?? 'oklch(0.3 0.004 250)'
          if (!f) return null
          const b = footprintBox(o, f)
          const isBad = bad.has(o.id)
          const sel = selection.objectId === o.id
          const stroke = isBad ? BLOCK : INK
          const sw = isBad ? 0.06 : sel ? 0.05 : 0.018
          const op = off(mainGroupOf(productOf(o.product)?.group)) ? DIMMED : undefined
          return f.round ? (
            <circle key={o.id} cx={o.x} cy={o.y} r={f.w / 2} fill={col} stroke={stroke} strokeWidth={sw} opacity={op} style={{ cursor: tool === 'select' ? 'move' : undefined }} />
          ) : (
            <rect key={o.id} x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} rx={0.03} fill={col} stroke={stroke} strokeWidth={sw} opacity={op} />
          )
        })}
      </g>

      {/* Rooms: name and size over the floor and furniture, the selected one outlined */}
      {!p.mini && (
        <g pointerEvents="none">
          {v.rooms.map((r) => (
            <RoomMark key={r.id} r={r} selected={selection.roomId === r.id} />
          ))}
        </g>
      )}

      {/* Labels */}
      {!p.mini && (
      <g pointerEvents="none">
        <text x={W / 2} y={-M * 0.36} textAnchor="middle" style={SIDE}>
          {SIDE_LABEL.back} · {sideText('back')}
        </text>
        <text x={W / 2} y={-M * 0.14} textAnchor="middle" style={SIDE_DIM}>
          {W} m
        </text>
        <text transform={`translate(${-M * 0.3} ${D / 2}) rotate(-90)`} textAnchor="middle" style={SIDE}>
          {SIDE_LABEL.left} · {sideText('left')}
        </text>
        <text transform={`translate(${-M * 0.1} ${D / 2}) rotate(-90)`} textAnchor="middle" style={SIDE_DIM}>
          {D} m
        </text>
        <text transform={`translate(${W + M * 0.2} ${D / 2}) rotate(90)`} textAnchor="middle" style={SIDE}>
          {SIDE_LABEL.right} · {sideText('right')}
        </text>
        <text x={W / 2} y={D + M * 0.22} textAnchor="middle" style={SIDE}>
          {SIDE_LABEL.front} · {sideText('front')}
        </text>
        {floorIds.length > 1 &&
          floorIds.map((a, n) => {
            const y = D + 0.62 + n * 0.3
            return (
              <g key={a}>
                <rect x={-M + 0.25} y={y - 0.17} width={0.2} height={0.2} rx={0.03} fill={idx.byArtnr.get(a)?.variant.color} />
                <text x={-M + 0.52} y={y} style={{ ...MONO, fontSize: '0.19px' }}>
                  {`${productOf(a)?.name ?? a} ${idx.byArtnr.get(a)?.variant.name.toLowerCase() ?? ''} · ${fmt(floorAreas[a])} m²`}
                </text>
              </g>
            )
          })}
      </g>
      )}

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
        {hoverFloor && (
          <rect
            x={hoverFloor.i * CELL}
            y={hoverFloor.j * CELL}
            width={floorSize.w * CELL}
            height={floorSize.h * CELL}
            rx={0.02}
            fill={tool === 'erase' || brush?.kind !== 'floor' ? SURFACE : idx.byArtnr.get(brush.product)?.variant.color}
            fillOpacity={0.75}
            stroke={INK}
            strokeWidth={0.03}
          />
        )}
      </g>
    </svg>
  )
}

const noop = () => {}

/** Label beside a run, on its face B side. */
function labelAt(t: { from: Point; to: Point }) {
  const [nx, ny] = runNormal(t, 'b')
  const horizontal = t.from[1] === t.to[1]
  const off = horizontal ? 0.3 : 0.22
  return { x: (t.from[0] + t.to[0]) / 2 + nx * off, y: (t.from[1] + t.to[1]) / 2 + ny * off + (horizontal ? 0.06 : 0) }
}

/** The face shown in the drawer: a thin line on that side. */
function FaceMark({ t, face }: { t: { from: Point; to: Point }; face: FaceKey }) {
  const [nx, ny] = runNormal(t, face)
  const o = PLAN_TEXTILE / 2 + 0.04
  return <Seg a={[t.from[0] + nx * o, t.from[1] + ny * o]} b={[t.to[0] + nx * o, t.to[1] + ny * o]} stroke={INK} strokeWidth={0.03} />
}

interface TextileLine {
  a: Point
  b: Point
  at: { x: number; y: number }
}

/** The stroke being drawn: on a wall it shows the frame on the face it lands on, elsewhere a free-standing run. */
function TextilePreview({ v, line }: { v: Variant; line: TextileLine }) {
  const plan = planTextile(v, line.a, line.b, line.at)
  if (plan.kind === 'free') return <FreePreview a={line.a} b={line.b} />
  const [a, b] = faceSegment(plan.wall, plan.s, plan.t0, plan.t1, PLAN_TEXTILE_OFFSET)
  return (
    <g>
      <Seg a={a} b={b} stroke={TEXTILE} strokeOpacity={0.7} strokeWidth={PLAN_TEXTILE + 0.04} />
      <text x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2 - 0.15} textAnchor="middle" style={{ ...MONO, fontSize: '0.2px', fill: INK }}>
        {fmt(plan.t1 - plan.t0, 2)} m på vegg
      </text>
    </g>
  )
}

function FreePreview({ a, b }: { a: Point; b: Point }) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1])
  return (
    <g>
      <Seg a={a} b={b} stroke={TEXTILE} strokeOpacity={0.6} strokeWidth={PLAN_TEXTILE} />
      <circle cx={a[0]} cy={a[1]} r={0.06} fill={TEXTILE} />
      <circle cx={b[0]} cy={b[1]} r={0.06} fill={TEXTILE} />
      {L > 0 && (
        <text x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2 - 0.15} textAnchor="middle" style={{ ...MONO, fontSize: '0.2px', fill: INK }}>
          {fmt(L, 2)} m
        </text>
      )}
    </g>
  )
}

/** Read-only plan: the quote's sketch and the 3D view's mini map. */
export function PlanPreview({ v, res, mini, groups }: { v: Variant; res: CalcResult; mini?: boolean; groups?: ReadonlySet<string> }) {
  return (
    <PlanView
      mini={mini}
      groups={groups}
      v={v}
      res={res}
      tool="select"
      brush={null}
      floorSize={PREVIEW_FLOOR_SIZE}
      highlight={null}
      selection={NO_SELECTION}
      onSelect={noop}
      onEdit={noop}
      onCheckpoint={noop}
      onToast={noop}
    />
  )
}
const PREVIEW_FLOOR_SIZE: FloorSize = { w: 2, h: 2 }
const NO_SELECTION: PlanSelection = {}

const LABEL = { font: '500 0.26px var(--font-ui)', fill: INK_MUTED }
const MONO = { font: '500 0.24px var(--font-numeric)', fill: INK_FAINT }
/** Side names and stand dimensions around the stand: context, so quieter than the drawing itself. */
const SIDE = { font: '500 0.17px var(--font-ui)', fill: INK_FAINT }
const SIDE_DIM = { font: '500 0.15px var(--font-numeric)', fill: INK_FAINT }

function OpeningMark({ v, m, selected }: { v: Variant; m: BuiltModule; selected: boolean }) {
  const o = m.opening!
  const w = v.walls.find((x) => x.id === o.wallId)!
  const [dx, dy] = wallDirection(w)
  const s = doorSwing(v.stand, w, o)
  const n: Point = [-dy * s, dx * s]
  const a = pointAlong(w, o.module)
  const b = pointAlong(w, o.module + 1)
  const door = productOf(o.product)?.opening === 'door'
  const r = rules.door.swing
  // Hinge: the leaf is centred in the opening, not hung on the post centre
  const k = doorInset(rules)
  const h: Point = [a[0] + dx * k, a[1] + dy * k]
  return (
    <g>
      {selected && <Seg a={a} b={b} stroke={INK} strokeOpacity={0.3} strokeWidth={PLAN_WALL + 0.08} />}
      {/* Header panel over the opening */}
      <Seg a={a} b={b} stroke={WALL} strokeOpacity={0.45} strokeWidth={0.05} />
      {door ? (
        <g fill="none" stroke={INK} strokeWidth={0.025}>
          <line x1={h[0]} y1={h[1]} x2={h[0] + n[0] * r} y2={h[1] + n[1] * r} />
          <path
            d={`M${h[0] + dx * r} ${h[1] + dy * r} A${r} ${r} 0 0 ${s === 1 ? 1 : 0} ${h[0] + n[0] * r} ${h[1] + n[1] * r}`}
            strokeDasharray=".05 .05"
          />
        </g>
      ) : (
        <path d={curtainPath(a, b, n)} fill="none" stroke={INK} strokeWidth={0.025} />
      )}
    </g>
  )
}

/** A soft zigzag just inside the opening. */
function curtainPath(a: Point, b: Point, n: Point): string {
  const k = 8
  const pts: string[] = []
  for (let i = 0; i <= k; i++) {
    const t = i / k
    const off = (i % 2 ? 0.08 : 0.02)
    pts.push(`${a[0] + (b[0] - a[0]) * t + n[0] * off} ${a[1] + (b[1] - a[1]) * t + n[1] * off}`)
  }
  return `M${pts.join(' L')}`
}

function StrokePreview({ a, b, erase, beam }: { a: Point; b: Point; erase: boolean; beam?: boolean }) {
  const L = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const hz = a[1] === b[1]
  return (
    <g>
      <Seg
        a={a}
        b={b}
        stroke={erase ? INK_FAINT : `color-mix(in oklab, ${beam ? INK : WALL} 60%, transparent)`}
        strokeWidth={PLAN_WALL}
        strokeLinecap="square"
        strokeDasharray={erase ? '.12 .08' : beam ? '.16 .08' : undefined}
      />
      {[a, b].map((q, i) => (
        <circle key={i} cx={q[0]} cy={q[1]} r={0.07} fill={INK} />
      ))}
      {L > 1 && (
        <g transform={`translate(${mx + (hz ? 0 : 0.32)} ${my + (hz ? -0.26 : 0)})`}>
          <rect x={-0.34} y={-0.17} width={0.68} height={0.3} rx={0.06} fill={INK} />
          <text y={0.06} textAnchor="middle" style={{ font: '600 0.19px var(--font-numeric)', fill: CANVAS }}>
            {L} m
          </text>
        </g>
      )}
    </g>
  )
}

/** Where a textile or motif click would land on the hovered wall face. */
function FacePreview({ v, h, brush, erase }: { v: Variant; h: FaceHit; brush: Brush; erase: boolean }) {
  const tx = textileAt(v, h.w.id, h.s, h.t)
  let span: [number, number] | null = null
  if (tx) span = [tx.from, tx.from + tx.width]
  else if (brush.kind === 'textile' && !erase) span = freeSpans(v, rules, h.w.id, h.s).find(([a, b]) => h.t >= a && h.t <= b) ?? null
  else if (brush.kind === 'motif') {
    const f = felt(rules, h.module)
    span = [f.a, f.b]
  }
  if (!span) return null
  const [a, b] = faceSegment(h.w, h.s, span[0] + 0.02, span[1] - 0.02, PLAN_TEXTILE_OFFSET)
  return <Seg a={a} b={b} stroke={brush.kind === 'textile' && !erase ? TEXTILE : INK} strokeOpacity={0.45} strokeWidth={PLAN_TEXTILE + 0.04} />
}


/** True on a whole metre, give or take float noise from stepping in 0.25 m. */
const onMetre = (t: number) => Number.isInteger(Math.round(t * 1000) / 1000)

/** The points a wall or textile brush snaps to; whole metres are drawn a little larger. */
function SnapDots({ W, D, step }: { W: number; D: number; step: number }) {
  const nx = Math.round(W / step)
  const ny = Math.round(D / step)
  return Array.from({ length: (nx + 1) * (ny + 1) }, (_, n) => {
    const x = (n % (nx + 1)) * step
    const y = Math.floor(n / (nx + 1)) * step
    return <circle key={n} cx={x} cy={y} r={onMetre(x) && onMetre(y) ? 0.028 : 0.018} fill={BORDER_STRONG} />
  })
}

/** Room name and floor area on its floor; a dashed outline when selected. */
function RoomMark({ r, selected }: { r: Room; selected: boolean }) {
  const fit = fitRoomLabel(r)
  return (
    <g>
      {selected && (
        <polygon
          points={insetOutline(r.outline, 0.12).map((p) => p.join(',')).join(' ')}
          fill={INK}
          fillOpacity={0.04}
          stroke={INK}
          strokeWidth={0.025}
          strokeDasharray=".1 .06"
          strokeLinejoin="round"
        />
      )}
      {fit && (
        <g transform={`translate(${fit.cx} ${fit.cy}) rotate(${fit.turn ? -90 : 0}) scale(${fit.k})`}>
          <rect x={-fit.w / 2} y={-fit.h / 2} width={fit.w} height={fit.h} rx={0.06} fill={CANVAS} fillOpacity={0.85} />
          <text y={fit.two ? -0.06 : 0.08} textAnchor="middle" style={{ ...LABEL, fontSize: '0.22px' }}>
            {roomName(r)}
          </text>
          {fit.two && (
            <text y={0.22} textAnchor="middle" style={{ ...MONO, fontSize: '0.19px' }}>
              {roomSize(r)}
            </text>
          )}
        </g>
      )}
    </g>
  )
}

/** Clearance kept between a room label and the room's wall lines, m. */
const LABEL_GAP = PLAN_WALL / 2 + 0.06
/** Smallest scale a room label is drawn at; below it the size line is dropped, then the label. */
const LABEL_MIN = 0.6

/**
 * Fits the label box into the room's largest free rectangle, clear of its walls: full size when it fits, else
 * scaled down, turned along a narrow room when that leaves it larger, and without the size line as a last resort.
 */
function fitRoomLabel(r: Room) {
  const box = labelRect(r.outline)
  const aw = box.w - 2 * LABEL_GAP
  const ad = box.d - 2 * LABEL_GAP
  const name = roomName(r)
  const size = roomSize(r)
  /** The label box at scale 1 and the scale it fits at, with the size line (`two`) or without. */
  const measure = (two: boolean) => {
    // Text width estimated from the character count
    const w = Math.max(name.length * 0.135, two ? size.length * 0.125 : 0) + 0.28
    const h = two ? 0.6 : 0.36
    const flat = Math.min(1, aw / w, ad / h)
    const turned = Math.min(1, ad / w, aw / h)
    const turn = turned > flat + 0.05
    return { w, h, two, turn, k: turn ? turned : flat }
  }
  const two = measure(true)
  const one = two.k >= LABEL_MIN ? two : measure(false)
  if (one.k < LABEL_MIN * 0.75) return null
  return { ...one, cx: box.x + box.w / 2, cy: box.y + box.d / 2 }
}

/** Grips at the middle of each side of the selected room: drag a side to resize. */
function RoomHandles({ r }: { r: Room }) {
  return (
    <g>
      {outlineSides(r.outline).map(([a, b], i) => {
        const mx = (a[0] + b[0]) / 2
        const my = (a[1] + b[1]) / 2
        const hz = isHorizontal([a, b])
        return <rect key={i} x={mx - (hz ? 0.2 : 0.06)} y={my - (hz ? 0.06 : 0.2)} width={hz ? 0.4 : 0.12} height={hz ? 0.12 : 0.4} rx={0.05} fill={CANVAS} stroke={INK} strokeWidth={0.03} />
      })}
    </g>
  )
}

function HoverModule({ m }: { m: Module }) {
  return <Seg a={m.a} b={m.b} stroke={INK} strokeOpacity={0.35} strokeWidth={0.18} />
}


/** A line from a to b in model coordinates. */
function Seg({ a, b, ...rest }: { a: Point; b: Point } & SVGProps<SVGLineElement>) {
  return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...rest} />
}
