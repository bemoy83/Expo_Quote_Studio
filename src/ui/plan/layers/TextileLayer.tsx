// Textile walls and foil decor in the plan: free-standing frames with their foot plates and corner posts, InFrame
// frames in front of their wall face, and a raster band on the face that carries a decal or print
// (docs/arbeidstegning.md: orange with cross dashes for textile, green with raster dots for print).
import { useId } from 'react'
import type { CalcResult } from '../../../calc/calc'
import { foilSpan } from '../../../domain/decor'
import { runNormal, type FaceKey } from '../../../domain/textile/free'
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
import { GONE, useErasing } from './erasing'

/** Frittstående tekstilvegger, textile walls on a wall face, and the print and decal bands. */
export function TextileLayer({ v, res, selection, dim }: { v: Variant; res: CalcResult; selection: PlanSelection; dim: (...layers: Layer[]) => number }) {
  // Tøm: a textile wall about to go is dimmed and hatched; a motif about to go only hatched, on its face
  const { gone, hatch } = useErasing()
  const sc = usePlanScale()
  const tw = textileWidth(sc)
  const raster = `raster${useId().replace(/:/g, '')}`
  const ps = postSize(sc)
  return (
    <>
      <defs>
        <RasterPattern id={raster} sc={sc} />
      </defs>

      {/* Frittstående tekstilvegger: foot plates under the frame, corner posts, the frame */}
      <g opacity={dim('textile')} pointerEvents="none">
        {res.production.free.map((f) => {
          const t = v.freeTextiles.find((x) => x.id === f.textileId)
          if (!t) return null
          const sel = selection.freeTextileId === t.id
          const g = gone('textile', t.id)
          const motif = (['a', 'b'] as const).find((k) => gone('graphic', `${t.id}.${k}`))
          return (
            <g key={t.id} opacity={g ? GONE : undefined}>
              {f.supports.map((at, i) => {
                const [x, y] = alongRun(t, at, f)
                const h = t.from[1] === t.to[1]
                const w = (h ? f.foot.along : f.foot.across) / 1000
                const d = (h ? f.foot.across : f.foot.along) / 1000
                return <rect key={i} x={x - w / 2} y={y - d / 2} width={w} height={d} fill="none" stroke={INK_MUTED} strokeWidth={footStroke(sc)} strokeDasharray={footDash(sc)} />
              })}
              {sel && <Seg a={t.from} b={t.to} stroke={INK} strokeOpacity={HALO_OPACITY} strokeWidth={haloWidth(sc, tw)} />}
              <TextileStroke a={t.from} b={t.to} sc={sc} />
              {sel && selection.freeFace && <FaceMark t={t} face={selection.freeFace} sc={sc} />}
              {g && <Seg a={t.from} b={t.to} stroke={hatch} strokeWidth={tw} />}
              {motif && <FaceMark t={t} face={motif} stroke={hatch} width={linePx(sc, 4)} sc={sc} />}
            </g>
          )
        })}
        {/* 92LTX corner posts: white squares with an ink edge, like the system wall posts */}
        {cornerPosts(v).map(([x, y]) => (
          <rect key={`${x},${y}`} x={x - ps / 2} y={y - ps / 2} width={ps} height={ps} fill={SURFACE} stroke={INK} strokeWidth={linePx(sc, 1)} />
        ))}
      </g>

      {/* Textile walls: drawn in front of their face */}
      <g opacity={dim('textile')} pointerEvents="none">
        {v.textiles.map((t) => {
          const w = v.walls.find((x) => x.id === t.wallId)
          if (!w) return null
          // Where it stands: moved in an inner corner (byggeregel X10)
          const shift = (res.production.pieces.find((p) => p.textileId === t.id)?.shift ?? 0) / 1000
          const [a, b] = faceSegment(w, sideOf(v, t), t.from + shift + 0.02, t.from + shift + t.width - 0.02, textileOffset(sc))
          const sel = selection.textileId === t.id
          const g = gone('textile', t.id)
          return (
            <g key={t.id}>
              <g opacity={g ? GONE : undefined}>
                {sel && <Seg a={a} b={b} stroke={INK} strokeOpacity={HALO_OPACITY} strokeWidth={haloWidth(sc, tw)} />}
                <TextileStroke a={a} b={b} sc={sc} />
              </g>
              {(g || gone('graphic', `${t.id}.motif`)) && <Seg a={a} b={b} stroke={hatch} strokeWidth={tw} />}
            </g>
          )
        })}
      </g>

      {/* Print and decals: a green raster band on the printed face, as wide as the decal (the whole plate when full) */}
      <g opacity={dim('foil')} pointerEvents="none">
        {v.foils.map((f) => {
          const w = v.walls.find((x) => x.id === f.wallId)
          if (!w) return null
          const [from, to] = foilSpan(rules, f)
          const band = printBand(sc)
          const [a, b] = faceSegment(w, sideOf(v, f), from, to, printOffset(sc))
          const sel = selection.foilId === f.id
          const g = gone('graphic', f.id)
          return (
            <g key={f.id}>
              <g opacity={g ? GONE : undefined}>
                {sel && <Seg a={a} b={b} stroke={INK} strokeOpacity={HALO_OPACITY} strokeWidth={haloWidth(sc, band)} />}
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
