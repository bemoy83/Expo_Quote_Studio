// The pen of Disker og podier (Byggeregel K10): a click on a counter chooses it, elsewhere stores the section the pen
// shows; a press and drag draws from that section, which stays put from the press. With Shift (or «Fin» in the quick
// picks) the section shown is 250 × 250 and a drag grows it in 250 steps (Bjørn 14.11.2026); Shift pressed or let go
// during a drag goes on from what is drawn. The plan shows what a release stores while dragging (plan/next.ts).
// With «Disk» in hand a drag draws a disk built as the one in stock, in its depth and in half metres (K22, Bjørn 16.11.2026).
import { dragLike, drawPodium, podiumAt, rebaseDrag, startDrag, type PodiumDrag } from '../../../domain/podiums'
import type { Variant } from '../../../domain/types'
import { catalog, isCounter, place } from '../../env'
import { builtByShape } from '../../podiumPen'
import type { Brush } from '../../tools'
import { pressMove, startPress } from './draw'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

/** What the pen draws with: its product, colour and height (K12), the standard counter a click places and its turn (K22). */
const penOf = (b: Brush | null) => (b?.kind === 'podium' ? { product: b.product, ral: b.ral, h: b.h, stock: b.stock, turn: b.turn } : null)

/** The counter under q a click chooses, if any. */
export function counterUnder(c: Pick<PointerCtx, 'hits'>, q: P): string | null {
  const on = c.hits.objectAt(q)
  return on && isCounter(on.product) ? on.id : null
}

/** The section the pen shows at q (podiumAt): stored by a click, the start of a drag; by a side of a counter, a påbygg
 *  against it (PR 3), slid along in 250 steps when `fine`. */
export function podiumStart(c: Pick<PointerCtx, 'v' | 'brush' | 'hits'>, q: P, fine = false) {
  const pen = penOf(c.brush)
  if (!pen || !c.hits.onStand(q) || counterUnder(c, q)) return null
  return podiumAt(c.v, place, pen, [q.x, q.y], fine)
}

/** A press at q. `fine`: Shift or Fin. */
export function startPodium(c: PointerCtx, q: P, fine: boolean): Drag {
  const p = startPress(q)
  const click = podiumStart(c, p.at, fine)
  // With «Disk» in hand the drag draws a disk built as the one in stock (K22)
  const like = c.brush?.kind === 'podium' ? dragLike(c.brush.stock) : undefined
  const drag = click && !('error' in click) ? startDrag(click.cell, [q.x, q.y], fine, click.onto, like) : null
  return { kind: 'podium', ...p, click, drag }
}

/** Shift pressed or let go since the last move (or Fin): goes on from what is drawn, at the pointer before this move. */
export function podiumShift(d: Extract<Drag, { kind: 'podium' }>, fine: boolean) {
  if (d.drag && !d.drag.like && d.drag.fine !== fine) d.drag = rebaseDrag(d.drag, [d.last.x, d.last.y], fine)
}

export const podium: DragHandlers<'podium'> = {
  move: (_c, d, q) => pressMove(d, q),
  up(c, d, q) {
    if (!d.moved) {
      const on = counterUnder(c, d.at)
      if (on) return c.clickSelect({ objectId: on })
      const r = d.click
      if (!r) return
      if ('error' in r) return c.onToast(r.error)
      return c.onEdit(() => shaped(c, r.v, r.id))
    }
    if (!d.drag) return
    const r = drawPodiumAt(c, d.drag, q)
    if ('error' in r) return c.onToast(r.error)
    c.onEdit(() => shaped(c, r.v, r.id))
    c.onSelect({ objectId: r.id })
  },
}

/** What is stored, built as its function's product (K13): with «Fri» a new one by what it is. */
const shaped = (c: Pick<PointerCtx, 'v' | 'brush'>, v: Variant, id: string) =>
  c.brush?.kind === 'podium' ? builtByShape(v, id, !c.v.objects.some((o) => o.id === id), c.brush, catalog.products) : v

/** What the drag draws with the pointer at q. */
export const drawPodiumAt = (c: Pick<PointerCtx, 'v'>, d: PodiumDrag, q: P) => drawPodium(c.v, place, d, [q.x, q.y])
