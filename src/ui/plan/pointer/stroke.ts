// Tøm along walls and drawn takdragere (erase.ts): a straight stroke on the wall grid, in whole modules; along a wall
// off the metre lines (V9) on its line in 250. The pens that
// draw a run (wall, takdrager) use the drawing tool in run.ts.
import { eraseWalls } from '../../../domain/edit'
import { modulesAlong } from '../../../domain/grid'
import { eraseInnerBeams, removeInnerBeam } from '../../../domain/innerBeams'
import type { Point } from '../../../domain/types'
import { rules } from '../../env'
import { strokeFrom } from '../../../domain/snapGrid'
import { distToSegment, nearestEdge } from '../geometry'
import type { DragHandlers, Drag, P, PointerCtx } from './types'

/** Stand walls separate exhibitors and follow the stand type: erasing them is refused. */
const STAND_WALL_LOCKED = 'Standvegger følger standtypen og kan ikke fjernes'

/** `beamId`: pressed on a drawn takdrager, so a click takes all of it. */
export function startStroke(c: PointerCtx, q: P, beamId?: string): Drag {
  // On a wall off the metre grid (V9) the stroke starts on its line and runs in 250
  const off = offGridAt(c, q)
  const p0 = off ?? q
  const e0 = nearestEdge(c.v.stand, p0, off ? FINE : 1)
  c.setStroke([e0.a, e0.b])
  return { kind: 'stroke', p0, moved: false, beamId, ...(off && { fine: true }) }
}

/** The 250 grid a stroke runs on along a wall off the metre lines. */
const FINE = 0.25
/** How near a wall the pointer must be to take it, m. */
const NEAR = 0.2
const whole = (n: number) => Math.abs(n - Math.round(n)) < 1e-6

/** Where q lies on the nearest wall module that is off the metre grid, when it is that near; else null. */
function offGridAt(c: PointerCtx, q: P): P | null {
  let best: { d: number; p: P } | null = null
  for (const m of c.mods) {
    if ([...m.a, ...m.b].every(whole)) continue
    const d = distToSegment(q, m.a, m.b)
    if (d > NEAR || (best && d >= best.d)) continue
    best = { d, p: m.orientation === 'h' ? { x: q.x, y: m.a[1] } : { x: m.a[0], y: q.y } }
  }
  return best?.p ?? null
}

const strokeTo = (c: PointerCtx, d: Extract<Drag, { kind: 'stroke' }>, q: P): [Point, Point] =>
  d.fine ? strokeFrom(c.v.stand, d.p0, q, FINE, FINE) : strokeFrom(c.v.stand, d.p0, q, rules.wall.cc)

export const stroke: DragHandlers<'stroke'> = {
  move(c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > 0.35) d.moved = true
    if (d.moved) c.setStroke(strokeTo(c, d, q))
  },
  up(c, d, q) {
    const m = nearestEdge(c.v.stand, d.p0, d.fine ? FINE : 1)
    const [a, b] = d.moved ? strokeTo(c, d, q) : [m.a, m.b]
    c.setStroke(null)
    // A click on a drawn takdrager takes all of it; a stroke takes what it runs along
    if (d.beamId && !d.moved) return c.onEdit((x) => removeInnerBeam(x, d.beamId!))
    // Every module the stroke runs along, a shorter one too, and the whole module a part was split from (Tøm takes a
    // whole module)
    const keys = [...new Set(modulesAlong(c.mods, a, b).map((x) => x.whole ?? x.key))]
    if (keys.some((k) => c.standKeys.has(k))) c.onToast(STAND_WALL_LOCKED)
    // Takdrager lie on the metre lines: a stroke in 250 along a wall off them leaves them be
    c.onEdit((x) => (d.fine ? eraseWalls(x, keys) : eraseInnerBeams(eraseWalls(x, keys), a, b)))
  },
}
