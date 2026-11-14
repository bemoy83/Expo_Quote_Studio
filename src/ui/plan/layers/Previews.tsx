// The shared parts of the preview while drawing (docs/forhandsvisning.md): the invalid hatch, the measure pill, Tøm's
// stroke with its rings, the dashed outline of the chosen engangsteppe lanes, and the snap dots. What the pen would
// store is not drawn here: PlanView draws the next variant through the plan's own layers, dimmed (next.ts, nextArea.ts).
import { useId, type SVGProps } from 'react'
import type { Point, Wall } from '../../../domain/types'
import { CANVAS, INK, INK_FAINT, SURFACE } from '../../colors'
import { type FaceSide } from '../../../domain/faces'
import { AIM, aimDash, HATCH, INVALID, PILL, RING, SNAP_DOT, wallWidth } from '../planStyle'
import { linePx, sizePx, usePlanScale } from '../planScale'
import { mm } from '../dims'
import { pillCentre, pillWidth } from '../pill/pillPlace'
import { Seg } from './Seg'

/** A wall face under the pointer: wall, face, offset along the wall and module index. */
export interface FaceHit {
  w: Wall
  s: FaceSide
  t: number
  module: number
}

/** The run Tøm sweeps over along walls or takdragere. `centre` is the stand's middle: the pill goes on the side away
 * from it. Wall and takdrager strokes show the next variant instead (next.ts). */
export function EraseStroke({ a, b, centre }: { a: Point; b: Point; centre: Point }) {
  const L = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])
  const sc = usePlanScale()
  const w = wallWidth(sc)
  return (
    <g>
      <Seg a={a} b={b} stroke={INK_FAINT} strokeWidth={w} strokeLinecap="square" strokeDasharray=".12 .08" />
      <Ring at={a} />
      <Ring at={b} />
      {L > 0 && <MeasurePill a={a} b={b} centre={centre} stroke={w} text={mm(L)} />}
    </g>
  )
}

/** True on a whole metre, give or take float noise from stepping in 0.25 m. */
const onMetre = (t: number) => Number.isInteger(Math.round(t * 1000) / 1000)

/** The points a wall or textile brush snaps to; whole metres are drawn a little larger. Sized in screen pixels. */
export function SnapDots({ W, D, step }: { W: number; D: number; step: number }) {
  const sc = usePlanScale()
  const big = sizePx(sc, SNAP_DOT.metre)
  const small = sizePx(sc, SNAP_DOT.other)
  const nx = Math.round(W / step)
  const ny = Math.round(D / step)
  return Array.from({ length: (nx + 1) * (ny + 1) }, (_, n) => {
    const x = (n % (nx + 1)) * step
    const y = Math.floor(n / (nx + 1)) * step
    return <circle key={n} cx={x} cy={y} r={onMetre(x) && onMetre(y) ? big : small} fill={SNAP_DOT.fill} />
  })
}

/** A ring at an end point or snap point: surface fill, ink edge. */
export function Ring({ at }: { at: Point }) {
  const sc = usePlanScale()
  return <circle cx={at[0]} cy={at[1]} r={sizePx(sc, RING.r)} fill={SURFACE} stroke={INK} strokeWidth={linePx(sc, RING.edge)} />
}

/** A dashed ink outline around an area (the chosen engangsteppe lanes). `halo` lays a light edge under it, for a dark floor. */
export function AimRect({ x, y, width, height, halo }: { x: number; y: number; width: number; height: number; halo?: boolean }) {
  const sc = usePlanScale()
  const r = { x, y, width, height, fill: 'none' }
  return (
    <g>
      {halo && <rect {...r} stroke={SURFACE} strokeOpacity={AIM.haloOpacity} strokeWidth={linePx(sc, AIM.halo)} />}
      <rect {...r} stroke={INK} strokeWidth={linePx(sc, AIM.width)} strokeDasharray={aimDash(sc)} />
    </g>
  )
}

/** The plan's 45° hatch (HATCH), in screen pixels so it reads the same at every zoom: an invalid target and Tøm share it.
 * Each use has its own pattern id, so several plans on the page never share one. */
export function HatchPattern({ id }: { id: string }) {
  const sc = usePlanScale()
  const d = sizePx(sc, HATCH.spacing)
  return (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width={d} height={d} patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={d} stroke={HATCH.line} strokeWidth={linePx(sc, HATCH.lineWidth)} />
      </pattern>
    </defs>
  )
}

const usePatternId = () => `invalid${useId().replace(/:/g, '')}`

/** An invalid line target: grey in the symbol's width `width` (m), hatched. */
export function InvalidSeg({ a, b, width }: { a: Point; b: Point; width: number }) {
  const id = usePatternId()
  return (
    <g>
      <HatchPattern id={id} />
      <Seg a={a} b={b} stroke={INVALID.fill} strokeWidth={width} />
      <Seg a={a} b={b} stroke={`url(#${id})`} strokeWidth={width} />
    </g>
  )
}

/** An invalid area or footprint: grey, hatched. Pass `circle` for a round footprint. */
export function InvalidShape(p: ({ kind: 'rect' } & SVGProps<SVGRectElement>) | ({ kind: 'circle' } & SVGProps<SVGCircleElement>)) {
  const id = usePatternId()
  const { kind, ...shape } = p
  const draw = (fill: string) =>
    kind === 'rect' ? <rect {...(shape as SVGProps<SVGRectElement>)} fill={fill} /> : <circle {...(shape as SVGProps<SVGCircleElement>)} fill={fill} />
  return (
    <g>
      <HatchPattern id={id} />
      {draw(INVALID.fill)}
      {draw(`url(#${id})`)}
    </g>
  )
}

/**
 * The dark pill with the length being dragged out, in millimetres, beside a stroke `stroke` m wide, on the side away
 * from `centre`. Deliberately unlike the dimension chains: a length being dragged is not a finished measure.
 */
export function MeasurePill({ a, b, centre, stroke, text }: { a: Point; b: Point; centre: Point; stroke: number; text: string }) {
  const sc = usePlanScale()
  return <PillAt at={pillCentre(sc, a, b, centre, stroke, text)} text={text} />
}

/** The measure pill centred on a point (e.g. the count in the middle of a floor area). */
export function PillAt({ at, text }: { at: Point; text: string }) {
  const sc = usePlanScale()
  const w = pillWidth(sc, text)
  const h = sizePx(sc, PILL.height)
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={sizePx(sc, PILL.radius)} fill={INK} />
      <text y={sizePx(sc, PILL.font * 0.35)} textAnchor="middle" style={{ font: `600 ${sizePx(sc, PILL.font)}px var(--font-numeric)`, fill: CANVAS }}>
        {text}
      </text>
    </g>
  )
}
