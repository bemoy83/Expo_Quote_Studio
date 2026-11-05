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
import { headerCore, headerWidth, wallCore, wallWidth } from '../planStyle'
import { linePx, usePlanScale } from '../planScale'
import { Seg } from './Seg'
import { GONE, useErasing } from './erasing'

/**
 * Walls and openings. A wall is an ink line with its plate's RAL in the core, so a white and a blue wall differ without
 * a note; a selected wall gets a soft ink halo.
 */
export function WallLayer({ v, mods, selection, dim }: { v: Variant; mods: BuiltModule[]; selection: PlanSelection; dim: (...layers: Layer[]) => number }) {
  const { gone, hatch } = useErasing()
  const sc = usePlanScale()
  const ww = wallWidth(sc)
  /** A wall module about to be erased, on its own or with its room. */
  const goneWall = (m: BuiltModule) => {
    const room = v.walls.find((w) => w.id === m.wallId)?.room
    return gone('wall', m.key) || (!!room && gone('room', room.id))
  }
  return (
    <>
      <g opacity={dim('walls')} pointerEvents="none">
        {mods.filter((m) => !m.opening).map((m) => {
          const sel = selection.wallId === m.wallId
          const g = goneWall(m)
          return (
            <g key={m.key} opacity={g ? GONE : undefined}>
              {sel && <Seg a={m.a} b={m.b} stroke={INK} strokeOpacity={0.22} strokeWidth={ww + linePx(sc, 8)} />}
              <Seg a={m.a} b={m.b} stroke={INK} strokeWidth={ww} />
              <Seg a={m.a} b={m.b} stroke={plateColor(m.plate)} strokeWidth={wallCore(sc)} />
            </g>
          )
        })}
        {mods.filter((m) => !m.opening && goneWall(m)).map((m) => <Seg key={m.key} a={m.a} b={m.b} stroke={hatch} strokeWidth={ww} />)}
      </g>

      {/* Openings */}
      <g opacity={dim('openings')} pointerEvents="none">
        {mods.filter((m) => m.opening).map((m) => {
          const g = gone('door', m.opening!.id) || goneWall(m)
          return (
            <g key={m.key}>
              <g opacity={g ? GONE : undefined}>
                <OpeningMark v={v} m={m} selected={selection.wallId === m.wallId || selection.openingId === m.opening!.id} />
              </g>
              {g && <Seg a={m.a} b={m.b} stroke={hatch} strokeWidth={ww} />}
            </g>
          )
        })}
      </g>
    </>
  )
}

export function OpeningMark({ v, m, selected }: { v: Variant; m: BuiltModule; selected: boolean }) {
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
  const sc = usePlanScale()
  return (
    <g>
      {selected && <Seg a={a} b={b} stroke={INK} strokeOpacity={0.22} strokeWidth={wallWidth(sc) + linePx(sc, 8)} />}
      {/* Header panel over the opening: a thin line in its plate's RAL */}
      <Seg a={a} b={b} stroke={INK} strokeWidth={headerWidth(sc)} />
      <Seg a={a} b={b} stroke={plateColor(m.plate)} strokeWidth={headerCore(sc)} />
      {door ? (
        <g fill="none" stroke={INK}>
          <line x1={h[0]} y1={h[1]} x2={h[0] + n[0] * r} y2={h[1] + n[1] * r} strokeWidth={linePx(sc, 1.4)} />
          <path
            d={`M${h[0] + ex * r} ${h[1] + ey * r} A${r} ${r} 0 0 ${cw ? 1 : 0} ${h[0] + n[0] * r} ${h[1] + n[1] * r}`}
            strokeWidth={linePx(sc, 0.6)}
            strokeDasharray={`${linePx(sc, 3)} ${linePx(sc, 3)}`}
          />
        </g>
      ) : (
        <path d={curtainPath(a, b, n)} fill="none" stroke={INK} strokeWidth={linePx(sc, 1.2)} strokeLinejoin="round" />
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
