// The end of a drawn counter under the Disker pen, as a handle (Byggeregler K7, K8): drawn by PreviewLayer from what
// plan/next.ts finds at the pointer.
import type { Point } from '../../../domain/types'
import { INK, SURFACE } from '../../colors'
import type { CounterHandleView } from '../next'
import { sizePx, usePlanScale } from '../planScale'
import { useLift } from './LiftFilter'

/** The handle (Bjørn 12.11.2026): the end's last half metre toned, and a round button for each way a drag from it can
 *  go, a filled triangle pointing that way: longer just past the end face, shorter on the box's inner edge, a corner
 *  past the back. A way that cannot go (a wall, the corner an L stands on) has no button. No dashes: in the plan they
 *  mean the aisle and the beams. */
export function CounterHandle({ h }: { h: CounterHandleView }) {
  const sc = usePlanScale()
  const lift = useLift()
  const { end, ok } = h
  const b = end.box
  const c: Point = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]
  /** From the middle to the box's edge, going d. */
  const reach = (d: Point) => (Math.abs(d[0]) * (b.x1 - b.x0) + Math.abs(d[1]) * (b.y1 - b.y0)) / 2
  const r = sizePx(sc, HANDLE.r)
  const past = (d: Point) => reach(d) + sizePx(sc, HANDLE.gap) + r
  const buttons: { d: Point; at: number }[] = [
    ...end.out.flatMap((d, i) => (ok.out[i] ? [{ d, at: past(d) }] : [])),
    ...(end.in && ok.in ? [{ d: end.in, at: reach(end.in) }] : []),
    ...(ok.back ? [{ d: end.back, at: past(end.back) }] : []),
  ]
  return (
    <g>
      <defs>
        {/* The lift of a small control, in screen px like the rest of the plan's marks */}
        {lift.def}
      </defs>
      <rect x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} fill={INK} fillOpacity={HANDLE.tone} />
      {buttons.map(({ d, at }) => {
        const m: Point = [c[0] + d[0] * at, c[1] + d[1] * at]
        const side: Point = [-d[1], d[0]]
        const pt = (along: number, across: number) => `${m[0] + d[0] * r * along + side[0] * r * across},${m[1] + d[1] * r * along + side[1] * r * across}`
        return (
          <g key={`${d}`}>
            <circle cx={m[0]} cy={m[1]} r={r} fill={SURFACE} filter={lift.url} />
            <polygon points={`${pt(0.45, 0)} ${pt(-0.3, 0.42)} ${pt(-0.3, -0.42)}`} fill={INK} />
          </g>
        )
      })}
    </g>
  )
}

/** Sizes in screen px: button radius (22 px across), gap past the box, the end's tone. */
const HANDLE = { r: 11, gap: 4, tone: 0.08 } as const
