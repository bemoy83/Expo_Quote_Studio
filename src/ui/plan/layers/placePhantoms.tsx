// Previews of the pens that place one thing: door or curtain, motif (decal or print) and furniture
// (docs/forhandsvisning.md). Hovering aims (dashed outline of what is hit, or grey and hatched with the reason when it
// cannot go there); pressed, the phantom shows what the release stores. Each works it out with the same domain call the
// release makes. Plain functions, like strokePhantoms.tsx.
import { placeOpening } from '../../../domain/doors'
import { addFoil } from '../../../domain/decor'
import { faceSegment, felt } from '../../../domain/faces'
import { addObject, footprintBox } from '../../../domain/objects'
import { faceOfPoint, freeTextileAt, runNormal } from '../../../domain/textile/free'
import { textileAt } from '../../../domain/textile/inFrame'
import type { Module } from '../../../domain/grid'
import type { Point, Variant } from '../../../domain/types'
import { builtModules, doorAllowed } from '../../../domain/walls'
import { INK, SURFACE } from '../../colors'
import { idx, place, productOf, rules } from '../../env'
import { linePx, sizePx, type PlanScale } from '../planScale'
import { aimDash, AIM, DOOR_AIM, PHANTOM, printBand, printOffset, textileFill, textileOffset, textileWidth, wallWidth } from '../planStyle'
import type { PlanHits } from '../pointer/hits'
import { AimSeg, InvalidSeg, InvalidShape, RasterBand } from './Previews'
import { OpeningMark } from './WallLayer'
import { Seg } from './Seg'
import type { Phantom } from './strokePhantoms'

/** Door or curtain, hovering: one dashed line along the module's centre line with a light edge under it, so it shows on
 * the wall; hatched in a stand wall. */
export function doorAim(sc: PlanScale, v: Variant, e: Module): Phantom {
  if (!doorAllowed(v, e.a, e.b)) return { el: <InvalidSeg a={e.a} b={e.b} width={wallWidth(sc)} />, hint: DOOR_IN_STAND_WALL }
  const dash = `${sizePx(sc, DOOR_AIM.dash)} ${sizePx(sc, DOOR_AIM.gap)}`
  return {
    el: (
      <g>
        <Seg a={e.a} b={e.b} stroke={SURFACE} strokeWidth={linePx(sc, DOOR_AIM.halo)} />
        <Seg a={e.a} b={e.b} stroke={INK} strokeWidth={linePx(sc, DOOR_AIM.width)} strokeDasharray={dash} />
      </g>
    ),
    hint: null,
  }
}

/**
 * Door or curtain pressed in module e: the leaf and its swing as a release at q would store them (a door turns toward the
 * pointer, placeOpening). Out of the area the leaf can swing in, nothing: a release there stores nothing.
 */
export function doorHeld(sc: PlanScale, v: Variant, e: Module, product: string, door: boolean, q: { x: number; y: number }, holds: boolean): Phantom {
  if (!doorAllowed(v, e.a, e.b)) return { el: <InvalidSeg a={e.a} b={e.b} width={wallWidth(sc)} />, hint: DOOR_IN_STAND_WALL }
  if (!holds) return { el: null, hint: null }
  const next = placeOpening(v, e.a, e.b, product, door, q)
  const m = builtModules(next).find((x) => x.key === e.key && x.opening)
  const el = m ? <g opacity={PHANTOM.line}><OpeningMark v={next} m={m} selected={false} /></g> : null
  return { el, hint: door ? 'Dra mot siden døren skal slå · slipp for å sette inn · Esc avbryter' : null }
}

const DOOR_IN_STAND_WALL = 'Dører og forheng kan ikke stå i standveggen'

/** Motif: the textile face it prints or the panel field it gets as a decal; a band of print while pressed. */
export function motifPreview(sc: PlanScale, v: Variant, hits: PlanHits, q: { x: number; y: number }, motif: string, ratio: number, pressed: boolean): Phantom | null {
  const ft = freeTextileAt(v, q, 0.15)
  let seg: [Point, Point]
  let band: number
  if (ft) {
    const [nx, ny] = runNormal(ft, faceOfPoint(ft, q))
    const o = textileWidth(sc) / 2 + sizePx(sc, 1.5)
    seg = [[ft.from[0] + nx * o, ft.from[1] + ny * o], [ft.to[0] + nx * o, ft.to[1] + ny * o]]
    band = linePx(sc, 2.4)
  } else {
    const h = hits.faceHit(q)
    if (!h) return null
    const tx = textileAt(v, h.w.id, h.s, h.t)
    if (tx) {
      seg = faceSegment(h.w, h.s, tx.from, tx.from + tx.width, textileOffset(sc))
      band = textileFill(sc)
    } else {
      const r = addFoil(v, rules, h.w.id, h.module, h.s, motif, ratio)
      if ('error' in r) return { el: null, hint: r.error }
      const f = felt(rules, h.module)
      seg = faceSegment(h.w, h.s, f.a, f.b, printOffset(sc))
      band = printBand(sc)
    }
  }
  return { el: pressed ? <RasterBand a={seg[0]} b={seg[1]} width={band} /> : <AimSeg a={seg[0]} b={seg[1]} />, hint: null }
}

/** Furniture: a dashed footprint where it actually lands (moved off walls), in its colour while pressed. */
export function objectPreview(sc: PlanScale, v: Variant, product: string, q: { x: number; y: number }, pressed: boolean): Phantom | null {
  const f = productOf(product)?.footprint
  if (!f) return null
  const next = addObject(v, place, product, q.x, q.y)
  const o = next?.objects[next.objects.length - 1]
  if (!o) {
    const b = footprintBox({ x: q.x, y: q.y, rot: 0 }, f)
    const shape = f.round ? <InvalidShape kind="circle" cx={q.x} cy={q.y} r={f.w / 2} /> : <InvalidShape kind="rect" x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} />
    return { el: shape, hint: `Ikke plass til ${productOf(product)?.name.toLowerCase() ?? 'varen'} her` }
  }
  const b = footprintBox(o, f)
  const look = pressed
    ? { fill: idx.byArtnr.get(product)?.variant.color ?? INK, stroke: INK, strokeWidth: linePx(sc, 0.75), opacity: PHANTOM.line }
    : { fill: 'none', stroke: INK, strokeWidth: linePx(sc, AIM.width), strokeDasharray: aimDash(sc) }
  const el = f.round ? <circle cx={o.x} cy={o.y} r={f.w / 2} {...look} /> : <rect x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} rx={0.03} {...look} />
  return { el, hint: null }
}
