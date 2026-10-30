// 2D plan. Explicit layers, bottom to top: ground, floor, grid, walls, openings, textiles, beams and posts,
// objects, labels, interaction preview. Pointer handling is done on the svg with model coordinates, so the
// draw order never decides what can be clicked.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { CalcResult } from '../../calc/calc'
import { defaultSwing, eraseWalls, isPerimeterWall, moveWall, paintFloor, paintWalls, segmentKeys, setOpening } from '../../domain/edit'
import { CELL, parseCellKey, pointAlong, sideLength, sidePoint, wallDirection, type Module } from '../../domain/grid'
import { addObject, conflicts, findSpot, footprintBox, moveObject, removeObject } from '../../domain/objects'
import type { Point, Side, Variant } from '../../domain/types'
import { builtModules, type BuiltModule } from '../../domain/walls'
import { fmt } from '../format'
import { idx, place, plateColor, productOf, rules } from '../env'
import type { Brush, FloorSize, Highlight, Tool } from '../tools'
import { distToSegment, nearestEdge, strokeFrom } from './geometry'

export interface PlanSelection {
  wallId?: string
  objectId?: string
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
}

const M = 1.3
const SIDE_LABEL: Record<Side, string> = { back: 'Bak', front: 'Front', left: 'Venstre', right: 'Høyre' }
const WALL = 'var(--line-sky)'
const TEXTILE = 'var(--line-violet)'

type Drag =
  | { kind: 'stroke'; p0: P; moved: boolean }
  | { kind: 'floor'; last: string | null }
  | { kind: 'object'; id: string; dx: number; dy: number; start: P; moved: boolean }
  | { kind: 'wall'; id: string; p0: P; v0: Variant; delta: number; horizontal: boolean }

interface P {
  x: number
  y: number
}

export function PlanView(p: Props) {
  const { v, res, tool, brush, floorSize, highlight, selection } = p
  const { width: W, depth: D } = v.stand
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [hover, setHover] = useState<P | null>(null)
  const [stroke, setStroke] = useState<[Point, Point] | null>(null)

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
      if (!m) {
        p.onToast('Klikk på en vegg for å sette inn en åpning')
        return
      }
      p.onEdit((x) => setOpening(x, m.key, tool === 'erase' ? null : brush!.product))
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
    // Select
    const o = objectAt(q)
    if (o) {
      p.onSelect({ objectId: o.id })
      drag.current = { kind: 'object', id: o.id, dx: q.x - o.x, dy: q.y - o.y, start: { x: o.x, y: o.y }, moved: false }
      return
    }
    const m = moduleAt(q)
    if (m) {
      const w = v.walls.find((x) => x.id === m.wallId)!
      p.onSelect({ wallId: w.id })
      if (!isPerimeterWall(v.stand, w)) drag.current = { kind: 'wall', id: w.id, p0: q, v0: v, delta: 0, horizontal: w.from[1] === w.to[1] }
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
    } else if (d.kind === 'wall') {
      const delta = Math.round(d.horizontal ? q.y - d.p0.y : q.x - d.p0.x)
      if (delta === d.delta) return
      const next = moveWall(d.v0, d.id, delta)
      if (next === d.v0 && delta !== 0) return
      if (d.delta === 0) p.onCheckpoint()
      d.delta = delta
      p.onEdit(() => next, false)
    }
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
    } else if (d.kind === 'object' && d.moved) {
      const o = v.objects.find((x) => x.id === d.id)
      if (o && bad.has(o.id)) {
        const spot = findSpot(v, place, o, 1)
        if (spot) p.onEdit((x) => ({ ...x, objects: x.objects.map((y) => (y.id === o.id ? spot : y)) }), false)
        else {
          p.onEdit((x) => moveObject(x, place, d.id, d.start.x, d.start.y), false)
          p.onToast('Ikke plass der')
        }
      }
    }
  }

  const dim = (layer: Exclude<Highlight, null>) => (highlight && highlight !== layer ? 0.25 : 1)
  const cursor = tool === 'select' ? 'default' : 'crosshair'

  // Hover previews
  const hoverModule = openingTool && hover ? moduleAt(hover, 0.4) : null
  const hoverFloor = floorTool && hover && !drag.current ? floorBlock(hover) : null
  const hoverEdge = wallTool && hover && !stroke && hover.x > -0.4 && hover.y > -0.4 && hover.x < W + 0.4 && hover.y < D + 0.4 ? nearestEdge(v.stand, hover) : null

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
      viewBox={`${-M} ${-M} ${W + 2 * M} ${D + 2 * M}`}
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
          fill="rgb(var(--ink-faint))"
          style={LABEL}
        >
          Gang
        </text>
        <rect x={0} y={0} width={W} height={D} fill="rgb(var(--surface))" />
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
            (i + 1) % 2 ? <line key={`hx${i}`} x1={(i + 1) * CELL} y1={0} x2={(i + 1) * CELL} y2={D} stroke="rgb(0 0 0 / .1)" strokeWidth={0.008} strokeDasharray=".04 .04" /> : null,
          )}
        {floorTool &&
          Array.from({ length: Math.round(D / CELL) - 1 }, (_, j) =>
            (j + 1) % 2 ? <line key={`hy${j}`} x1={0} y1={(j + 1) * CELL} x2={W} y2={(j + 1) * CELL} stroke="rgb(0 0 0 / .1)" strokeWidth={0.008} strokeDasharray=".04 .04" /> : null,
          )}
        {Array.from({ length: W - 1 }, (_, i) => (
          <line key={`gx${i}`} x1={i + 1} y1={0} x2={i + 1} y2={D} stroke={floorIds.length ? 'rgb(0 0 0 / .14)' : 'rgb(var(--border))'} strokeWidth={0.012} />
        ))}
        {Array.from({ length: D - 1 }, (_, j) => (
          <line key={`gy${j}`} x1={0} y1={j + 1} x2={W} y2={j + 1} stroke={floorIds.length ? 'rgb(0 0 0 / .14)' : 'rgb(var(--border))'} strokeWidth={0.012} />
        ))}
        {Array.from({ length: (W + 1) * (D + 1) }, (_, n) => (
          <circle key={`d${n}`} cx={n % (W + 1)} cy={Math.floor(n / (W + 1))} r={0.028} fill="rgb(var(--border-strong))" />
        ))}
      </g>

      {/* Walls */}
      <g opacity={dim('walls')} pointerEvents="none">
        {mods.filter((m) => !m.opening).map((m) => {
          const sel = selection.wallId === m.wallId
          return (
            <g key={m.key}>
              {sel && <line x1={m.a[0]} y1={m.a[1]} x2={m.b[0]} y2={m.b[1]} stroke="rgb(var(--ink))" strokeWidth={0.24} />}
              <line x1={m.a[0]} y1={m.a[1]} x2={m.b[0]} y2={m.b[1]} stroke={WALL} strokeWidth={0.14} />
              {m.plate !== v.defaultPlate && (
                <line x1={m.a[0]} y1={m.a[1]} x2={m.b[0]} y2={m.b[1]} stroke={plateColor(m.plate)} strokeWidth={0.05} />
              )}
            </g>
          )
        })}
      </g>

      {/* Openings */}
      <g opacity={dim('openings')} pointerEvents="none">
        {mods.filter((m) => m.opening).map((m) => <OpeningMark key={m.key} v={v} m={m} selected={selection.wallId === m.wallId} />)}
      </g>

      {/* Textile walls: drawn just in front of their wall */}
      <g opacity={dim('textile')} pointerEvents="none">
        {v.textiles.map((t) => {
          const w = v.walls.find((x) => x.id === t.wallId)
          if (!w) return null
          const [dx, dy] = wallDirection(w)
          const n = defaultSwing(v.stand, w)
          const o = 0.11
          const a = pointAlong(w, t.from)
          const b = pointAlong(w, t.from + t.width)
          const off: Point = [-dy * n * o, dx * n * o]
          return <line key={t.id} x1={a[0] + off[0]} y1={a[1] + off[1]} x2={b[0] + off[0]} y2={b[1] + off[1]} stroke={TEXTILE} strokeWidth={0.06} />
        })}
      </g>

      {/* Beams and posts */}
      <g pointerEvents="none">
        <g opacity={dim('beams')}>
          {res.beams.segments.map((s, i) => (
            <line key={i} x1={s.from[0]} y1={s.from[1]} x2={s.to[0]} y2={s.to[1]} stroke="rgb(var(--ink-muted))" strokeWidth={0.05} strokeDasharray=".16 .08" />
          ))}
        </g>
        <g opacity={highlight && highlight !== 'walls' && highlight !== 'beams' ? 0.25 : 1}>
          {res.posts.map((q) => (
            <rect key={`${q[0]},${q[1]}`} x={q[0] - 0.04} y={q[1] - 0.04} width={0.08} height={0.08} fill="rgb(var(--ink))" />
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
          const stroke = isBad ? 'var(--al-block)' : 'rgb(var(--ink))'
          const sw = isBad ? 0.06 : sel ? 0.05 : 0.018
          return f.round ? (
            <circle key={o.id} cx={o.x} cy={o.y} r={f.w / 2} fill={col} stroke={stroke} strokeWidth={sw} style={{ cursor: tool === 'select' ? 'move' : undefined }} />
          ) : (
            <rect key={o.id} x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} rx={0.03} fill={col} stroke={stroke} strokeWidth={sw} />
          )
        })}
      </g>

      {/* Labels */}
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

      {/* Interaction preview */}
      <g pointerEvents="none">
        {hoverEdge && <line x1={hoverEdge.a[0]} y1={hoverEdge.a[1]} x2={hoverEdge.b[0]} y2={hoverEdge.b[1]} stroke={tool === 'erase' ? 'rgb(var(--ink-faint))' : WALL} strokeOpacity={0.6} strokeWidth={0.14} />}
        {stroke && <StrokePreview a={stroke[0]} b={stroke[1]} erase={tool === 'erase'} />}
        {hoverModule && <HoverModule m={hoverModule} />}
        {hoverFloor && (
          <rect
            x={hoverFloor.i * CELL}
            y={hoverFloor.j * CELL}
            width={floorSize.w * CELL}
            height={floorSize.h * CELL}
            rx={0.02}
            fill={tool === 'erase' || brush?.kind !== 'floor' ? 'rgb(var(--surface))' : idx.byArtnr.get(brush.product)?.variant.color}
            fillOpacity={0.75}
            stroke="rgb(var(--ink))"
            strokeWidth={0.03}
          />
        )}
      </g>
    </svg>
  )
}

const LABEL = { font: '500 0.26px var(--font-ui)', fill: 'rgb(var(--ink-muted))' }
const MONO = { font: '500 0.24px var(--font-numeric)', fill: 'rgb(var(--ink-faint))' }

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
      {selected && <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="rgb(var(--ink))" strokeOpacity={0.3} strokeWidth={0.24} />}
      {/* Header panel over the opening */}
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={WALL} strokeOpacity={0.45} strokeWidth={0.05} />
      {door ? (
        <g fill="none" stroke="rgb(var(--ink))" strokeWidth={0.025}>
          <line x1={a[0]} y1={a[1]} x2={a[0] + n[0] * r} y2={a[1] + n[1] * r} />
          <path
            d={`M${a[0] + dx * r} ${a[1] + dy * r} A${r} ${r} 0 0 ${s === 1 ? 1 : 0} ${a[0] + n[0] * r} ${a[1] + n[1] * r}`}
            strokeDasharray=".05 .05"
          />
        </g>
      ) : (
        <path d={curtainPath(a, b, n)} fill="none" stroke="rgb(var(--ink))" strokeWidth={0.025} />
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
      <line
        x1={a[0]}
        y1={a[1]}
        x2={b[0]}
        y2={b[1]}
        stroke={erase ? 'rgb(var(--ink-faint))' : `color-mix(in oklab, ${WALL} 60%, transparent)`}
        strokeWidth={0.14}
        strokeLinecap="square"
        strokeDasharray={erase ? '.12 .08' : undefined}
      />
      {[a, b].map((q, i) => (
        <circle key={i} cx={q[0]} cy={q[1]} r={0.07} fill="rgb(var(--ink))" />
      ))}
      {L > 1 && (
        <g transform={`translate(${mx + (hz ? 0 : 0.32)} ${my + (hz ? -0.26 : 0)})`}>
          <rect x={-0.34} y={-0.17} width={0.68} height={0.3} rx={0.06} fill="rgb(var(--ink))" />
          <text y={0.06} textAnchor="middle" style={{ font: '600 0.19px var(--font-numeric)', fill: 'rgb(var(--canvas))' }}>
            {L} m
          </text>
        </g>
      )}
    </g>
  )
}

function HoverModule({ m }: { m: Module }) {
  return <line x1={m.a[0]} y1={m.a[1]} x2={m.b[0]} y2={m.b[1]} stroke="rgb(var(--ink))" strokeOpacity={0.35} strokeWidth={0.18} />
}

