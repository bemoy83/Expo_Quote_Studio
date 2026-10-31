// 2D plan. Explicit layers, bottom to top: ground, floor, grid, walls, openings, textiles, beams and posts,
// objects, labels, interaction preview. Pointer handling is done on the svg with model coordinates, so the
// draw order never decides what can be clicked.
import { useEffect, useMemo, useRef, useState, type DragEvent as RDragEvent, type PointerEvent as RPointerEvent, type SVGProps } from 'react'
import type { CalcResult } from '../../calc/calc'
import { mainGroupOf } from '../../catalog/groups'
import { defaultSwing, drawOpening, eraseWalls, isPerimeterWall, paintFloor, paintWalls, segmentKeys, setOpening } from '../../domain/edit'
import { CELL, parseCellKey, pointAlong, sideLength, sidePoint, wallDirection, wallLength, type Module } from '../../domain/grid'
import { addObject, conflicts, footprintBox, moveObject, removeObject } from '../../domain/objects'
import { addFoil, addTextile, faceAt, faceSegment, felt, foilAt, foilCenter, freeSpans, removeFoil, removeTextile, sideOf, textileAt, textileOffset, updateTextile, type FaceSide } from '../../domain/decor'
import type { Motif } from '../../persistence/file'
import type { Point, RectFace, Room, Side, Variant, Wall } from '../../domain/types'
import { builtModules, type BuiltModule } from '../../domain/walls'
import { BORDER, BORDER_STRONG, BLOCK, CANVAS, INK, INK_FAINT, INK_MUTED, LAYER_COLOR, SURFACE } from '../colors'
import { applyDrop, decorDrag, endDecorDrag, type DecorDrag } from '../dnd'
import { dragRoom, dragWall, dropObject, dropRoom, roomDrag, type RoomDrag, type WallDrag } from '../drag'
import { faceEnds, FACES, roomAt, roomSideAt } from '../../domain/rooms'
import { fmt } from '../format'
import { idx, place, plateColor, productOf, rules } from '../env'
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
}

interface Props {
  v: Variant
  res: CalcResult
  tool: Tool
  brush: Brush | null
  floorSize: FloorSize
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

/** Margin around the stand for the aisle and the side labels, m. */
export const PLAN_MARGIN = 1.3
const M = PLAN_MARGIN
const SIDE_LABEL: Record<Side, string> = { back: 'Bak', front: 'Front', left: 'Venstre', right: 'Høyre' }
const WALL = LAYER_COLOR.walls
const TEXTILE = LAYER_COLOR.textile

/** Grid lines over a laid floor: dark enough to read on any floor colour. */
const GRID_ON_FLOOR = 'rgb(0 0 0 / .14)'
/** Half-metre lines while painting floor. */
const GRID_FINE = 'rgb(0 0 0 / .1)'
/** Opacity of layers outside the hovered calc group. */
const DIMMED = 0.25

type Drag =
  | { kind: 'stroke'; p0: P; moved: boolean }
  | { kind: 'floor'; last: string | null }
  | { kind: 'object'; id: string; dx: number; dy: number; start: P; moved: boolean }
  | ({ kind: 'wall' } & WallDrag)
  | ({ kind: 'room' } & RoomDrag)

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
  const { width: W, depth: D } = v.stand
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [hover, setHover] = useState<P | null>(null)
  const [stroke, setStroke] = useState<[Point, Point] | null>(null)
  /** A frame or motif dragged from Profilering, over a wall face. */
  const [dropHover, setDropHover] = useState<{ h: FaceHit; d: DecorDrag } | null>(null)

  const mods = useMemo(() => builtModules(v), [v])
  const bad = useMemo(() => conflicts(v, place), [v])
  const modKeys = useMemo(() => new Set(mods.map((m) => m.key)), [mods])

  useEffect(() => {
    setStroke(null)
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
  const decorTool = tool !== 'select' && (brush?.kind === 'textile' || brush?.kind === 'motif')

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

  /** The wall face under the pointer. */
  const faceHit = (q: P): FaceHit | null => {
    const m = moduleAt(q, 0.4)
    if (!m) return null
    const w = v.walls.find((x) => x.id === m.wallId)!
    const [dx, dy] = wallDirection(w)
    const L = wallLength(w)
    const t = Math.max(0, Math.min(L, (q.x - w.from[0]) * dx + (q.y - w.from[1]) * dy))
    return { w, s: faceAt(v, w, q), t, module: Math.min(Math.floor(t), L - 1) }
  }
  const ratioOf = (id: string) => findMotif(p.motifs, id)?.ratio ?? 1

  /** The side of a room under the pointer: its own walls always, any side of the selected room. */
  const roomEdgeAt = (q: P): { room: Room; face: RectFace } | null => {
    const m = moduleAt(q, 0.2)
    const w = m && v.walls.find((x) => x.id === m.wallId)
    if (w?.room) {
      const room = v.rooms.find((r) => r.id === w.room!.id)
      if (room) return { room, face: w.room.face }
    }
    const sel = v.rooms.find((r) => r.id === selection.roomId)
    return (sel && roomSideAt({ ...v, rooms: [sel] }, q.x, q.y, 0.2)) ?? null
  }
  const startRoomDrag = (room: Room, mode: RoomDrag['mode'], q: P) => {
    drag.current = { kind: 'room', ...roomDrag(room.id, mode, q, v) }
  }

  /** Textile brush: fill the free part of the face. Motif brush: print on a textile, or foil on a wall panel. */
  const decorClick = (q: P) => {
    const h = faceHit(q)
    const isTextile = brush?.kind === 'textile'
    if (!h) return p.onToast(isTextile ? 'Klikk ved en vegg, på siden tekstilveggen skal stå' : 'Klikk ved en vegg eller en tekstilvegg')
    const tx = textileAt(v, h.w.id, h.s, h.t)
    if (tool === 'erase') {
      if (isTextile) return tx ? p.onEdit((x) => removeTextile(x, tx.id)) : p.onToast('Ingen tekstilvegg her')
      const f = foilAt(v, rules, h.w.id, h.s, h.t)
      if (f) return p.onEdit((x) => removeFoil(x, f.id))
      if (tx?.motif) return p.onEdit((x) => updateTextile(x, rules, tx.id, { motif: null }))
      return p.onToast('Ingen grafikk her')
    }
    if (isTextile) {
      if (tx) return p.onToast('Det står allerede en tekstilvegg her')
      const r = addTextile(v, rules, h.w.id, h.s, h.t)
      if (!r) return p.onToast('Ingen ledig veggflate her')
      p.onEdit(() => r.v)
      const t = r.v.textiles.find((x) => x.id === r.id)!
      return p.onToast(`Tekstilvegg ${fmt(t.width)} m lagt til · Velg den for å justere`)
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
    if (wallTool) {
      drag.current = { kind: 'stroke', p0: q, moved: false }
      const e0 = nearestEdge(v.stand, q)
      setStroke([e0.a, e0.b])
      return
    }
    if (openingTool) {
      const m = moduleAt(q, 0.4)
      if (m) p.onEdit((x) => setOpening(x, m.key, tool === 'erase' ? null : brush!.product))
      else if (tool !== 'erase' && onStand(q)) {
        // No wall there: the door or curtain draws its own wall module
        const e = nearestEdge(v.stand, q)
        p.onEdit((x) => drawOpening(x, e.a, e.b, brush!.product))
      }
      return
    }
    if (decorTool) {
      decorClick(q)
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
      startRoomDrag(selEdge.room, selEdge.face, q)
      return
    }
    const o = objectAt(q)
    if (o) {
      p.onSelect({ objectId: o.id })
      drag.current = { kind: 'object', id: o.id, dx: q.x - o.x, dy: q.y - o.y, start: { x: o.x, y: o.y }, moved: false }
      return
    }
    const m = moduleAt(q)
    if (m) {
      const w = v.walls.find((x) => x.id === m.wallId)!
      const h = faceHit(q)
      const tx = h && textileAt(v, w.id, h.s, h.t)
      p.onSelect(tx ? { wallId: w.id, side: h.s, textileId: tx.id } : { wallId: w.id, side: h?.s })
      // A room's own wall resizes the room; a drawn inner wall moves
      const room = w.room && v.rooms.find((r) => r.id === w.room!.id)
      if (room) startRoomDrag(room, w.room!.face, q)
      else if (!isPerimeterWall(v.stand, w)) drag.current = { kind: 'wall', id: w.id, p0: q, v0: v, delta: 0, horizontal: w.from[1] === w.to[1] }
      return
    }
    const room = roomAt(v, q.x, q.y)
    if (room) {
      p.onSelect({ roomId: room.id })
      startRoomDrag(room, 'move', q)
      return
    }
    p.onSelect({})
  }

  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const q = toModel(e)
    setHover(q)
    const d = drag.current
    if (!d) return
    if (d.kind === 'floor') paintFloorAt(q)
    else if (d.kind === 'stroke') {
      if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > 0.35) d.moved = true
      if (d.moved) setStroke(strokeFrom(v.stand, d.p0, q))
    } else if (d.kind === 'object') {
      if (!d.moved) {
        if (Math.hypot(q.x - d.dx - d.start.x, q.y - d.dy - d.start.y) < 0.03) return
        d.moved = true
        p.onCheckpoint()
      }
      p.onEdit((x) => moveObject(x, place, d.id, q.x - d.dx, q.y - d.dy), false)
    } else if (d.kind === 'wall') dragWall(d, q, p.onEdit, p.onCheckpoint)
    else if (d.kind === 'room') dragRoom(d, q, p.onEdit, p.onCheckpoint)
  }

  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.kind === 'stroke') {
      const [a, b] = d.moved ? strokeFrom(v.stand, d.p0, toModel(e)) : (() => {
        const m = nearestEdge(v.stand, d.p0)
        return [m.a, m.b] as [Point, Point]
      })()
      setStroke(null)
      if (tool === 'erase') p.onEdit((x) => eraseWalls(x, segmentKeys(a, b)))
      else if (brush?.kind === 'wall') p.onEdit((x) => paintWalls(x, a, b, brush.ral))
    } else if (d.kind === 'object' && d.moved) dropObject(v, d.id, d.start, p.onEdit, p.onToast)
    else if (d.kind === 'room') dropRoom(d, p.onEdit)
  }

  // Drag and drop from Profilering: the same as a click with the textile or motif brush
  const onDragOver = (e: RDragEvent<SVGSVGElement>) => {
    const d = decorDrag(e)
    if (!d || p.mini) return
    e.preventDefault()
    const h = faceHit(toModel(e))
    e.dataTransfer.dropEffect = h ? 'copy' : 'none'
    setDropHover(h ? { h, d } : null)
  }
  const onDrop = (e: RDragEvent<SVGSVGElement>) => {
    const d = decorDrag(e)
    setDropHover(null)
    endDecorDrag()
    if (!d || p.mini) return
    e.preventDefault()
    const h = faceHit(toModel(e))
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
    if (d?.kind === 'room') return d.mode === 'move' ? 'grabbing' : d.mode === 'left' || d.mode === 'right' ? 'ew-resize' : 'ns-resize'
    if (!hover || p.mini) return 'default'
    const e = roomEdgeAt(hover)
    if (e) return e.face === 'left' || e.face === 'right' ? 'ew-resize' : 'ns-resize'
    return roomAt(v, hover.x, hover.y) && !objectAt(hover) ? 'move' : 'default'
  }

  // Hover previews
  const hoverModule = openingTool && hover ? (moduleAt(hover, 0.4) ?? (tool !== 'erase' && onStand(hover) ? nearestEdge(v.stand, hover) : null)) : null
  const hoverFloor = floorTool && hover && !drag.current ? floorBlock(hover) : null
  const hoverFace = decorTool && hover ? faceHit(hover) : null
  const hoverEdge = wallTool && hover && !stroke && onStand(hover) ? nearestEdge(v.stand, hover) : null

  const sideText = (s: Side) => {
    const n = sideLength(v.stand, s)
    let c = 0
    for (let t = 0; t < n; t++) {
      const a = sidePoint(v.stand, s, t)
      const b = sidePoint(v.stand, s, t + 1)
      if (modKeys.has(nearestEdge(v.stand, { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 }).key)) c++
    }
    return c === 0 ? 'åpen' : c === n ? 'standvegg' : 'delvis standvegg'
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
      {/* Ground: aisle and stand surface */}
      <g>
        <rect x={-M} y={D} width={W + 2 * M} height={M} fill="var(--sunken-2)" />
        {/* With a floor legend in the aisle, the label moves to the right so they never overlap */}
        <text
          x={floorIds.length > 1 ? W + M - 0.25 : W / 2}
          y={D + M * 0.66}
          textAnchor={floorIds.length > 1 ? 'end' : 'middle'}
          className="plan-label"
          fill={INK_FAINT}
          style={LABEL}
        >
          Gang
        </text>
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
        {Array.from({ length: (W + 1) * (D + 1) }, (_, n) => (
          <circle key={`d${n}`} cx={n % (W + 1)} cy={Math.floor(n / (W + 1))} r={0.028} fill={BORDER_STRONG} />
        ))}
      </g>

      {/* Walls */}
      <g opacity={dim('walls')} pointerEvents="none">
        {mods.filter((m) => !m.opening).map((m) => {
          const sel = selection.wallId === m.wallId
          return (
            <g key={m.key}>
              {sel && <Seg a={m.a} b={m.b} stroke={INK} strokeWidth={0.24} />}
              <Seg a={m.a} b={m.b} stroke={WALL} strokeWidth={0.14} />
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

      {/* Textile walls: drawn in front of their face */}
      <g opacity={dim('textile')} pointerEvents="none">
        {v.textiles.map((t) => {
          const w = v.walls.find((x) => x.id === t.wallId)
          if (!w) return null
          const [a, b] = faceSegment(w, sideOf(v, t), t.from + 0.02, t.from + t.width - 0.02, textileOffset(rules))
          const sel = selection.textileId === t.id
          return (
            <g key={t.id}>
              {sel && <Seg a={a} b={b} stroke={INK} strokeWidth={rules.textile.depth + 0.06} />}
              <Seg a={a} b={b} stroke={TEXTILE} strokeWidth={rules.textile.depth} />
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
          const [a, b] = faceSegment(w, sideOf(v, f), c - f.width / 2, c + f.width / 2, rules.wall.post / 2 + 0.03)
          const sel = selection.foilId === f.id
          return <Seg key={f.id} a={a} b={b} stroke={INK} strokeWidth={sel ? 0.05 : 0.03} strokeDasharray=".06 .04" />
        })}
      </g>

      {/* Beams and posts */}
      <g pointerEvents="none">
        <g opacity={dim('beams')}>
          {res.beams.segments.map((s, i) => (
            <Seg key={i} a={s.from} b={s.to} stroke={INK_MUTED} strokeWidth={0.05} strokeDasharray=".16 .08" />
          ))}
        </g>
        <g opacity={(highlight && highlight !== 'walls' && highlight !== 'beams') || off('vegg') ? DIMMED : 1}>
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
        <text x={W / 2} y={-M * 0.52} textAnchor="middle" style={LABEL}>
          {SIDE_LABEL.back} · {sideText('back')}
        </text>
        <text x={W / 2} y={-M * 0.2} textAnchor="middle" style={MONO}>
          {W} m
        </text>
        <text transform={`translate(${-M * 0.42} ${D / 2}) rotate(-90)`} textAnchor="middle" style={LABEL}>
          {SIDE_LABEL.left} · {sideText('left')}
        </text>
        <text transform={`translate(${-M * 0.14} ${D / 2}) rotate(-90)`} textAnchor="middle" style={MONO}>
          {D} m
        </text>
        <text transform={`translate(${W + M * 0.5} ${D / 2}) rotate(90)`} textAnchor="middle" style={LABEL}>
          {SIDE_LABEL.right} · {sideText('right')}
        </text>
        <text x={W / 2} y={D + M * 0.3} textAnchor="middle" style={LABEL}>
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
        {hoverEdge && <Seg a={hoverEdge.a} b={hoverEdge.b} stroke={tool === 'erase' ? INK_FAINT : WALL} strokeOpacity={0.6} strokeWidth={0.14} />}
        {stroke && <StrokePreview a={stroke[0]} b={stroke[1]} erase={tool === 'erase'} />}
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

function OpeningMark({ v, m, selected }: { v: Variant; m: BuiltModule; selected: boolean }) {
  const o = m.opening!
  const w = v.walls.find((x) => x.id === o.wallId)!
  const [dx, dy] = wallDirection(w)
  const s = o.swing ?? defaultSwing(v.stand, w)
  const n: Point = [-dy * s, dx * s]
  const a = pointAlong(w, o.module)
  const b = pointAlong(w, o.module + 1)
  const door = productOf(o.product)?.opening === 'door'
  const r = rules.door.swing
  return (
    <g>
      {selected && <Seg a={a} b={b} stroke={INK} strokeOpacity={0.3} strokeWidth={0.24} />}
      {/* Header panel over the opening */}
      <Seg a={a} b={b} stroke={WALL} strokeOpacity={0.45} strokeWidth={0.05} />
      {door ? (
        <g fill="none" stroke={INK} strokeWidth={0.025}>
          <line x1={a[0]} y1={a[1]} x2={a[0] + n[0] * r} y2={a[1] + n[1] * r} />
          <path
            d={`M${a[0] + dx * r} ${a[1] + dy * r} A${r} ${r} 0 0 ${s === 1 ? 1 : 0} ${a[0] + n[0] * r} ${a[1] + n[1] * r}`}
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

function StrokePreview({ a, b, erase }: { a: Point; b: Point; erase: boolean }) {
  const L = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const hz = a[1] === b[1]
  return (
    <g>
      <Seg
        a={a}
        b={b}
        stroke={erase ? INK_FAINT : `color-mix(in oklab, ${WALL} 60%, transparent)`}
        strokeWidth={0.14}
        strokeLinecap="square"
        strokeDasharray={erase ? '.12 .08' : undefined}
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
  const [a, b] = faceSegment(h.w, h.s, span[0] + 0.02, span[1] - 0.02, textileOffset(rules))
  return <Seg a={a} b={b} stroke={brush.kind === 'textile' && !erase ? TEXTILE : INK} strokeOpacity={0.45} strokeWidth={rules.textile.depth + 0.04} />
}

const ROOM_NAME = 'Bakrom'

/** Room name and size on its floor; a dashed outline when selected. */
function RoomMark({ r, selected }: { r: Room; selected: boolean }) {
  const cx = r.x + r.w / 2
  const cy = r.y + r.d / 2
  const small = Math.min(r.w, r.d) < 2
  return (
    <g>
      {selected && <rect x={r.x + 0.12} y={r.y + 0.12} width={r.w - 0.24} height={r.d - 0.24} rx={0.04} fill={INK} fillOpacity={0.04} stroke={INK} strokeWidth={0.025} strokeDasharray=".1 .06" />}
      <rect x={cx - (small ? 0.4 : 0.6)} y={cy - (small ? 0.2 : 0.3)} width={small ? 0.8 : 1.2} height={small ? 0.44 : 0.6} rx={0.06} fill={CANVAS} fillOpacity={0.85} />
      <text x={cx} y={cy - (small ? 0.02 : 0.06)} textAnchor="middle" style={{ ...LABEL, fontSize: small ? '0.17px' : '0.22px' }}>
        {r.label ?? ROOM_NAME}
      </text>
      <text x={cx} y={cy + (small ? 0.18 : 0.22)} textAnchor="middle" style={{ ...MONO, fontSize: small ? '0.15px' : '0.19px' }}>
        {r.w} × {r.d} m
      </text>
    </g>
  )
}

/** Grips at the middle of each side of the selected room: drag a side to resize. */
function RoomHandles({ r }: { r: Room }) {
  return (
    <g>
      {FACES.map((face) => {
        const [a, b] = faceEnds(r, face)
        const mx = (a[0] + b[0]) / 2
        const my = (a[1] + b[1]) / 2
        const hz = face === 'back' || face === 'front'
        return <rect key={face} x={mx - (hz ? 0.2 : 0.06)} y={my - (hz ? 0.06 : 0.2)} width={hz ? 0.4 : 0.12} height={hz ? 0.12 : 0.4} rx={0.05} fill={CANVAS} stroke={INK} strokeWidth={0.03} />
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
