// A straight stroke on the wall grid: walls with the wall pen, drawn takdragere with the beam pen, or the eraser.
import { eraseWalls, paintWalls } from '../../../domain/edit'
import { segmentKeys } from '../../../domain/grid'
import { drawInnerBeam, eraseInnerBeams } from '../../../domain/innerBeams'
import type { Point } from '../../../domain/types'
import { rules } from '../../env'
import { nearestEdge, strokeFrom } from '../geometry'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

/** Stand walls separate exhibitors and follow the stand type: erasing them is refused. */
const STAND_WALL_LOCKED = 'Standvegger følger standtypen og kan ikke fjernes'

export function startStroke(c: PointerCtx, q: P): Drag {
  const e0 = nearestEdge(c.v.stand, q)
  c.setStroke([e0.a, e0.b])
  return { kind: 'stroke', p0: q, moved: false }
}

export const stroke: DragHandlers<'stroke'> = {
  move(c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > 0.35) d.moved = true
    if (d.moved) c.setStroke(strokeFrom(c.v.stand, d.p0, q, rules.wall.cc))
  },
  up(c, d, q) {
    const { v, tool, brush } = c
    const [a, b] = d.moved
      ? strokeFrom(v.stand, d.p0, q, rules.wall.cc)
      : (() => {
          const m = nearestEdge(v.stand, d.p0)
          return [m.a, m.b] as [Point, Point]
        })()
    c.setStroke(null)
    if (c.pens.beamTool && tool === 'erase') c.onEdit((x) => eraseInnerBeams(x, a, b))
    else if (c.pens.beamTool) {
      const r = drawInnerBeam(v, a, b, c.standardRuns)
      if ('error' in r) return c.onToast(r.error)
      c.onEdit(() => r.v)
    } else if (tool === 'erase') {
      // The plain eraser takes drawn takdrager on the stroke too
      const keys = segmentKeys(a, b)
      if (keys.some((k) => c.standKeys.has(k))) c.onToast(STAND_WALL_LOCKED)
      c.onEdit((x) => eraseInnerBeams(eraseWalls(x, keys), a, b))
    } else if (brush?.kind === 'wall') c.onEdit((x) => paintWalls(x, a, b, brush.ral))
  },
}
