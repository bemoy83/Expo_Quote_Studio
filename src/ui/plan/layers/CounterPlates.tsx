// A counter seen from above (Byggeregel K4): a line along each closed side where its plates stand, the open side
// without. In the counter's own coordinates, placed and turned like the object it is (front toward +y unturned).
import type { CounterBuild } from '../../../foga/counter'
import { INK } from '../../colors'

export function CounterPlates({ b, at, width, opacity }: { b: CounterBuild; at: { x: number; y: number; rot: number }; width: number; opacity?: number }) {
  const mid = (r: readonly [number, number]) => (r[0] + r[1]) / 2000
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(${at.rot})`} opacity={opacity} pointerEvents="none">
      {b.plates
        .filter((p) => p.level === 'lower')
        .map((p) => {
          const along = p.side === 'front' || p.side === 'back'
          const [x0, x1] = along ? [p.box.x[0] / 1000, p.box.x[1] / 1000] : [mid(p.box.x), mid(p.box.x)]
          const [y0, y1] = along ? [mid(p.box.z), mid(p.box.z)] : [p.box.z[0] / 1000, p.box.z[1] / 1000]
          return <line key={p.side} x1={x0} y1={y0} x2={x1} y2={y1} stroke={INK} strokeWidth={width} strokeLinecap="round" />
        })}
    </g>
  )
}
