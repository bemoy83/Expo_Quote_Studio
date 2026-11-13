// The pen of Disker og podier (Byggeregel K10): a click on a counter chooses it, elsewhere stores the section the pen
// shows; a press and drag grows a counter from that section, which stays put from the press. The plan shows what a
// release stores while dragging (plan/next.ts).
import { drawPodium, podiumAt } from '../../../domain/podiums'
import type { PlacedObject } from '../../../domain/types'
import { isCounter, place } from '../../env'
import type { Brush } from '../../tools'
import { COUNTER_DRAG } from './counter'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

/** What the pen draws with: its product and colour. */
const penOf = (b: Brush | null) => (b?.kind === 'podium' ? { product: b.product, ral: b.ral } : null)

/** The counter under q a click chooses, if any. */
export function counterUnder(c: Pick<PointerCtx, 'hits'>, q: P): string | null {
  const on = c.hits.objectAt(q)
  return on && isCounter(on.product) ? on.id : null
}

/** The section the pen shows at q (podiumAt): stored by a click, the start of a drag. */
export function podiumStart(c: Pick<PointerCtx, 'v' | 'brush' | 'hits'>, q: P) {
  const pen = penOf(c.brush)
  if (!pen || !c.hits.onStand(q) || counterUnder(c, q)) return null
  return podiumAt(c.v, place, pen, [q.x, q.y])
}

/** What a drag from the section at the press to q draws. */
export const podiumDraw = (c: Pick<PointerCtx, 'v'>, start: PlacedObject, q: P) => drawPodium(c.v, place, start, [q.x, q.y])

export function startPodium(c: PointerCtx, q: P): Drag {
  const r = podiumStart(c, q)
  return { kind: 'podium', p0: q, start: r && !('error' in r) ? r.o : null, moved: false }
}

export const podium: DragHandlers<'podium'> = {
  move(_c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > COUNTER_DRAG) d.moved = true
  },
  up(c, d, q) {
    if (!d.moved) {
      const on = counterUnder(c, d.p0)
      if (on) return c.clickSelect({ objectId: on })
      const r = podiumStart(c, d.p0)
      if (!r) return
      if ('error' in r) return c.onToast(r.error)
      return c.onEdit(() => r.v)
    }
    if (!d.start) return
    const r = podiumDraw(c, d.start, q)
    if ('error' in r) return c.onToast(r.error)
    c.onEdit(() => r.v)
    c.onSelect({ objectId: r.id })
  },
}
