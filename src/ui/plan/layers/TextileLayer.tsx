// Textile walls and foil decor in the plan: free-standing frames with their foot plates and corner posts, InFrame
// frames in front of their wall face, and a dashed mark where a decal or print sits.
import type { CalcResult } from '../../../calc/calc'
import { foilCenter } from '../../../domain/decor'
import { runNormal, type FaceKey } from '../../../domain/textile/free'
import { alongRun, cornerPosts } from '../../../calc/textile/free'
import type { Point, Variant } from '../../../domain/types'
import { INK, INK_MUTED } from '../../colors'
import { fmt } from '../../format'
import { rules } from '../../env'
import type { Layer } from '../../tools'
import { faceSegment, sideOf } from '../../../domain/faces'
import type { PlanSelection } from '../selection'
import { MONO, PLAN_TEXTILE, PLAN_TEXTILE_OFFSET, PLAN_WALL, TEXTILE } from '../planStyle'
import { Seg } from './Seg'

/** Frittstående tekstilvegger, textile walls on a wall face, and foil decor marks. */
export function TextileLayer({ v, res, selection, mini, dim }: { v: Variant; res: CalcResult; selection: PlanSelection; mini?: boolean; dim: (...layers: Layer[]) => number }) {
  return (
    <>
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
              {!mini && (
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
    </>
  )
}

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
