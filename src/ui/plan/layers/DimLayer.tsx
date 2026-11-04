// Dimension chains in the plan, in millimetres (docs/arbeidstegning.md, «Mål»). What is measured comes from
// plan/dims.ts; this layer draws the chains: hairlines in muted ink, slashes as end marks, the number between them.
import type { Variant } from '../../../domain/types'
import { INK_MUTED } from '../../colors'
import type { PlanSelection } from '../selection'
import { linePx, sizePx, usePlanScale, type PlanScale } from '../planScale'
import { DIM_NEAR, DIM_TOTAL, mm, planDims, sideLine, type InnerChain } from '../dims'
import { textileWidth, wallWidth } from '../planStyle'

/** Number size, screen px. */
const DIM_FONT = 10

/** All dimension chains for the current selection. */
export function DimLayer({ v, selection }: { v: Variant; selection: PlanSelection }) {
  const sc = usePlanScale()
  const dims = planDims(v, selection, sc.detail === 'compact')
  return (
    <g pointerEvents="none">
      {dims.sides.map(({ side, near, total }) => {
        const line = sideLine(v, side)
        const at = (px: number) => line.at + line.out * sizePx(sc, px)
        return (
          <g key={side}>
            {near.length > 2 && <Chain sc={sc} axis={line.axis} at={at(DIM_NEAR)} ts={near} dir={line.out} />}
            <Chain sc={sc} axis={line.axis} at={at(DIM_TOTAL)} ts={total} dir={line.out} />
          </g>
        )
      })}
      {dims.inner && <Inner sc={sc} c={dims.inner} />}
    </g>
  )
}

function Inner({ sc, c }: { sc: PlanScale; c: InnerChain }) {
  const half = (c.clear === 'wall' ? wallWidth(sc) : textileWidth(sc)) / 2
  return <Chain sc={sc} axis={c.axis} at={c.at + c.dir * (half + sizePx(sc, DIM_NEAR))} ts={c.ts} dir={c.dir} />
}

/**
 * One chain along `axis` at the fixed coordinate `at`, through the positions `ts`. Numbers stand on the `dir` side of
 * the line; a number that does not fit between its marks is left out.
 */
function Chain({ sc, axis, at, ts, dir }: { sc: PlanScale; axis: 'x' | 'y'; at: number; ts: number[]; dir: 1 | -1 }) {
  if (ts.length < 2) return null
  const P = (t: number, o = 0): [number, number] => (axis === 'x' ? [t, at + o] : [at + o, t])
  const k = sizePx(sc, 2.5)
  const wit = sizePx(sc, 3.5)
  const gap = sizePx(sc, 3)
  const fs = sizePx(sc, DIM_FONT)
  const a = P(ts[0])
  const b = P(ts[ts.length - 1])
  return (
    <g stroke={INK_MUTED} fill="none">
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={linePx(sc, 0.6)} />
      {ts.map((t) => {
        const [x, y] = P(t)
        const [w0, w1] = [P(t, -wit), P(t, wit)]
        return (
          <g key={t}>
            <line x1={w0[0]} y1={w0[1]} x2={w1[0]} y2={w1[1]} strokeWidth={linePx(sc, 0.6)} />
            <line x1={x - k} y1={y + k} x2={x + k} y2={y - k} strokeWidth={linePx(sc, 1.4)} />
          </g>
        )
      })}
      {ts.slice(1).map((t, i) => {
        const len = t - ts[i]
        const text = mm(len)
        // Fits: the number and a little air between the marks
        if (len < sizePx(sc, text.length * DIM_FONT * 0.62 + 8)) return null
        const mid = (t + ts[i]) / 2
        // Baseline: just off the line on the dir side, glyphs growing away from it
        const off = dir < 0 ? -gap : gap + fs * 0.78
        const [x, y] = P(mid, off)
        return (
          <text
            key={`n${t}`}
            x={x}
            y={y}
            transform={axis === 'y' ? `rotate(-90 ${x} ${y})` : undefined}
            textAnchor="middle"
            stroke="none"
            style={{ font: `500 ${fs}px var(--font-numeric)`, fill: INK_MUTED }}
          >
            {text}
          </text>
        )
      })}
    </g>
  )
}
