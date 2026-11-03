// The door and curtain pen: a click on a wall module sets or erases its opening; on an empty edge it draws its own wall.
import { doorAllowed } from '../../../domain/walls'
import { drawOpening, setOpening } from '../../../domain/doors'
import { nearestEdge } from '../geometry'
import type { P, PointerCtx } from './types'

/** The wall module or empty stand edge the pen would act on. */
export function openingEdge(c: Pick<PointerCtx, 'v' | 'tool' | 'hits'>, q: P) {
  return c.hits.moduleAt(q, 0.4) ?? (c.tool !== 'erase' && c.hits.onStand(q) ? nearestEdge(c.v.stand, q) : null)
}

export function openingClick(c: PointerCtx, q: P) {
  const { v, tool, brush } = c
  if (brush?.kind !== 'opening') return
  const m = c.hits.moduleAt(q, 0.4)
  const e = openingEdge(c, q)
  if (!e) return
  if (tool !== 'erase' && !doorAllowed(v, e.a, e.b)) c.onToast('Dører og forheng kan ikke stå i standveggen')
  else if (m) c.onEdit((x) => setOpening(x, m.key, tool === 'erase' ? null : brush.product))
  // No wall there: the door or curtain draws its own wall module
  else c.onEdit((x) => drawOpening(x, e.a, e.b, brush.product))
}
