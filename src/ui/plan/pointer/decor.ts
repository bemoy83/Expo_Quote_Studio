// The motif pen: print on a textile (free-standing or InFrame), or a foil decal on a wall panel. Also drag and drop
// from Profilering, which does the same as a click with the textile or motif brush.
import { addFoil, foilAt, removeFoil } from '../../../domain/decor'
import { faceOfPoint, freeTextileAt, updateFace } from '../../../domain/textile/free'
import { textileAt, updateTextile } from '../../../domain/textile/inFrame'
import type { Motif } from '../../../persistence/file'
import { rules } from '../../env'
import { findMotif } from '../../motifs'
import type { P, PointerCtx } from './types'

export const ratioOf = (motifs: Motif[] | undefined) => (id: string) => findMotif(motifs, id)?.ratio ?? 1

/** Motif brush: print on a textile, or foil on a wall panel. */
export function decorClick(c: PointerCtx, q: P) {
  const { v, tool, brush } = c
  // A motif on a free-standing textile wall prints the face it was clicked on
  const ft = brush?.kind === 'motif' ? freeTextileAt(v, q, 0.15) : undefined
  if (ft) {
    const face = faceOfPoint(ft, q)
    if (tool === 'erase') return ft[face]?.motif ? c.onEdit((x) => updateFace(x, ft.id, face, { motif: null })) : c.onToast('Ingen grafikk her')
    return c.onEdit((x) => updateFace(x, ft.id, face, { motif: brush!.kind === 'motif' ? brush!.motif : null }))
  }
  const h = c.hits.faceHit(q)
  if (!h) return c.onToast('Klikk ved en vegg eller en tekstilvegg')
  const tx = textileAt(v, h.w.id, h.s, h.t)
  if (tool === 'erase') {
    const f = foilAt(v, rules, h.w.id, h.s, h.t)
    if (f) return c.onEdit((x) => removeFoil(x, f.id))
    if (tx?.motif) return c.onEdit((x) => updateTextile(x, rules, tx.id, { motif: null }))
    return c.onToast('Ingen grafikk her')
  }
  if (brush?.kind !== 'motif') return
  if (tx) return c.onEdit((x) => updateTextile(x, rules, tx.id, { motif: brush.motif }))
  const r = addFoil(v, rules, h.w.id, h.module, h.s, brush.motif, ratioOf(c.motifs)(brush.motif))
  if ('error' in r) return c.onToast(r.error)
  c.onEdit(() => r.v)
}
