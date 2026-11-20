// Velg on a textile wall mounted on a system wall (Byggeregel X13): a drag out from the wall takes it off, standing
// free on foot plates where it is let go; a drag along the wall moves it along its face. A click selects it.
import { moveTextileBy } from '../../../domain/textile/inFrame'
import { unmountDrag } from '../../../domain/textile/mount'
import { wallDirection } from '../../../domain/grid'
import { rules } from '../../env'
import type { DragHandlers } from './types'
import { wallTextiles } from '../../../domain/textile/mounts'

export const textileOff: DragHandlers<'textileOff'> = {
  move(c, d, q) {
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 0.15) return
    if (!d.moved) c.onCheckpoint()
    d.moved = true
    const dx = q.x - d.p0.x
    const dy = q.y - d.p0.y
    const r = unmountDrag(d.v0, rules, d.id, dx, dy)
    if (r && !('error' in r)) {
      d.freeId = r.id
      d.heightKept = r.heightKept
      c.onEdit(() => r.v, false)
      return
    }
    d.freeId = undefined
    // Along its face, on the textile grid
    const t = wallTextiles(d.v0).find((x) => x.id === d.id)
    const w = t && d.v0.walls.find((x) => x.id === t.wallId)
    if (!t || !w) return
    const [ux, uy] = wallDirection(w)
    const g = rules.textile.grid
    const dt = Math.round((dx * ux + dy * uy) / g) * g
    c.onEdit(() => moveTextileBy(d.v0, rules, t, dt, 0), false)
  },
  up(c, d) {
    if (!d.moved) return c.clickSelect(d.select)
    if (!d.freeId) return c.onSelect(d.select)
    c.onSelect({ freeTextileId: d.freeId })
    if (!d.heightKept) c.onToast('Tekstilveggen står nå på fotplater i full høyde, 2540: andre høyder på fotplater kommer senere')
  },
}
