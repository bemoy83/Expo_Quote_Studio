// Tøm along walls and drawn takdragere (erase.ts): a straight stroke on the wall grid, in whole modules. The pens that
// draw a run (wall, takdrager) use the drawing tool in run.ts.
import { eraseWalls } from '../../../domain/edit'
import { modulesAlong } from '../../../domain/grid'
import { eraseInnerBeams, removeInnerBeam } from '../../../domain/innerBeams'
import type { Point } from '../../../domain/types'
import { rules } from '../../env'
import { nearestEdge, strokeFrom } from '../geometry'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

/** Stand walls separate exhibitors and follow the stand type: erasing them is refused. */
const STAND_WALL_LOCKED = 'Standvegger følger standtypen og kan ikke fjernes'

/** `beamId`: pressed on a drawn takdrager, so a click takes all of it. */
export function startStroke(c: PointerCtx, q: P, beamId?: string): Drag {
  const e0 = nearestEdge(c.v.stand, q)
  c.setStroke([e0.a, e0.b])
  return { kind: 'stroke', p0: q, moved: false, beamId }
}

const strokeTo = (c: PointerCtx, d: Extract<Drag, { kind: 'stroke' }>, q: P): [Point, Point] => strokeFrom(c.v.stand, d.p0, q, rules.wall.cc)

export const stroke: DragHandlers<'stroke'> = {
  move(c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > 0.35) d.moved = true
    if (d.moved) c.setStroke(strokeTo(c, d, q))
  },
  up(c, d, q) {
    const m = nearestEdge(c.v.stand, d.p0)
    const [a, b] = d.moved ? strokeTo(c, d, q) : [m.a, m.b]
    c.setStroke(null)
    // A click on a drawn takdrager takes all of it; a stroke takes what it runs along
    if (d.beamId && !d.moved) return c.onEdit((x) => removeInnerBeam(x, d.beamId!))
    // Every module the stroke runs along, a shorter one too (Tøm takes a whole module)
    const keys = modulesAlong(c.mods, a, b).map((x) => x.key)
    if (keys.some((k) => c.standKeys.has(k))) c.onToast(STAND_WALL_LOCKED)
    c.onEdit((x) => eraseInnerBeams(eraseWalls(x, keys), a, b))
  },
}
