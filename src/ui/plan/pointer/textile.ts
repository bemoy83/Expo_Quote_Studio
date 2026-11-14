// What the textile pen stores; it draws with the same tool as Vegg (run.ts). A run stands free on foot plates, or on a
// system wall's line is mounted on it; a click next to a system wall fills that face's free part. The motif on the pen
// (Farge, Bjørn 14.11.2026) goes on the textile drawn, and a click on a textile wall prints it.
import { drawTextile, fillFace } from '../../../domain/textile/brush'
import { shownModule } from '../../../domain/runDraw'
import { runLength } from '../../../domain/textile/free'
import type { Point, Variant } from '../../../domain/types'
import { fmt } from '../../format'
import { rules } from '../../env'
import { printTextile, textileUnder } from './decor'
import type { PlanHits } from './hits'
import type { P } from './types'
import type { TextileResult } from '../../../domain/textile/brush'

/** The textile laid, with the pen's motif on it (both faces of a free-standing one). */
export function withPenMotif(r: TextileResult, motif: string | undefined): TextileResult {
  if ('error' in r || !motif) return r
  if ('mounted' in r) return { ...r, v: printTextile(r.v, { mounted: r.mounted.id }, motif) }
  return { ...r, v: printTextile(printTextile(r.v, { free: r.free.id, face: 'a' }, motif), { free: r.free.id, face: 'b' }, motif) }
}

/** What a click with the textile pen at q stores (one drawing tool, Bjørn 14.11.2026): a textile wall under it gets the
 *  pen's motif; next to a system wall the free part of that face fills; on free floor the module the pen shows stands
 *  free on foot plates, as a click with Vegg lays one module. */
export type TextileClick = { print: (v: Variant) => Variant } | TextileResult
export function textileClick(v: Variant, hits: PlanHits, q: P, motif: string | undefined): TextileClick {
  const u = motif ? textileUnder(v, hits, q) : null
  if (u && motif) return { print: (x) => printTextile(x, u, motif) }
  const h = hits.faceHit(q)
  if (h) return withPenMotif(fillFace(v, rules, h.w.id, h.s, h.t), motif)
  const m = shownModule(v.stand, q)
  return withPenMotif(drawTextile(v, rules, m.a, m.b, q), motif)
}

/** A run drawn with the textile pen from a to b: on a system wall's line mounted on the face `at` is on, else free. */
export const textileRun = (v: Variant, a: Point, b: Point, at: P, motif: string | undefined): TextileResult => withPenMotif(drawTextile(v, rules, a, b, at), motif)

/** What the plan says once a textile wall is laid. */
export function textileToast(r: Exclude<TextileResult, { error: string }>): string {
  if ('mounted' in r) {
    const t = r.v.textiles.find((x) => x.id === r.mounted.id)!
    return `Tekstilvegg ${fmt(t.width, 2)} m på systemveggen · Velg den for å justere`
  }
  const t = r.v.freeTextiles.find((x) => x.id === r.free.id)!
  return `Tekstilvegg ${fmt(runLength(t), 2)} m frittstående på fotplater · Velg den for trykk og tekstil`
}
