// Previews of the pens that place one thing: door or curtain, motif (decal or print) and furniture
// (docs/forhandsvisning.md). Hovering aims (dashed outline of what is hit, or grey and hatched with the reason when it
// cannot go there); pressed, the phantom shows what the release stores. Each works it out with the same domain call the
// release makes. Plain functions, like strokePhantoms.tsx.
import { drawOpening, setOpening } from '../../../domain/doors'
import { addFoil } from '../../../domain/decor'
import { faceSegment, felt } from '../../../domain/faces'
import { addObject, footprintBox } from '../../../domain/objects'
import { faceOfPoint, freeTextileAt, runNormal } from '../../../domain/textile/free'
import { textileAt } from '../../../domain/textile/inFrame'
import type { Module } from '../../../domain/grid'
import type { Point, Variant } from '../../../domain/types'
import { builtModules, doorAllowed } from '../../../domain/walls'
import { INK } from '../../colors'
import { idx, place, productOf, rules } from '../../env'
import { linePx, sizePx, type PlanScale } from '../planScale'
import { aimDash, AIM, PHANTOM, printBand, printOffset, textileFill, textileOffset, textileWidth, wallWidth } from '../planStyle'
import type { PlanHits } from '../pointer/hits'
import { AimSeg, InvalidSeg, InvalidShape, RasterBand } from './Previews'
import { OpeningMark } from './WallLayer'
import type { Phantom } from './strokePhantoms'

/** Door or curtain: aim on both sides of the module, the leaf and its swing while pressed, hatched in a stand wall. */
export function doorPreview(sc: PlanScale, v: Variant, e: Module, onWall: boolean, product: string, pressed: boolean): Phantom {
  const w = wallWidth(sc)
  if (!doorAllowed(v, e.a, e.b)) return { el: <InvalidSeg a={e.a} b={e.b} width={w} />, hint: 'Dører og forheng kan ikke stå i standveggen' }
  if (!pressed) {
    const o = w / 2 + sizePx(sc, 2)
    const hz = e.a[1] === e.b[1]
    const off = (p: Point, k: number): Point => (hz ? [p[0], p[1] + k] : [p[0] + k, p[1]])
    return {
      el: (
        <g>
          <AimSeg a={off(e.a, -o)} b={off(e.b, -o)} />
          <AimSeg a={off(e.a, o)} b={off(e.b, o)} />
        </g>
      ),
      hint: null,
    }
  }
  const next = onWall ? setOpening(v, e.key, product) : drawOpening(v, e.a, e.b, product)
  const m = builtModules(next).find((x) => x.key === e.key && x.opening)
  return { el: m ? <g opacity={PHANTOM.line}><OpeningMark v={next} m={m} selected={false} /></g> : null, hint: null }
}

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
