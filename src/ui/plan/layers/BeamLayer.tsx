// The frame in the plan: takdragere, posts and the foot plates under walls that stand free.
import { RECIPES } from '../../../foga/recipes'
import type { CalcResult } from '../../../calc/calc'
import type { InnerBeam, Point, Variant } from '../../../domain/types'
import { INK, INK_MUTED } from '../../colors'
import type { Layer } from '../../tools'
import type { PlanSelection } from '../selection'
import { Seg } from './Seg'
import { GONE, useErasing } from './erasing'

/** Takdragere (dashed, a drawn one darker), støtteplater under free walls, and posts. */
export function BeamLayer({ v, res, selection, dim }: { v: Variant; res: CalcResult; selection: PlanSelection; dim: (...layers: Layer[]) => number }) {
  const { gone, hatch } = useErasing()
  const goneBeam = (v.innerBeams ?? []).find((b) => gone('beam', b.id))
  return (
    <g pointerEvents="none">
      <g opacity={dim('beams')}>
        {(v.innerBeams ?? []).filter((b) => b.id === selection.beamId).map((b) => (
          <Seg key={b.id} a={b.from} b={b.to} stroke={INK} strokeWidth={0.12} strokeOpacity={0.35} />
        ))}
        {res.beams.segments.map((s, i) => (
          <Seg key={i} a={s.from} b={s.to} stroke={s.inner ? INK : INK_MUTED} strokeWidth={0.05} strokeDasharray=".16 .08" opacity={s.inner && goneBeam && along(goneBeam, s) ? GONE : undefined} />
        ))}
        {goneBeam && <Seg a={goneBeam.from} b={goneBeam.to} stroke={hatch} strokeWidth={0.12} />}
      </g>
      <g opacity={dim('walls', 'beams')}>
        {/* Støtteplater under walls that stand free, across the wall */}
        {res.wallSupports.map(({ at: [x, y], orientation }) => {
          const { along, across } = RECIPES.wall.support.foot
          const w = (orientation === 'h' ? along : across) / 1000
          const d = (orientation === 'h' ? across : along) / 1000
          return <rect key={`f${x},${y}`} x={x - w / 2} y={y - d / 2} width={w} height={d} fill="none" stroke={INK_MUTED} strokeWidth={0.015} strokeDasharray=".04 .03" />
        })}
        {res.posts.map((q) => (
          <rect key={`${q[0]},${q[1]}`} x={q[0] - 0.04} y={q[1] - 0.04} width={0.08} height={0.08} fill={INK} />
        ))}
      </g>
    </g>
  )
}

/** A beam segment lying on the drawn takdrager. */
function along(b: InnerBeam, s: { from: Point; to: Point }) {
  const on = (p: Point) =>
    b.from[0] === b.to[0]
      ? p[0] === b.from[0] && p[1] >= Math.min(b.from[1], b.to[1]) && p[1] <= Math.max(b.from[1], b.to[1])
      : p[1] === b.from[1] && p[0] >= Math.min(b.from[0], b.to[0]) && p[0] <= Math.max(b.from[0], b.to[0])
  return on(s.from) && on(s.to)
}
