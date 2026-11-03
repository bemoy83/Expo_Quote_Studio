// Carpet tiles: paint while the pointer moves, one undo step per stroke.
import { applyFloor } from '../../../domain/floor/brush'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

type FloorDrag = Extract<Drag, { kind: 'floor' }>

export function startFloor(c: PointerCtx, q: P): FloorDrag {
  c.onCheckpoint()
  const d: FloorDrag = { kind: 'floor', last: null, anchor: null }
  paintFloor(c, d, q)
  return d
}

function paintFloor(c: PointerCtx, d: FloorDrag, q: P) {
  const { brush } = c
  if (brush?.kind !== 'floor') return
  const a = c.floor.floorTouch(q, d.anchor)
  if (a.kind === 'none') return
  const k = `${a.kind}|${a.rect.i},${a.rect.j},${a.rect.w},${a.rect.h}`
  if (d.last === k) return
  d.last = k
  if (!d.anchor && a.kind === 'place') d.anchor = { i: a.rect.i, j: a.rect.j }
  c.onEdit((x) => applyFloor(x, a, brush.product), false)
}

export const floor: DragHandlers<'floor'> = { move: paintFloor }
