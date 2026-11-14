// The pens of Profilering that put graphics on something (Bjørn 14.11.2026, each product its own pen): Print prints the
// whole wall felt clicked, Dekal puts a foil decal on it, Tekstil with a motif prints the textile wall clicked. Also
// drag and drop from Profilering, which does what a click with the textile or motif brush did (applyDrop).
import { addFoil, foilBlocked } from '../../../domain/decor'
import { printPlate, printsOn } from '../../../domain/print'
import { faceOfPoint, freeTextileAt, updateFace } from '../../../domain/textile/free'
import { textileAt, updateTextile } from '../../../domain/textile/inFrame'
import type { Motif, Variant } from '../../../domain/types'
import { rules } from '../../env'
import { findMotif } from '../../motifs'
import type { MotifPen } from '../../profilePen'
import type { FaceHit } from '../layers/Previews'
import type { PlanHits } from './hits'
import type { P, PointerCtx } from './types'

export const ratioOf = (motifs: Motif[] | undefined) => (id: string) => findMotif(motifs, id)?.ratio ?? 1

/** The textile wall at q: a free-standing one and the face clicked, else one mounted on the wall face hit. */
export type TextileUnder = { free: string; face: 'a' | 'b' } | { mounted: string }

export function textileUnder(v: Variant, hits: Pick<PlanHits, 'faceHit'>, q: P): TextileUnder | null {
  const ft = freeTextileAt(v, q, 0.15)
  if (ft) return { free: ft.id, face: faceOfPoint(ft, q) }
  const h = hits.faceHit(q)
  const tx = h && textileAt(v, h.w.id, h.s, h.t)
  return tx ? { mounted: tx.id } : null
}

/** The textile at `u` printed with the motif. */
export const printTextile = (v: Variant, u: TextileUnder, motif: string): Variant =>
  'free' in u ? updateFace(v, u.free, u.face, { motif }) : updateTextile(v, rules, u.mounted, { motif })

export const TEXTILE_NOT = 'Bytt til Tekstil for å trykke en tekstilvegg'

/** What Print or Dekal does on the felt hit: the next variant, or why not. Print with the motif the felt already has
 *  does nothing (as a palette colour, PR #162). */
export function feltDecor(v: Variant, h: FaceHit, pen: MotifPen, ratio: number): { v: Variant } | { error: string } {
  if (textileAt(v, h.w.id, h.s, h.t)) return { error: TEXTILE_NOT }
  if (pen.pen !== 'print') return addFoil(v, rules, h.w.id, h.module, h.s, pen.motif, ratio)
  const why = foilBlocked(v, rules, h.w.id, h.module, h.s, true)
  if (why) return { error: why }
  if (printsOn(v, h.w.id, h.s).some((f) => f.module === h.module && f.motif === pen.motif && !f.run)) return { v }
  return { v: printPlate(v, rules, h.w.id, h.module, h.s, pen.motif) }
}

/** Print or Dekal clicked. */
export function decorClick(c: PointerCtx, q: P) {
  const { v, brush } = c
  if (brush?.kind !== 'motif') return
  if (freeTextileAt(v, q, 0.15)) return c.onToast(TEXTILE_NOT)
  const h = c.hits.faceHit(q)
  if (!h) return c.onToast('Klikk et veggfelt')
  const r = feltDecor(v, h, brush, ratioOf(c.motifs)(brush.motif))
  if ('error' in r) return c.onToast(r.error)
  if (r.v !== v) c.onEdit(() => r.v)
}
