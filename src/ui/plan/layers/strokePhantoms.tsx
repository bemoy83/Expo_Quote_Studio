// Phantoms of the stroke tools (docs/forhandsvisning.md): while pressed or dragging, the product's own symbol from the
// working drawing at reduced strength, with rings at the ends and the length in a dark pill. Each one works out what a
// release would actually store (the same domain call the pointer makes), so the phantom is what you get, and a reason it
// cannot be stored comes back for the hint line. The aim before a press (rings, dashed outlines) is drawn by
// PreviewLayer with the parts in Previews.tsx. Plain functions, not components: PreviewLayer needs the hint as well as
// the drawing.
import type { ReactNode } from 'react'
import { RECIPES } from '../../../foga/recipes'
import { freeFrames, alongRun } from '../../../calc/textile/free'
import { wallModules, type Module } from '../../../domain/grid'
import { drawInnerBeam, type Run } from '../../../domain/innerBeams'
import { builtModules } from '../../../domain/walls'
import { faceSegment, felt, sideOf } from '../../../domain/faces'
import { drawTextile, fillFace } from '../../../domain/textile/brush'
import { textileAt } from '../../../domain/textile/inFrame'
import type { Point, Variant } from '../../../domain/types'
import { applyDrop, type DecorDrag } from '../../dnd'
import { INK, INK_MUTED } from '../../colors'
import { plateColor, rules } from '../../env'
import { mm } from '../dims'
import { linePx, sizePx, type PlanScale } from '../planScale'
import { beamBody, footDash, footStroke, PHANTOM, printBand, printOffset, textileOffset, textileWidth, wallCore, wallWidth } from '../planStyle'
import { BeamStroke } from './BeamLayer'
import { InvalidSeg, MeasurePill, RasterBand, Ring, TextileRun, type FaceHit, type TextileLine } from './Previews'
import { Seg } from './Seg'

/** What a phantom draws, and the hint when the release would store nothing. */
export interface Phantom {
  el: ReactNode
  hint: string | null
}

/** Half the length of the cross mark at each module joint of a wall phantom, px. */
const TICK = 3.5

/** The modules of the stroke a→b that are not built yet: a stroke over walls that exist only adds the rest. */
function newModules(v: Variant, a: Point, b: Point): Module[] {
  const n = Math.round(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]))
  if (!n) return []
  const built = new Set(builtModules(v).map((m) => m.key))
  return wallModules({ id: '', from: a, to: b }).filter((m) => !built.has(m.key))
}

/** Inner wall being drawn: the wall symbol in the pen's RAL, a cross mark per module, rings and the pill, new modules only. */
export function wallPhantom(sc: PlanScale, { v, a, b, ral, centre }: { v: Variant; a: Point; b: Point; ral?: string; centre: Point }): Phantom {
  const mods = newModules(v, a, b)
  const w = wallWidth(sc)
  const hz = a[1] === b[1]
  const t = sizePx(sc, TICK)
  const joints = new Map<string, Point>()
  for (const m of mods) for (const q of [m.a, m.b]) joints.set(`${q[0]},${q[1]}`, q)
  const L = mods.length * rules.wall.cc
  const el = (
    <g>
      <g opacity={PHANTOM.area}>
        {mods.map((m) => (
          <g key={m.key}>
            <Seg a={m.a} b={m.b} stroke={INK} strokeWidth={w} />
            <Seg a={m.a} b={m.b} stroke={plateColor(ral ?? v.defaultPlate)} strokeWidth={wallCore(sc)} />
          </g>
        ))}
        {[...joints.values()].map((q) => (
          <Seg key={`${q[0]},${q[1]}`} a={hz ? [q[0], q[1] - t] : [q[0] - t, q[1]]} b={hz ? [q[0], q[1] + t] : [q[0] + t, q[1]]} stroke={INK} strokeWidth={linePx(sc, 0.9)} />
        ))}
      </g>
      <Ring at={a} />
      <Ring at={b} />
      {mods.length > 0 && <MeasurePill a={a} b={b} centre={centre} stroke={w} text={`${mm(L)} · ${mods.length} ${mods.length === 1 ? 'modul' : 'moduler'}`} />}
    </g>
  )
  return { el, hint: mods.length ? null : 'Veggen finnes allerede' }
}

/** Drawn takdrager being dragged: the takdrager symbol, rings and the pill; hatched with the reason when it cannot be drawn. */
export function beamPhantom(sc: PlanScale, { v, a, b, standard, centre }: { v: Variant; a: Point; b: Point; standard: readonly Run[]; centre: Point }): Phantom {
  const body = beamBody(sc, rules.beam.thickness)
  const L = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])
  const r = L > 0 ? drawInnerBeam(v, a, b, standard) : null
  const error = r && 'error' in r ? r.error : null
  const el = (
    <g>
      {error ? (
        <InvalidSeg a={a} b={b} width={body} />
      ) : (
        <g opacity={PHANTOM.line}>
          <BeamStroke a={a} b={b} body={body} />
        </g>
      )}
      <Ring at={a} />
      <Ring at={b} />
      {L > 0 && !error && <MeasurePill a={a} b={b} centre={centre} stroke={body} text={mm(L)} />}
    </g>
  )
  return { el, hint: error }
}

/**
 * The textile stroke being drawn (or the press next to a wall, which fills that face): on a wall the frame on the face it
 * lands on, elsewhere the free-standing run with its foot plates where the calc puts them. `face` is the wall face a press
 * without a stroke fills.
 */
export function textilePhantom(sc: PlanScale, { v, line, face, centre }: { v: Variant; line: TextileLine; face: FaceHit | null; centre: Point }): Phantom {
  const click = line.a[0] === line.b[0] && line.a[1] === line.b[1]
  if (click && !face) return { el: <Ring at={line.a} />, hint: null }
  const r = click && face ? fillFace(v, rules, face.w.id, face.s, face.t) : drawTextile(v, rules, line.a, line.b, line.at)
  const tw = textileWidth(sc)
  if ('error' in r) return { el: click ? null : <InvalidSeg a={line.a} b={line.b} width={tw} />, hint: r.error }
  if ('mounted' in r) {
    const t = r.v.textiles.find((x) => x.id === r.mounted.id)!
    const w = r.v.walls.find((x) => x.id === t.wallId)!
    const [a, b] = faceSegment(w, sideOf(r.v, t), t.from, t.from + t.width, textileOffset(sc))
    return { el: <TextileRun a={a} b={b} centre={centre} text={`${mm(t.width)} på vegg`} />, hint: null }
  }
  const t = r.v.freeTextiles.find((x) => x.id === r.free.id)!
  const f = freeFrames(r.v, RECIPES.freeFrame, rules.textile.inFrame, '').find((x) => x.textileId === t.id)
  const h = t.from[1] === t.to[1]
  const feet = f?.supports.map((at, i) => {
    const [x, y] = alongRun(t, at)
    const fw = (h ? f.foot.along : f.foot.across) / 1000
    const fd = (h ? f.foot.across : f.foot.along) / 1000
    return <rect key={i} x={x - fw / 2} y={y - fd / 2} width={fw} height={fd} fill="none" stroke={INK_MUTED} strokeWidth={footStroke(sc)} strokeDasharray={footDash(sc)} />
  })
  return { el: <TextileRun a={t.from} b={t.to} centre={centre} text={mm(f ? f.length / 1000 : 0)} under={feet} />, hint: null }
}

/** A frame or motif dragged from Profilering over a wall face: the textile it would add, or the print band it would get. */
export function dropPhantom(sc: PlanScale, { v, h, d, centre }: { v: Variant; h: FaceHit; d: DecorDrag; centre: Point }): Phantom {
  const r = applyDrop(v, d, { wallId: h.w.id, s: h.s, t: h.t }, () => 1)
  if ('error' in r) return { el: null, hint: r.error }
  if (d.kind === 'textile') {
    const t = r.v.textiles.find((x) => x.id === r.select.textileId)!
    const [a, b] = faceSegment(h.w, h.s, t.from, t.from + t.width, textileOffset(sc))
    return { el: <TextileRun a={a} b={b} centre={centre} text={`${mm(t.width)} på vegg`} />, hint: null }
  }
  // A motif prints the textile it is dropped on, or goes on the wall panel as a decal
  const tx = textileAt(v, h.w.id, h.s, h.t)
  const f = felt(rules, h.module)
  const [a, b] = tx ? faceSegment(h.w, h.s, tx.from, tx.from + tx.width, textileOffset(sc)) : faceSegment(h.w, h.s, f.a, f.b, printOffset(sc))
  const band = tx ? linePx(sc, 3.2) : printBand(sc)
  return { el: <RasterBand a={a} b={b} width={band} />, hint: null }
}
