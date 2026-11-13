// The soft shadow under a round button on the plan (counter handle, grips and links of Disker og podier): no edge
// lines, a shadow only. Returns the filter's url and its <filter> to put in <defs>.
import { useId } from 'react'
import { sizePx, usePlanScale } from '../planScale'

const SHADOW = { dy: 1, opacity: 0.35 } as const

/** A drop shadow blurred `blur` px at screen scale. */
export function useLift(blur = 1.6) {
  const sc = usePlanScale()
  const id = `lift${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const def = (
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx={0} dy={sizePx(sc, SHADOW.dy)} stdDeviation={sizePx(sc, blur)} floodColor="#000" floodOpacity={SHADOW.opacity} />
    </filter>
  )
  return { url: `url(#${id})`, def }
}
