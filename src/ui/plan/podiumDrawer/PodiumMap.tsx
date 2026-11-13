// «Velg side» in the drawer for a counter of Disker og podier (detail only): the counter from above, turned as on the
// plan, its sides as lines; the chosen one thick, a click on another shows it.
import { useState } from 'react'
import { toPlan } from '../../../domain/counterShape'
import type { PlacedObject } from '../../../domain/types'
import { RECIPES } from '../../../foga/recipes'
import { INK, INK_FAINT, SURFACE } from '../../colors'
import { sideOnPlan, type DrawerSide } from './podiumView'

const F = RECIPES.counter.face
/** The map's largest size, px. */
const MAX = { w: 190, h: 90 }

export function PodiumMap({ o, sides, chosen, onPick }: { o: PlacedObject; sides: DrawerSide[]; chosen: number; onPick: (i: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const sections = o.sections ?? []
  // Outer corners of each section on the plan, m, about the counter's middle
  const mid = { ...o, x: 0, y: 0 }
  const rects = sections.map((s) => {
    const p = toPlan(mid, [s.x[0] - F, s.z[0] - F])
    const q = toPlan(mid, [s.x[1] + F, s.z[1] + F])
    return { x0: Math.min(p[0], q[0]), y0: Math.min(p[1], q[1]), x1: Math.max(p[0], q[0]), y1: Math.max(p[1], q[1]) }
  })
  if (!rects.length) return null
  const bx = [Math.min(...rects.map((r) => r.x0)), Math.max(...rects.map((r) => r.x1))]
  const by = [Math.min(...rects.map((r) => r.y0)), Math.max(...rects.map((r) => r.y1))]
  const k = Math.min(MAX.w / (bx[1] - bx[0]), MAX.h / (by[1] - by[0]))
  const P = 8
  const X = (m: number) => (m - bx[0]) * k + P
  const Y = (m: number) => (m - by[0]) * k + P
  const W = (bx[1] - bx[0]) * k + 2 * P
  const H = (by[1] - by[0]) * k + 2 * P
  const line = (d: DrawerSide) => {
    const [p, q] = sideOnPlan(mid, d.side, F)
    return { x1: X(p[0]), y1: Y(p[1]), x2: X(q[0]), y2: Y(q[1]) }
  }
  return (
    <svg className="podium-map" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Miniplan, velg side">
      {rects.map((r, i) => (
        <rect key={i} x={X(r.x0)} y={Y(r.y0)} width={(r.x1 - r.x0) * k} height={(r.y1 - r.y0) * k} fill={SURFACE} />
      ))}
      {sides.map((d, i) => {
        const l = line(d)
        const on = i === chosen
        return (
          <g key={d.key}>
            <line {...l} stroke={on ? INK : INK_FAINT} strokeWidth={on ? 3 : hover === i ? 2 : 1} strokeLinecap="square" />
            {/* A wider target than the line */}
            <line
              {...l}
              stroke="transparent"
              strokeWidth={14}
              style={{ cursor: on ? 'default' : 'pointer' }}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onClick={() => onPick(i)}
            >
              <title>{`Vis siden ${d.name}`}</title>
            </line>
          </g>
        )
      })}
    </svg>
  )
}
