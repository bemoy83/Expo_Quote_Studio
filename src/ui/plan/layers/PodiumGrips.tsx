// The grips of the chosen counter of Disker og podier (Byggeregel K14), as in a CAD tool: one in the middle of each
// straight side, one in each corner of the box round it. Drawn by PreviewLayer in Velg and with the pen; a drag of one
// is pointer/podiumGrip.ts.
import { useId } from 'react'
import { podiumGrips } from '../../../domain/podiumGrips'
import { podiumLinks } from '../../../domain/podiumLinks'
import type { PlacedObject, Point, Variant } from '../../../domain/types'
import { INK, SURFACE } from '../../colors'
import { sizePx, usePlanScale } from '../planScale'
import { GRIP_HIT_PX } from '../pointer/hits'

/** `hot`: the grip under the pointer or pressed, filled with ink. Not drawn while a grip is dragged (PreviewLayer), nor
 *  where a link stands (K15: the link comes first, hits.ts). */
export function PodiumGrips({ v, o, hot }: { v: Variant; o: PlacedObject; hot?: Point }) {
  const sc = usePlanScale()
  const lift = `lift${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const r = sizePx(sc, GRIP.r)
  const isHot = (p: Point) => !!hot && Math.hypot(p[0] - hot[0], p[1] - hot[1]) < 1e-6
  const links = podiumLinks(v, o)
  const reach = sizePx(sc, GRIP_HIT_PX)
  const grips = podiumGrips(o).filter((g) => !links.some((l) => Math.hypot(l.at[0] - g.at[0], l.at[1] - g.at[1]) < reach))
  return (
    <g>
      <defs>
        <filter id={lift} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx={0} dy={sizePx(sc, GRIP.shadow.dy)} stdDeviation={sizePx(sc, GRIP.shadow.blur)} floodColor="#000" floodOpacity={GRIP.shadow.opacity} />
        </filter>
      </defs>
      {grips.map(({ grip, at }) => {
        const on = isHot(at)
        const size = on ? r * GRIP.hot : r
        return grip.kind === 'corner' ? (
          <rect key={`${at}`} x={at[0] - size} y={at[1] - size} width={2 * size} height={2 * size} rx={size * 0.35} fill={on ? INK : SURFACE} filter={`url(#${lift})`} />
        ) : (
          <circle key={`${at}`} cx={at[0]} cy={at[1]} r={size} fill={on ? INK : SURFACE} filter={`url(#${lift})`} />
        )
      })}
    </g>
  )
}

/** Sizes in screen px: grip radius (12 px across, the hit is wider, hits.ts), grown when hot, and its lift. */
const GRIP = { r: 6, hot: 1.25, shadow: { dy: 1, blur: 1.4, opacity: 0.35 } } as const
