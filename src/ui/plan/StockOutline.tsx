// A standard counter on the quick picks (Bjørn 14.11.2026): its sections seen from above with the lines between them, at
// one scale for all, so a podie is drawn smaller than a disk. Never its art.nr.
import { bounds } from '../../domain/podiumSections'
import type { CounterSection } from '../../domain/types'
import { RECIPES } from '../../foga/recipes'

const F = RECIPES.counter.face
/** px per mm: Bardisk's 1 020 mm fill 22 px. */
const K = 22 / 1020

export function StockOutline({ sections }: { sections: readonly CounterSection[] }) {
  const b = bounds(sections)
  const w = (b.x[1] - b.x[0] + 2 * F) * K
  const h = (b.z[1] - b.z[0] + 2 * F) * K
  const X = (mm: number) => (mm - b.x[0] + F) * K
  const Y = (mm: number) => (b.z[1] + F - mm) * K
  return (
    <svg width={w + 1} height={h + 1} viewBox={`-0.5 -0.5 ${w + 1} ${h + 1}`} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.2">
      {sections.map((s, i) => (
        <rect key={i} x={X(s.x[0] - F)} y={Y(s.z[1] + F)} width={(s.x[1] - s.x[0] + 2 * F) * K} height={(s.z[1] - s.z[0] + 2 * F) * K} rx=".8" />
      ))}
    </svg>
  )
}
