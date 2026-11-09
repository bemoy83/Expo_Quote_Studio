// The shelf pen (hylle 6311, docs/byggeregler.md H1–H7): a press on a wall face picks the module there, a drag along
// the same wall and face stretches a row over more modules, the release lays them at the start height. A click in a
// felt that already has shelves selects the lowest of them instead (more go on from the drawer). New shelves take the
// height of a shelf beside them, so a row goes on as one row (Byggeregel H2).
import { addShelf, addShelfRow, penHeight } from '../../../domain/shelves'
import { mm } from '../../format'
import { rules } from '../../env'
import type { Drag, DragHandlers, P, PointerCtx } from './types'

export function startShelf(c: PointerCtx, q: P): Drag | undefined {
  const h = c.hits.faceHit(q)
  if (!h) {
    c.onToast('Klikk ved en vegg, på siden hyllen skal stå')
    return
  }
  return { kind: 'shelf', wallId: h.w.id, s: h.s, m0: h.module, m1: h.module }
}

/** The module under q on the press's wall and face, or null when the pointer has left it. */
export function shelfModuleAt(c: Pick<PointerCtx, 'hits'>, d: Extract<Drag, { kind: 'shelf' }>, q: P): number | null {
  const h = c.hits.faceHit(q, 0.6)
  return h && h.w.id === d.wallId && h.s === d.s ? h.module : null
}

export const shelf: DragHandlers<'shelf'> = {
  move(c, d, q) {
    const m = shelfModuleAt(c, d, q)
    if (m !== null) d.m1 = m
  },
  up(c, d) {
    // The row goes on at the height of a shelf beside it, else the start height (Bjørn 9.11.2026)
    const y = penHeight(c.v, rules, d.wallId, d.s, d.m0, d.m1)
    if (d.m0 === d.m1) {
      const r = addShelf(c.v, rules, d.wallId, d.m0, d.s, y)
      if ('error' in r) return c.onToast(r.error)
      if (r.existing) return c.onSelect({ wallId: d.wallId, side: d.s, shelfId: r.id })
      c.onEdit(() => r.v)
      return c.onToast(`Hylle ${mm(y)} mm fra gulvet · velg den for å endre høyden`)
    }
    const r = addShelfRow(c.v, rules, d.wallId, d.m0, d.m1, d.s, y)
    if (!r.ids.length) return c.onToast('Ingen av feltene kan ta hylle her')
    c.onEdit(() => r.v)
    c.onToast(`${r.ids.length} ${r.ids.length === 1 ? 'hylle' : 'hyller'} ${mm(y)} mm fra gulvet`)
  },
}
