// The grips of what is chosen, one look for all (plan/grips.ts), as in a CAD tool: a round grip on a side, a square one
// in a corner, a larger round one with four arrows in the middle that moves the whole thing, one with a round arrow out
// from the bottom right corner that turns it. Drawn by PreviewLayer; a
// drag of one is pointer/grip.ts.
import type { Point } from '../../../domain/types'
import { INK, SURFACE } from '../../colors'
import type { PlanGrip } from '../grips'
import { sizePx, usePlanScale } from '../planScale'
import { useLift } from './LiftFilter'

/** `hot`: the grip under the pointer or pressed, filled with ink. Not drawn while a grip is dragged (PreviewLayer). */
export function Grips({ grips, hot }: { grips: PlanGrip[]; hot?: Point }) {
  const sc = usePlanScale()
  const lift = useLift(1.4)
  const r = sizePx(sc, GRIP.r)
  const isHot = (p: Point) => !!hot && Math.hypot(p[0] - hot[0], p[1] - hot[1]) < 1e-6
  return (
    <g>
      <defs>{lift.def}</defs>
      {grips.map(({ kind, at }) => {
        const on = isHot(at)
        const size = on ? r * GRIP.hot : r
        if (kind === 'move') {
          const m = size * GRIP.move
          const a = m * 0.55
          const h = m * 0.2
          // Four arrows out from the middle
          const arrows = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
            .map(([x, y]) => `M${at[0]},${at[1]} L${at[0] + x * a},${at[1] + y * a} M${at[0] + x * a - y * h - x * h},${at[1] + y * a + x * h - y * h} L${at[0] + x * a},${at[1] + y * a} L${at[0] + x * a + y * h - x * h},${at[1] + y * a - x * h - y * h}`)
            .join(' ')
          return (
            <g key={`${at}`}>
              <circle cx={at[0]} cy={at[1]} r={m} fill={on ? INK : SURFACE} filter={lift.url} />
              <path d={arrows} fill="none" stroke={on ? SURFACE : INK} strokeWidth={m * 0.14} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )
        }
        if (kind === 'rotate') {
          // A round arrow, three quarters round, with its head at the end pointing on round
          const a = size * 0.6
          const [x, y] = at
          const end: Point = [x + a, y]
          const h = size * 0.38
          const d = `M${x},${y - a} A${a},${a} 0 1,0 ${end[0]},${end[1]} M${end[0] - h},${end[1] + h} L${end[0]},${end[1]} L${end[0] + h},${end[1] + h}`
          return (
            <g key={`${at}`}>
              <circle cx={x} cy={y} r={size * GRIP.rotate} fill={on ? INK : SURFACE} filter={lift.url} />
              <path d={d} fill="none" stroke={on ? SURFACE : INK} strokeWidth={size * 0.22} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )
        }
        return kind === 'corner' ? (
          <rect key={`${at}`} x={at[0] - size} y={at[1] - size} width={2 * size} height={2 * size} rx={size * 0.35} fill={on ? INK : SURFACE} filter={lift.url} />
        ) : (
          <circle key={`${at}`} cx={at[0]} cy={at[1]} r={size} fill={on ? INK : SURFACE} filter={lift.url} />
        )
      })}
    </g>
  )
}

/** Sizes in screen px: grip radius (12 px across, the hit is wider, pointer/hits.ts), grown when hot. */
const GRIP = { r: 6, hot: 1.25, move: 1.6, rotate: 1.35 } as const
