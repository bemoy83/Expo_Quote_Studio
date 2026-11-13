// The dividing lines of a counter in the plan (K8, Bjørn 12.11.2026): a thin line across it where two parts meet, over
// the rail between them. Its outline, closed and open sides, is ObjectLayer's CounterShape. In the counter's own
// coordinates, placed and turned like the object it is (front toward +y unturned).
import type { CounterBuild } from '../../../foga/counter'
import { RECIPES } from '../../../foga/recipes'
import { INK } from '../../colors'

export function CounterLines({ b, at, divide, opacity }: { b: CounterBuild; at: { x: number; y: number; rot: number }; divide: number; opacity?: number }) {
  const mid = (r: readonly [number, number]) => (r[0] + r[1]) / 2000
  // The rails inside the counter (no closed face), once each where they lie (6560 has one at the middle and one at the
  // top; between two heights of Disker og podier, K12, it is under the low top), drawn on through the nodes to the
  // outer faces
  const reach = RECIPES.counter.joint + RECIPES.counter.face
  const seen = new Set<string>()
  const inner = b.profiles.filter((p) => {
    if (p.role !== 'rail' || p.out[0] !== 0 || p.out[1] !== 0) return false
    const k = `${p.axis}:${p.box.x}:${p.box.z}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(${at.rot})`} opacity={opacity} pointerEvents="none">
      {inner.map((p, i) => {
        const [x0, x1] = p.axis === 'x' ? [(p.box.x[0] - reach) / 1000, (p.box.x[1] + reach) / 1000] : [mid(p.box.x), mid(p.box.x)]
        const [y0, y1] = p.axis === 'x' ? [mid(p.box.z), mid(p.box.z)] : [(p.box.z[0] - reach) / 1000, (p.box.z[1] + reach) / 1000]
        return <line key={`d${i}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={INK} strokeWidth={divide} />
      })}
    </g>
  )
}
