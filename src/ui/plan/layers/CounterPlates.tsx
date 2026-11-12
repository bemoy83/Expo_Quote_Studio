// A counter seen from above (Byggeregel K4): a line along each closed side where its plates stand, the open sides
// without, and a thin dividing line across it where two sections meet, over the rail between them (K8, Bjørn 12.11.2026). In the counter's own coordinates, placed and turned like the object it is (front toward +y unturned).
import type { CounterBuild } from '../../../foga/counter'
import { RECIPES } from '../../../foga/recipes'
import { INK } from '../../colors'

export function CounterPlates({ b, at, width, divide, opacity }: { b: CounterBuild; at: { x: number; y: number; rot: number }; width: number; divide: number; opacity?: number }) {
  const mid = (r: readonly [number, number]) => (r[0] + r[1]) / 2000
  // The rails inside the counter (no closed face), once: the top ones, drawn on through the nodes to the outer faces
  const reach = RECIPES.counter.joint + RECIPES.counter.face
  const top = Math.max(...b.profiles.map((p) => p.box.y[1]))
  const inner = b.profiles.filter((p) => p.role === 'rail' && p.out[0] === 0 && p.out[1] === 0 && p.box.y[1] === top)
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(${at.rot})`} opacity={opacity} pointerEvents="none">
      {b.plates
        .filter((p) => p.level === 'lower')
        .map((p, i) => {
          const along = p.out[1] !== 0
          const [x0, x1] = along ? [p.box.x[0] / 1000, p.box.x[1] / 1000] : [mid(p.box.x), mid(p.box.x)]
          const [y0, y1] = along ? [mid(p.box.z), mid(p.box.z)] : [p.box.z[0] / 1000, p.box.z[1] / 1000]
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={INK} strokeWidth={width} strokeLinecap="round" />
        })}
      {inner.map((p, i) => {
        const [x0, x1] = p.axis === 'x' ? [(p.box.x[0] - reach) / 1000, (p.box.x[1] + reach) / 1000] : [mid(p.box.x), mid(p.box.x)]
        const [y0, y1] = p.axis === 'x' ? [mid(p.box.z), mid(p.box.z)] : [(p.box.z[0] - reach) / 1000, (p.box.z[1] + reach) / 1000]
        return <line key={`d${i}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={INK} strokeWidth={divide} />
      })}
    </g>
  )
}
