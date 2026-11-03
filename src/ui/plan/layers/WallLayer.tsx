// Walls and doors in the plan.
import { pointAlong, wallDirection } from '../../../domain/grid'
import type { Point, Variant } from '../../../domain/types'
import { doorHinge, doorSwing } from '../../../domain/doors'
import type { BuiltModule } from '../../../domain/walls'
import { INK } from '../../colors'
import { plateColor, productOf, rules } from '../../env'
import { doorInset } from '../../../rules/rules'
import type { Layer } from '../../tools'
import type { PlanSelection } from '../selection'
import { PLAN_WALL, WALL } from '../planStyle'
import { Seg } from './Seg'

/** Walls (a selected wall outlined, a plate in its own colour inside the line) and openings. */
export function WallLayer({ v, mods, selection, dim }: { v: Variant; mods: BuiltModule[]; selection: PlanSelection; dim: (...layers: Layer[]) => number }) {
  return (
    <>
      <g opacity={dim('walls')} pointerEvents="none">
        {mods.filter((m) => !m.opening).map((m) => {
          const sel = selection.wallId === m.wallId
          return (
            <g key={m.key}>
              {sel && <Seg a={m.a} b={m.b} stroke={INK} strokeWidth={PLAN_WALL + 0.08} />}
              <Seg a={m.a} b={m.b} stroke={WALL} strokeWidth={PLAN_WALL} />
              {m.plate !== v.defaultPlate && (
                <Seg a={m.a} b={m.b} stroke={plateColor(m.plate)} strokeWidth={0.05} />
              )}
            </g>
          )
        })}
      </g>

      {/* Openings */}
      <g opacity={dim('openings')} pointerEvents="none">
        {mods.filter((m) => m.opening).map((m) => <OpeningMark key={m.key} v={v} m={m} selected={selection.wallId === m.wallId || selection.openingId === m.opening!.id} />)}
      </g>
    </>
  )
}

function OpeningMark({ v, m, selected }: { v: Variant; m: BuiltModule; selected: boolean }) {
  const o = m.opening!
  const w = v.walls.find((x) => x.id === o.wallId)!
  const [dx, dy] = wallDirection(w)
  const s = doorSwing(v.stand, w, o)
  const n: Point = [-dy * s, dx * s]
  const a = pointAlong(w, o.module)
  const b = pointAlong(w, o.module + 1)
  const door = productOf(o.product)?.opening === 'door'
  const r = rules.door.swing
  // Hinge: the leaf is centred in the opening, not hung on the post centre; it hangs on either end of the module
  const k = doorInset(rules)
  const hg = doorHinge(w, o)
  const [ex, ey] = hg.dir
  const h: Point = [hg.a[0] + ex * k, hg.a[1] + ey * k]
  // The arc runs from the closed leaf (along the wall) to the open one (along n); its turn depends on both
  const cw = ex * n[1] - ey * n[0] > 0
  return (
    <g>
      {selected && <Seg a={a} b={b} stroke={INK} strokeOpacity={0.3} strokeWidth={PLAN_WALL + 0.08} />}
      {/* Header panel over the opening */}
      <Seg a={a} b={b} stroke={WALL} strokeOpacity={0.45} strokeWidth={0.05} />
      {door ? (
        <g fill="none" stroke={INK} strokeWidth={0.025}>
          <line x1={h[0]} y1={h[1]} x2={h[0] + n[0] * r} y2={h[1] + n[1] * r} />
          <path
            d={`M${h[0] + ex * r} ${h[1] + ey * r} A${r} ${r} 0 0 ${cw ? 1 : 0} ${h[0] + n[0] * r} ${h[1] + n[1] * r}`}
            strokeDasharray=".05 .05"
          />
        </g>
      ) : (
        <path d={curtainPath(a, b, n)} fill="none" stroke={INK} strokeWidth={0.025} />
      )}
    </g>
  )
}

/** A soft zigzag just inside the opening. */
function curtainPath(a: Point, b: Point, n: Point): string {
  const k = 8
  const pts: string[] = []
  for (let i = 0; i <= k; i++) {
    const t = i / k
    const off = (i % 2 ? 0.08 : 0.02)
    pts.push(`${a[0] + (b[0] - a[0]) * t + n[0] * off} ${a[1] + (b[1] - a[1]) * t + n[1] * off}`)
  }
  return `M${pts.join(' L')}`
}
