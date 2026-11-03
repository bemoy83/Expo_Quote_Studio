// Previews while drawing in the plan: the stroke of a wall, beam or textile, where a textile or motif lands on a
// wall face, the snap dots and the module a door would go in.
import { type Module } from '../../../domain/grid'
import { planTextile } from '../../../domain/textile/brush'
import type { Point, Variant, Wall } from '../../../domain/types'
import { BORDER_STRONG, CANVAS, INK, INK_FAINT, SURFACE } from '../../colors'
import { fmt } from '../../format'
import { rules } from '../../env'
import type { Brush } from '../../tools'
import { faceSegment, type FaceSide, felt } from '../../../domain/faces'
import { freeSpans, textileAt } from '../../../domain/textile/inFrame'
import { MONO, PLAN_TEXTILE, PLAN_TEXTILE_OFFSET, PLAN_WALL, TEXTILE, WALL } from '../planStyle'
import { Seg } from './Seg'
import type { EraseMark } from '../pointer/erase'

/** A wall face under the pointer: wall, face, offset along the wall and module index. */
export interface FaceHit {
  w: Wall
  s: FaceSide
  t: number
  module: number
}

export interface TextileLine {
  a: Point
  b: Point
  at: { x: number; y: number }
}

/** The stroke being drawn: on a wall it shows the frame on the face it lands on, elsewhere a free-standing run. */
export function TextilePreview({ v, line }: { v: Variant; line: TextileLine }) {
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

export function StrokePreview({ a, b, erase, beam }: { a: Point; b: Point; erase: boolean; beam?: boolean }) {
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
export function FacePreview({ v, h, brush }: { v: Variant; h: FaceHit; brush: Brush }) {
  const tx = textileAt(v, h.w.id, h.s, h.t)
  let span: [number, number] | null = null
  if (tx) span = [tx.from, tx.from + tx.width]
  else if (brush.kind === 'textile') span = freeSpans(v, rules, h.w.id, h.s).find(([a, b]) => h.t >= a && h.t <= b) ?? null
  else if (brush.kind === 'motif') {
    const f = felt(rules, h.module)
    span = [f.a, f.b]
  }
  if (!span) return null
  const [a, b] = faceSegment(h.w, h.s, span[0] + 0.02, span[1] - 0.02, PLAN_TEXTILE_OFFSET)
  return <Seg a={a} b={b} stroke={brush.kind === 'textile' ? TEXTILE : INK} strokeOpacity={0.45} strokeWidth={PLAN_TEXTILE + 0.04} />
}

/** True on a whole metre, give or take float noise from stepping in 0.25 m. */
const onMetre = (t: number) => Number.isInteger(Math.round(t * 1000) / 1000)

/** The points a wall or textile brush snaps to; whole metres are drawn a little larger. */
export function SnapDots({ W, D, step }: { W: number; D: number; step: number }) {
  const nx = Math.round(W / step)
  const ny = Math.round(D / step)
  return Array.from({ length: (nx + 1) * (ny + 1) }, (_, n) => {
    const x = (n % (nx + 1)) * step
    const y = Math.floor(n / (nx + 1)) * step
    return <circle key={n} cx={x} cy={y} r={onMetre(x) && onMetre(y) ? 0.028 : 0.018} fill={BORDER_STRONG} />
  })
}

/** What a Tøm click takes: faded in the surface colour, marked dashed in ink (a line along its middle, a box or room
 * outlined). */
export function EraseMarkView({ m }: { m: EraseMark }) {
  const dash = '.08 .06'
  if (m.kind === 'seg')
    return (
      <g>
        <Seg a={m.a} b={m.b} stroke={SURFACE} strokeOpacity={0.75} strokeWidth={m.width + 0.04} />
        <Seg a={m.a} b={m.b} stroke={INK} strokeWidth={0.03} strokeDasharray={dash} />
      </g>
    )
  const common = { fill: SURFACE, fillOpacity: 0.7, stroke: INK, strokeWidth: 0.03, strokeDasharray: dash }
  if (m.kind === 'box') return <rect x={m.x} y={m.y} width={m.w} height={m.h} rx={0.02} {...common} />
  return <polygon points={m.points.map((p) => p.join(',')).join(' ')} {...common} />
}

export function HoverModule({ m }: { m: Module }) {
  return <Seg a={m.a} b={m.b} stroke={INK} strokeOpacity={0.35} strokeWidth={0.18} />
}
