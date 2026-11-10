// The frame in the plan: takdragere, posts and the foot plates under walls that stand free.
import { RECIPES } from '../../../foga/recipes'
import type { CalcResult } from '../../../calc/calc'
import { beamOffsets } from '../../../calc/beamOffsets'
import { mm } from '../dims'
import { MeasurePill } from './Previews'
import type { InnerBeam, Point, Variant } from '../../../domain/types'
import { INK, INK_MUTED, SURFACE } from '../../colors'
import { linePx, usePlanScale } from '../planScale'
import { BEAM_FILL, beamBody, beamDash, footDash, footStroke, HALO_OPACITY, haloWidth, postSize } from '../planStyle'
import { rules } from '../../env'
import type { Point as P } from '../../../domain/types'
import type { Layer } from '../../tools'
import type { PlanSelection } from '../selection'
import { Seg } from './Seg'
import { GONE, useErasing } from './erasing'

/**
 * Takdragere dashed as on hall maps (in full detail a light body with two dashed edges, compact one dashed line), the
 * same for standard, støttedrager and drawn ones; støtteplater under free walls; and posts.
 */
export function BeamLayer({ v, res, selection, dim, measured }: { v: Variant; res: CalcResult; selection: PlanSelection; dim: (...layers: Layer[]) => number; measured?: string }) {
  const { gone, hatch } = useErasing()
  const goneBeam = (v.innerBeams ?? []).find((b) => gone('beam', b.id))
  const sc = usePlanScale()
  const ps = postSize(sc)
  const body = beamBody(sc, rules.beam.thickness)
  return (
    <g pointerEvents="none">
      <g opacity={dim('beams')}>
        {(v.innerBeams ?? []).filter((b) => b.id === selection.beamId).map((b) => (
          <Seg key={b.id} a={b.from} b={b.to} stroke={INK} strokeOpacity={HALO_OPACITY} strokeWidth={haloWidth(sc, body)} />
        ))}
        {res.beams.segments.map((s, i) => (
          <g key={i} opacity={s.inner && goneBeam && along(goneBeam, s) ? GONE : undefined}>
            <BeamStroke a={s.from} b={s.to} body={body} />
          </g>
        ))}
        {goneBeam && <Seg a={goneBeam.from} b={goneBeam.to} stroke={hatch} strokeWidth={haloWidth(sc, body)} />}
      </g>
      {measured && <OffsetMeasures v={v} res={res} id={measured} />}
      <g opacity={dim('walls', 'beams')}>
        {/* Støtteplater under walls that stand free, across the wall */}
        {res.wallSupports.map(({ at: [x, y], orientation }) => {
          const { along, across } = RECIPES.wall.support.foot
          const w = (orientation === 'h' ? along : across) / 1000
          const d = (orientation === 'h' ? across : along) / 1000
          return <rect key={`f${x},${y}`} x={x - w / 2} y={y - d / 2} width={w} height={d} fill="none" stroke={INK_MUTED} strokeWidth={footStroke(sc)} strokeDasharray={footDash(sc)} />
        })}
        {/* Posts: white squares with an ink edge, over the wall ends */}
        {res.posts.map((q) => (
          <rect key={`${q[0]},${q[1]}`} x={q[0] - ps / 2} y={q[1] - ps / 2} width={ps} height={ps} fill={SURFACE} stroke={INK} strokeWidth={linePx(sc, 1)} />
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

/** One takdrager segment: compact one dashed ink line, full detail a body with two dashed edges. */
export function BeamStroke({ a, b, body }: { a: P; b: P; body: number }) {
  const sc = usePlanScale()
  const dash = beamDash(sc)
  if (sc.detail === 'compact') return <Seg a={a} b={b} stroke={INK} strokeWidth={linePx(sc, 1)} strokeDasharray={dash} />
  const hz = Math.abs(a[1] - b[1]) < 1e-6
  const [ox, oy] = hz ? [0, body / 2] : [body / 2, 0]
  const edge = linePx(sc, 0.8)
  return (
    <g>
      <Seg a={a} b={b} stroke={SURFACE} strokeWidth={body} />
      <Seg a={a} b={b} stroke={INK} strokeOpacity={BEAM_FILL} strokeWidth={body} />
      <Seg a={[a[0] - ox, a[1] - oy]} b={[b[0] - ox, b[1] - oy]} stroke={INK} strokeWidth={edge} strokeDasharray={dash} />
      <Seg a={[a[0] + ox, a[1] + oy]} b={[b[0] + ox, b[1] + oy]} stroke={INK} strokeWidth={edge} strokeDasharray={dash} />
    </g>
  )
}

/** Byggeregel T15: from each end of a drawn beam off the grid, along the wall or beam it hangs on, to the nearest post or
 *  hook, while it is moved or selected (calc/beamOffsets.ts). */
function OffsetMeasures({ v, res, id }: { v: Variant; res: CalcResult; id: string }) {
  const sc = usePlanScale()
  const centre: Point = [v.stand.width / 2, v.stand.depth / 2]
  const tick = linePx(sc, 4)
  return (
    <g>
      {beamOffsets(v, res, id).map((o) => {
        const hz = Math.abs(o.from[1] - o.to[1]) < 1e-6
        const [tx, ty] = hz ? [0, tick] : [tick, 0]
        return (
          <g key={`${o.from}`}>
            <Seg a={o.from} b={o.to} stroke={INK} strokeWidth={linePx(sc, 1)} />
            {[o.from, o.to].map((p, i) => (
              <Seg key={i} a={[p[0] - tx, p[1] - ty]} b={[p[0] + tx, p[1] + ty]} stroke={INK} strokeWidth={linePx(sc, 1)} />
            ))}
            <MeasurePill a={o.from} b={o.to} centre={centre} stroke={tick} text={mm(o.length)} />
          </g>
        )
      })}
    </g>
  )
}
