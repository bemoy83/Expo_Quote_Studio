// What the pill and the wall drawer do with chosen shelves (hylle 6311, Bjørn 9.11.2026): the chosen shelf's row, or
// only it with `shelfOnly` (chosenShelves). Each action edits the sketch in one step, or tells why it could not.
import { sideOf, type FaceSide } from '../../domain/faces'
import { addShelvesAbove, copyShelvesNear, feltShelves, moveShelves, type ShelvesMove, spreadShelves } from '../../domain/shelves/edit'
import { highWarning, shelfRow, shelvesOf, tooHigh } from '../../domain/shelves/model'
import type { Shelf, Variant } from '../../domain/types'
import { rules } from '../env'
import { chosenShelves, type PlanSelection } from './selection'

type Edit = (fn: (v: Variant) => Variant, history?: boolean) => void

export function shelfActions(
  v: Variant,
  sel: PlanSelection,
  H: Shelf,
  onEdit: Edit,
  onToast: (text: string) => void,
  /** Choose a shelf on H's wall face after the edit. */
  choose: (shelfId: string, shelfOnly?: boolean) => void,
) {
  const ids = chosenShelves(v, sel)
  const n = ids.length
  const what = n > 1 ? 'Raden' : 'Hyllen'
  const s: FaceSide = sideOf(v, H)
  // Right as the face is seen from in front of it: the modules run the other way on face −1
  const dir = s === 1 ? 1 : -1
  /** The new ones chosen as the old: the copy of H, its row or only it. */
  const copied = (r: { v: Variant; ids: string[] } | null, from: string[], only?: boolean) => {
    if (!r) return onToast('Ingen ledige felt på denne siden')
    onEdit(() => r.v)
    choose(r.ids[from.indexOf(H.id)], only)
  }
  return {
    ids,
    n,
    /** Shelves in H's row, chosen or not («Bare denne» shows when more than one). */
    row: shelfRow(v, H.id).length,
    what,
    dir,
    /** Move, warning above the soft limit (H4). */
    move(m: ShelvesMove, why: string) {
      const next = moveShelves(v, rules, ids, m)
      if (next === v) return onToast(why)
      onEdit(() => next)
      const y = shelvesOf(next).find((x) => x.id === H.id)!.y
      if (tooHigh(rules, y)) onToast(highWarning(rules))
    },
    /** One more (a row gets a row): the next quick pick above, then below (H4). */
    more() {
      const r = addShelvesAbove(v, rules, ids)
      if ('error' in r) return onToast(r.error)
      onEdit(() => r.v)
      choose(r.ids[ids.indexOf(H.id)] ?? r.ids[0], sel.shelfOnly)
    },
    /** A copy in the nearest free felts. */
    copy: () => copied(copyShelvesNear(v, rules, ids, dir), ids, sel.shelfOnly),
    /** The felts with all that is stacked in them, copied. */
    copyFelt() {
      const all = feltShelves(v, ids)
      copied(copyShelvesNear(v, rules, all, dir), all)
    },
    spread() {
      const next = spreadShelves(v, rules, ids)
      if (!next) return onToast('Hyllene står allerede jevnt')
      onEdit(() => next)
    },
  }
}
