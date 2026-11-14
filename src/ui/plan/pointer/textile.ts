// The textile brush: a stroke stands free on foot plates, a click next to a system wall fills that face's free part. The
// motif on the pen (Farge, Bjørn 14.11.2026) goes on the textile drawn, and a click on a textile wall prints it.
import { drawTextile, fillFace } from '../../../domain/textile/brush'
import { freeStroke, runLength } from '../../../domain/textile/free'
import type { Variant } from '../../../domain/types'
import { fmt } from '../../format'
import { rules } from '../../env'
import type { TextileLine } from '../layers/Previews'
import { printTextile, textileUnder } from './decor'
import type { DragHandlers, Drag, P, PointerCtx } from './types'
import type { TextileResult } from '../../../domain/textile/brush'

/** The textile laid, with the pen's motif on it (both faces of a free-standing one). */
export function withPenMotif(r: TextileResult, motif: string | undefined): TextileResult {
  if ('error' in r || !motif) return r
  if ('mounted' in r) return { ...r, v: printTextile(r.v, { mounted: r.mounted.id }, motif) }
  return { ...r, v: printTextile(printTextile(r.v, { free: r.free.id, face: 'a' }, motif), { free: r.free.id, face: 'b' }, motif) }
}

/** The stroke from p0 to q on the drawing grid, with where it started (picks the wall face when it lies on a wall). */
export const textileLine = (v: Variant, step: number, p0: P, q: P): TextileLine => {
  const [a, b] = freeStroke(v, rules, p0, q, step)
  return { a, b, at: p0 }
}

export function startTextile(c: PointerCtx, q: P): Drag | undefined {
  const { v } = c
  c.setTextileStroke(textileLine(v, c.step, q, q))
  return { kind: 'textile', p0: q }
}

export const textile: DragHandlers<'textile'> = {
  move(c, d, q) {
    c.setTextileStroke(textileLine(c.v, c.step, d.p0, q))
  },
  up(c, d, q) {
    const { v } = c
    const [a, b] = freeStroke(v, rules, d.p0, q, c.step)
    c.setTextileStroke(null)
    // A click without a stroke fills the free part of the wall face it is next to
    const click = a[0] === b[0] && a[1] === b[1]
    const h = click ? c.hits.faceHit(d.p0) : null
    const motif = c.brush?.kind === 'textile' ? c.brush.motif : undefined
    // A click on a textile wall with a motif in hand prints it
    const u = click && motif ? textileUnder(v, c.hits, d.p0) : null
    if (u && motif) return c.onEdit((x) => printTextile(x, u, motif))
    if (click && !h) return c.onToast('Dra en strek for en frittstående tekstilvegg, eller klikk ved en systemvegg')
    const r = withPenMotif(h ? fillFace(v, rules, h.w.id, h.s, h.t) : drawTextile(v, rules, a, b, d.p0), motif)
    if ('error' in r) return c.onToast(r.error)
    c.onEdit(() => r.v)
    if ('mounted' in r) {
      const t = r.v.textiles.find((x) => x.id === r.mounted.id)!
      c.onToast(`Tekstilvegg ${fmt(t.width, 2)} m på systemveggen · Velg den for å justere`)
    } else {
      const t = r.v.freeTextiles.find((x) => x.id === r.free.id)!
      c.onToast(`Tekstilvegg ${fmt(runLength(t), 2)} m frittstående på fotplater · Velg den for trykk og tekstil`)
    }
  },
}
