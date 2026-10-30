// Drag steps shared by the plan and the 3D view, so both move walls and furniture the same way.
import { moveWall } from '../domain/edit'
import { settleObject } from '../domain/objects'
import type { Variant } from '../domain/types'
import { place } from './env'

type Edit = (fn: (v: Variant) => Variant, history?: boolean) => void

export interface WallDrag {
  id: string
  p0: { x: number; y: number }
  /** The variant when the drag started; every step moves the wall from here. */
  v0: Variant
  /** Whole metres moved so far. */
  delta: number
  horizontal: boolean
}

/** Move an inner wall to whole metres under the pointer. One undo step per drag. */
export function dragWall(d: WallDrag, q: { x: number; y: number }, onEdit: Edit, onCheckpoint: () => void) {
  const delta = Math.round(d.horizontal ? q.y - d.p0.y : q.x - d.p0.x)
  if (delta === d.delta) return
  const next = moveWall(d.v0, d.id, delta)
  if (next === d.v0 && delta !== 0) return
  if (d.delta === 0) onCheckpoint()
  d.delta = delta
  onEdit(() => next, false)
}

/** Drop a dragged object: keep it where it is, or move it back to `start` when it does not fit. */
export function dropObject(v: Variant, id: string, start: { x: number; y: number }, onEdit: Edit, onToast: (text: string) => void) {
  const r = settleObject(v, place, id, start)
  if (r.v !== v) onEdit(() => r.v, false)
  if (!r.ok) onToast('Ikke plass der')
}
