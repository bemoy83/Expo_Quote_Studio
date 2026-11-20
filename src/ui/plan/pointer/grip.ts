// A grip of what is chosen dragged (plan/grips.ts; Byggeregel K14 for Disker og podier): the plan shows what a release
// stores (plan/next.ts), with what goes away hatched; the release stores it, or says why not. A press that does not move
// does nothing: what is chosen stays chosen.
import { GRIP_MOVE } from '../../../domain/grips'
import { dragGrip, gripWith, type GripOn } from '../grips'
import { startRoom } from './room'
import type { PlanSelection } from '../selection'
import { wallDrag } from '../../drag'
import type { Drag, DragHandlers, P, PointerCtx } from './types'
import { goneFrom } from './moved'
import { freeTextiles } from '../../../domain/textile/mounts'

export type GripDrag = Extract<Drag, { kind: 'grip' }>

/** A press on a grip of what is chosen that the pen in hand shows (gripWith), if there is one under q. A move grip
 *  starts the drag Velg starts on the thing itself: a room moved (room.ts), furniture or a counter moved (object.ts). */
export function startGrip(c: PointerCtx, q: P): Drag | null {
  const g = c.hits.gripAt(q)
  if (!g || !gripWith(g.on, c.tool, c.brush)) return null
  if (g.on.type !== 'move') return gripPress(c, g.on, q)
  // In Velg a press there is a press on the room or piece itself (select.ts): the same drag, and a click selects as ever
  if (c.tool === 'select') return null
  const { id } = g.on
  // An inner wall or textile wall with its group (Byggeregel M6): the drag Velg starts on it
  if (g.on.what === 'wall') {
    const w = c.v.walls.find((x) => x.id === id)
    return w ? { kind: 'wall', ...wallDrag(w, q, c.v, c.fine), select: c.selection } : null
  }
  if (g.on.what === 'textile') return freeTextiles(c.v).some((t) => t.id === id) ? { kind: 'freeMove', id, p0: q, v0: c.v, moved: false, select: c.selection } : null
  if (g.on.what === 'room') {
    const room = c.v.rooms.find((r) => r.id === id)
    return room ? { ...startRoom(c, room, q, { roomId: id }), grip: true } : null
  }
  const o = c.v.objects.find((x) => x.id === id)
  return o ? { kind: 'object', id, dx: q.x - o.x, dy: q.y - o.y, start: { x: o.x, y: o.y }, moved: false, select: c.selection, grip: true } : null
}

/** A press that takes hold of `on` at q; `select`: what a click there (no drag) selects instead. */
export function gripPress(c: Pick<PointerCtx, 'fine'>, on: GripOn, q: P, select?: PlanSelection): GripDrag {
  return { kind: 'grip', on, p0: q, moved: false, fine: c.fine, ...(select && { select }) }
}

/** What the drag stores with the pointer at q. */
export const gripDrawAt = (c: Pick<PointerCtx, 'v'>, d: GripDrag, q: P) => dragGrip(c.v, d.on, [d.p0.x, d.p0.y], [q.x, q.y], d.fine)

export const grip: DragHandlers<'grip'> = {
  move(_c, d, q) {
    goneFrom(d, q, GRIP_MOVE)
  },
  up(c, d, q) {
    // A click: what was pressed is selected (a room's side: its wall or door), else what is chosen stays chosen
    if (!d.moved) return d.select && c.clickSelect(d.select)
    const r = gripDrawAt(c, d, q)
    if (!r) return
    if ('error' in r) return c.onToast(r.error)
    if (r.v !== c.v) c.onEdit(() => r.v)
    if (r.toast) c.onToast(r.toast)
  },
}
