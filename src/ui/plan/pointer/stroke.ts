// A straight stroke on the wall grid: walls with the wall pen, drawn takdragere with the beam pen, or Tøm on a wall or
// a drawn takdrager (erase.ts). With the wall pen, Shift or «Fin» draws in 250 steps from a 250 node, and Shift pressed
// or let go mid-stroke goes on from what is drawn (Bjørn 14.11.2026).
import { eraseWalls, paintWalls } from '../../../domain/edit'
import { modulesAlong } from '../../../domain/grid'
import { drawInnerBeam, eraseInnerBeams, removeInnerBeam } from '../../../domain/innerBeams'
import type { Point } from '../../../domain/types'
import { rules } from '../../env'
import { continueStroke, strokeStep } from '../../../domain/snapGrid'
import { fineStrokeFrom, nearestEdge, strokeFrom } from '../geometry'
import type { DragHandlers, Drag, P, PointerCtx, StrokeSteps } from './types'

/** Stand walls separate exhibitors and follow the stand type: erasing them is refused. */
const STAND_WALL_LOCKED = 'Standvegger følger standtypen og kan ikke fjernes'

/** `fine`: Shift or «Fin» with the wall pen, 250 steps from a 250 node. */
export function startStroke(c: PointerCtx, q: P, beamId?: string, fine = false): Drag {
  const e0 = nearestEdge(c.v.stand, q)
  c.setStroke([e0.a, e0.b])
  return { kind: 'stroke', p0: q, moved: false, beamId, fine }
}

/** Shift pressed or let go (or Fin) since the last move: what is drawn stays, and the stroke goes on from it. */
export function strokeShift(d: StrokeSteps, fine: boolean, drawn: boolean) {
  if (!!d.fine === fine) return
  if (drawn && d.at) d.lock = d.at
  d.fine = fine
}

/** The stroke to q: in 250 steps from a 250 node with Shift or Fin (wall pen only), else whole modules (Byggeregel V1). */
function strokeTo(c: PointerCtx, d: Extract<Drag, { kind: 'stroke' }>, q: P): [Point, Point] {
  const stand = c.v.stand
  if (d.lock) return continueStroke(stand, d.lock, d.fine ? strokeStep(true) : rules.wall.cc, q)
  return d.fine ? fineStrokeFrom(stand, d.p0, q) : strokeFrom(stand, d.p0, q, rules.wall.cc)
}

export const stroke: DragHandlers<'stroke'> = {
  move(c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > 0.35) d.moved = true
    if (!d.moved) return
    d.at = strokeTo(c, d, q)
    c.setStroke(d.at)
  },
  up(c, d, q) {
    const { v, tool, brush } = c
    const [a, b] = d.moved
      ? strokeTo(c, d, q)
      : (() => {
          const m = nearestEdge(v.stand, d.p0)
          return [m.a, m.b] as [Point, Point]
        })()
    c.setStroke(null)
    // A click on a drawn takdrager takes all of it; a stroke takes what it runs along
    if (tool === 'erase' && d.beamId && !d.moved) c.onEdit((x) => removeInnerBeam(x, d.beamId!))
    else if (c.pens.beamTool) {
      const r = drawInnerBeam(v, a, b, c.standardRuns)
      if ('error' in r) return c.onToast(r.error)
      c.onEdit(() => r.v)
    } else if (tool === 'erase') {
      // Tøm takes walls and drawn takdragere along the stroke
      // Every module the stroke runs along, a shorter one too (Tøm takes a whole module)
      const keys = modulesAlong(c.mods, a, b).map((m) => m.key)
      if (keys.some((k) => c.standKeys.has(k))) c.onToast(STAND_WALL_LOCKED)
      c.onEdit((x) => eraseInnerBeams(eraseWalls(x, keys), a, b))
    } else if (brush?.kind === 'wall') c.onEdit((x) => paintWalls(x, a, b, brush.ral))
  },
}
