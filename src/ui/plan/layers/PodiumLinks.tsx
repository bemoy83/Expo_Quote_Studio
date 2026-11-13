// The links of the chosen counter of Disker og podier (Byggeregel K15): a link in the middle of each joint (a click
// parts the counter there), a broken link where a counter stands against it (a click links the two). Drawn by
// PreviewLayer in Velg and with the pen, beside the grips (PodiumGrips.tsx); a click is pointer/podiumLink.ts.
import { useId } from 'react'
import { Link2, Unlink2 } from 'lucide-react'
import { podiumLinks } from '../../../domain/podiumLinks'
import type { PlacedObject, Point, Variant } from '../../../domain/types'
import { INK, SURFACE } from '../../colors'
import { sizePx, usePlanScale } from '../planScale'

/** `hot`: the link under the pointer, filled with ink. */
export function PodiumLinks({ v, o, hot }: { v: Variant; o: PlacedObject; hot?: Point }) {
  const sc = usePlanScale()
  const lift = `lift${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const r = sizePx(sc, LINK.r)
  const icon = sizePx(sc, LINK.icon)
  return (
    <g>
      <defs>
        <filter id={lift} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx={0} dy={sizePx(sc, LINK.shadow.dy)} stdDeviation={sizePx(sc, LINK.shadow.blur)} floodColor="#000" floodOpacity={LINK.shadow.opacity} />
        </filter>
      </defs>
      {podiumLinks(v, o).map((l) => {
        const on = !!hot && Math.hypot(l.at[0] - hot[0], l.at[1] - hot[1]) < 1e-6
        const Icon = l.kind === 'joint' ? Link2 : Unlink2
        return (
          <g key={`${l.kind}${l.at}`}>
            <circle cx={l.at[0]} cy={l.at[1]} r={r} fill={on ? INK : SURFACE} filter={`url(#${lift})`} />
            <Icon x={l.at[0] - icon / 2} y={l.at[1] - icon / 2} width={icon} height={icon} color={on ? SURFACE : INK} strokeWidth={2.25} />
          </g>
        )
      })}
    </g>
  )
}

/** Sizes in screen px: the button's radius (22 px across), the icon, the lift. */
const LINK = { r: 11, icon: 14, shadow: { dy: 1, blur: 1.6, opacity: 0.35 } } as const
