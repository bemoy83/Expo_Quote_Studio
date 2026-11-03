// Rolled floor in lanes: the stroke shows whole lanes and lays them on release.
import { applyFloor } from '../../../domain/floor/brush'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

export function startRoll(c: PointerCtx, q: P): Drag {
  const d = { kind: 'roll' as const, from: q, moved: false }
  c.setRollPending(c.floor.laneAction(d, null))
  return d
}

export const roll: DragHandlers<'roll'> = {
  move(c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.from.x, q.y - d.from.y) < 0.25) return
    d.moved = true
    c.setRollPending(c.floor.laneAction(d, q))
  },
  up(c) {
    const { brush } = c
    const a = c.rollPending
    c.setRollPending(null)
    if (a && a.kind !== 'none' && brush?.kind === 'floor') {
      const product = brush.product
      c.onEdit((x) => applyFloor(x, a, product, c.floor.dir))
    }
  },
}
