// Textile walls and foil decor in the plan: free-standing frames with their foot plates and corner posts, InFrame
// frames in front of their wall face, and a raster band on the face that carries a decal or print
// (docs/arbeidstegning.md: orange with cross dashes for textile, green with raster dots for print).
import { useId } from 'react'
import type { CalcResult } from '../../../calc/calc'
import { foilSpan } from '../../../domain/decor'
import { runNormal, type FaceKey } from '../../../domain/textile/free'
import { cornerEnds, same } from '../../../domain/textile/corners'
import { wallDirection } from '../../../domain/grid'
import { alongRun, cornerPosts } from '../../../calc/textile/free'
import type { Point, Variant } from '../../../domain/types'
import { INK, INK_MUTED, SURFACE } from '../../colors'
import { rules } from '../../env'
import type { Layer } from '../../tools'
import { faceSegment, sideOf } from '../../../domain/faces'
import type { PlanSelection } from '../selection'
import { linePx, sizePx, usePlanScale, type PlanScale } from '../planScale'
import {
  footDash,
  footStroke,
  HALO,
  HALO_OPACITY,
  haloWidth,
  postSize,
  printBand,
  printOffset,
  textileFill,
  textileOffset,
  textileWidth,
  TUSJ_PRINT,
  TUSJ_TEXTILE,
} from '../planStyle'
import { Seg } from './Seg'
import { WireMark } from './BeamLayer'
import { GONE, useErasing } from './erasing'
import { frameCorners, freeTextiles, mountedOn, wallTextiles } from '../../../domain/textile/mounts'

/** Frittstående tekstilvegger, textile walls on a wall face, and the print and decal bands. */
export function TextileLayer({ v, res, selection, dim }: { v: Variant; res: CalcResult; selection: PlanSelection; dim: (...layers: Layer[]) => number }) {
  // Tøm: a textile wall about to go is dimmed and hatched; a motif about to go only hatched, on its face
  const { gone, hatch } = useErasing()
  const sc = usePlanScale()
  const tw = textileWidth(sc)
  const raster = `raster${useId().replace(/:/g, '')}`
  // The ends of frames on walls: a 92LTX there is drawn with the frame, at the plan's offset from the wall
  const onWallEnds = new Set(v.textiles.filter((t) => mountedOn(v, t.id)).flatMap((t) => [`${t.from[0]},${t.from[1]}`, `${t.to[0]},${t.to[1]}`]))
  const frames = drawnFrames(v, res, sc)
  // A free-standing run's end in a 92LTX with a frame on a wall is drawn where that frame's stroke ends (X7)
  const drawnEnd = new Map(frames.flatMap((f) => f.joined))
  const toDrawn = (p: Point) => drawnEnd.get(`${p[0]},${p[1]}`) ?? p
  return (
    <>
      <defs>
        <RasterPattern id={raster} sc={sc} />
      </defs>

      {/* Frittstående tekstilvegger: foot plates under the frame, corner posts, the frame */}
      <g opacity={dim('textile')} pointerEvents="none">
        {res.production.free.map((f) => {
          const t = freeTextiles(v).find((x) => x.id === f.textileId)
          if (!t) return null
          const sel = selection.textileId === t.id
          const g = gone('textile', t.id)
          const motif = (['a', 'b'] as const).find((k) => gone('graphic', `${t.id}.${k}`))
          // The frame as it stands: an end up against a wall stops where the wall begins (Byggeregel F1)
          const a = toDrawn(alongRun(t, 0, f))
          const b = toDrawn(alongRun(t, f.length, f))
          return (
            <g key={t.id} opacity={g ? GONE : undefined}>
              {f.supports.map((at, i) => {
                const [x, y] = alongRun(t, at, f)
                const h = t.from[1] === t.to[1]
                const w = (h ? f.foot.along : f.foot.across) / 1000
                const d = (h ? f.foot.across : f.foot.along) / 1000
                return <rect key={i} x={x - w / 2} y={y - d / 2} width={w} height={d} fill="none" stroke={INK_MUTED} strokeWidth={footStroke(sc)} strokeDasharray={footDash(sc)} />
              })}
              {sel && <Seg a={a} b={b} stroke={HALO} strokeOpacity={HALO_OPACITY} strokeWidth={haloWidth(sc, tw)} />}
              <TextileStroke a={a} b={b} sc={sc} />
              {sel && selection.face && <FaceMark t={t} face={selection.face} sc={sc} />}
              {g && <Seg a={a} b={b} stroke={hatch} strokeWidth={tw} />}
              {motif && <FaceMark t={t} face={motif} stroke={hatch} width={linePx(sc, 4)} sc={sc} />}
            </g>
          )
        })}
        {/* A chosen corner between frames on walls (X7, M5): the soft halo, round the post or where it was */}
        {selection.corner && (
          <circle cx={selection.corner[0]} cy={selection.corner[1]} r={postSize(sc) * 1.2} fill={HALO} fillOpacity={HALO_OPACITY} />
        )}
        {/* 92LTX corner posts: white squares with an ink edge, like the system wall posts; those between frames on walls
            are drawn with them, where their strokes meet */}
        {cornerPosts(v)
          .filter(({ p }) => !onWallEnds.has(`${p[0]},${p[1]}`))
          .map(({ p: [x, y] }) => (
            <CornerPost key={`${x},${y}`} p={[x, y]} sc={sc} />
          ))}
      </g>

      {/* Textile walls: drawn in front of their face */}
      <g opacity={dim('textile')} pointerEvents="none">
        {frames.map(({ t, a, b, c }) => {
          const sel = selection.textileId === t.id
          const g = gone('textile', t.id)
          return (
            <g key={t.id}>
              <g opacity={g ? GONE : undefined}>
                {sel && <Seg a={a} b={b} stroke={HALO} strokeOpacity={HALO_OPACITY} strokeWidth={haloWidth(sc, tw)} />}
                <TextileStroke a={a} b={b} sc={sc} />
              </g>
              {(g || gone('graphic', `${t.id}.motif`)) && <Seg a={a} b={b} stroke={hatch} strokeWidth={tw} />}
              {c.lo && <CornerPost p={a} sc={sc} />}
              {c.hi && <CornerPost p={b} sc={sc} />}
            </g>
          )
        })}
        {/* Ceiling wires on a frame over its wall's top (Byggeregel X14): on the frame as drawn, at the plan's offset, as
            the raised wall's on its posts */}
        {frames.flatMap(({ t }) => {
          const w = v.walls.find((x) => x.id === t.wallId)
          const along = res.production.pieces.find((p) => p.textileId === t.id)?.wireAlong ?? []
          if (!w) return []
          const side = sideOf(v, t)
          return along.map((a) => {
            const [at] = faceSegment(w, side, a / 1000, a / 1000, textileOffset(sc))
            return <WireMark key={`w${t.id}${a}`} at={at} r={postSize(sc) * 0.9} />
          })
        })}
      </g>

      {/* Print and decals: a green raster band on the printed face, as wide as the decal (the whole plate when full) */}
      <g opacity={dim('foil')} pointerEvents="none">
        {v.foils.map((f) => {
          const w = v.walls.find((x) => x.id === f.wallId)
          if (!w) return null
          const [from, to] = foilSpan(v, rules, f)
          const band = printBand(sc)
          const [a, b] = faceSegment(w, sideOf(v, f), from, to, printOffset(sc))
          const sel = selection.foilId === f.id
          const g = gone('graphic', f.id)
          return (
            <g key={f.id}>
              <g opacity={g ? GONE : undefined}>
                {sel && <Seg a={a} b={b} stroke={HALO} strokeOpacity={HALO_OPACITY} strokeWidth={haloWidth(sc, band)} />}
                <Seg a={a} b={b} stroke={`url(#${raster})`} strokeWidth={band} />
              </g>
              {g && <Seg a={a} b={b} stroke={hatch} strokeWidth={linePx(sc, 4)} />}
            </g>
          )
        })}
      </g>
    </>
  )
}

/**
 * The frames on walls as the plan draws them, in front of their face at the plan's offset: moved in an inner corner
 * (byggeregel X10), or on to the 92LTX they share with a frame on the other wall, where the two strokes meet (X7). An
 * end joined to a free-standing run ends on that run's line; `joined` maps where that corner is to where it is drawn.
 */
function drawnFrames(v: Variant, res: CalcResult, sc: PlanScale) {
  const o = textileOffset(sc)
  const free = new Set(freeTextiles(v).map((t) => t.id))
  const corners = cornerEnds(v)
  return wallTextiles(v).flatMap((t) => {
    const w = v.walls.find((x) => x.id === t.wallId)
    const m = mountedOn(v, t.id)
    const run = v.textiles.find((x) => x.id === t.id)
    if (!w || !m || !run) return []
    const shift = (res.production.pieces.find((p) => p.textileId === t.id)?.shift ?? 0) / 1000
    const c = frameCorners(v, t.id)
    // The run end at the low or high end of the span, and whether a free-standing run meets it there
    const [dx, dy] = wallDirection(w)
    const along = (p: Point) => (p[0] - w.from[0]) * dx + (p[1] - w.from[1]) * dy
    const [lowP, highP] = along(run.from) <= along(run.to) ? [run.from, run.to] : [run.to, run.from]
    const toFree = (p: Point) => [...free].some((id) => {
      const f = v.textiles.find((x) => x.id === id)!
      return corners.get(id) && (same(f.from, p) || same(f.to, p))
    })
    const lo = c.lo ? (toFree(lowP) ? along(lowP) : t.from + c.lo * o) : t.from + shift + 0.02
    const hi = c.hi ? (toFree(highP) ? along(highP) : t.from + t.width - c.hi * o) : t.from + shift + t.width - 0.02
    const [a, b] = faceSegment(w, sideOf(v, t), lo, hi, o)
    const joined: [string, Point][] = [
      ...(c.lo && toFree(lowP) ? [[`${lowP[0]},${lowP[1]}`, a] as [string, Point]] : []),
      ...(c.hi && toFree(highP) ? [[`${highP[0]},${highP[1]}`, b] as [string, Point]] : []),
    ]
    return [{ t, a, b, c, joined }]
  })
}

/** A textile wall: ink frame, orange fill, and in full detail ink cross dashes. */
export function TextileStroke({ a, b, sc, opacity }: { a: Point; b: Point; sc: PlanScale; opacity?: number }) {
  const fill = textileFill(sc)
  return (
    <g opacity={opacity}>
      <Seg a={a} b={b} stroke={INK} strokeWidth={textileWidth(sc)} />
      <Seg a={a} b={b} stroke={TUSJ_TEXTILE} strokeWidth={fill} />
      {sc.detail === 'full' && (
        <Seg a={a} b={b} stroke={INK} strokeOpacity={0.5} strokeWidth={fill} strokeDasharray={`${sizePx(sc, 0.5)} ${sizePx(sc, 4)}`} />
      )}
    </g>
  )
}

/** Green with ink raster dots, 2,4 × 2,4 px: print and decals. */
export function RasterPattern({ id, sc }: { id: string; sc: PlanScale }) {
  const cell = sizePx(sc, 2.4)
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={cell} height={cell}>
      <rect width={cell} height={cell} fill={TUSJ_PRINT} />
      <circle cx={cell / 2} cy={cell / 2} r={sizePx(sc, 0.62)} fill={INK} fillOpacity={0.75} />
    </pattern>
  )
}

/** Label beside a run, on its face B side. */
/** The face shown in the drawer: a thin line on that side. */
function FaceMark({ t, face, sc, stroke = INK, width }: { t: { from: Point; to: Point }; face: FaceKey; sc: PlanScale; stroke?: string; width?: number }) {
  const [nx, ny] = runNormal(t, face)
  const wd = width ?? linePx(sc, 1.5)
  const o = textileWidth(sc) / 2 + sizePx(sc, 1.5) + wd / 2
  return <Seg a={[t.from[0] + nx * o, t.from[1] + ny * o]} b={[t.to[0] + nx * o, t.to[1] + ny * o]} stroke={stroke} strokeWidth={wd} />
}

/** A 92LTX corner post in plan: a white square with an ink edge, like a system wall post. */
function CornerPost({ p: [x, y], sc }: { p: Point; sc: PlanScale }) {
  const ps = postSize(sc)
  return <rect x={x - ps / 2} y={y - ps / 2} width={ps} height={ps} fill={SURFACE} stroke={INK} strokeWidth={linePx(sc, 1)} />
}
