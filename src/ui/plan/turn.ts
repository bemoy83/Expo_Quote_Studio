// A quarter turn of the selected furniture, inner wall or frittstående tekstilvegg: from the selection pill and the R
// key (docs/pille-og-skuff.md). When it cannot turn, nothing changes and a toast says why.
import { rotateObject } from '../../domain/objects'
import { rotateFreeTextile } from '../../domain/textile/free'
import { alone, groupOf, groupSize, type Part } from '../../domain/joints'
import { turnGroup } from '../../domain/groupGrips'
import type { Variant } from '../../domain/types'
import { canMoveWall } from '../../domain/edit'
import type { PlanSelection } from './selection'
import { place, rules } from '../env'

interface Turn {
  v: Variant
  onEdit: (fn: (v: Variant) => Variant) => void
  onToast: (text: string) => void
}

export function turnObject(p: Turn, id: string) {
  const next = rotateObject(p.v, place, id)
  if (!next) return p.onToast('Ikke plass til å rotere møbelet her')
  p.onEdit(() => next)
}

/**
 * An inner wall or a free-standing textile wall turned 90° round the middle, the same way for both (Bjørn 21.11.2026).
 * Joined to other parts it turns with them, as the turn grip does (Byggeregel M6); «Løsne» (`loose`) turns it alone.
 */
export function turnPart(p: Turn, part: Part, loose = false) {
  const g = loose ? alone(part) : groupOf(p.v, part)
  const what = part.kind === 'wall' ? 'Veggen' : 'Tekstilveggen'
  if (g.anchored) return p.onToast(`${what} er koblet til en vegg som står fast · Løsne den først`)
  if (part.kind === 'textile' && groupSize(g) < 2) {
    const r = rotateFreeTextile(p.v, rules, part.id)
    if ('error' in r) return p.onToast(r.error)
    return p.onEdit(() => r.v)
  }
  const next = turnGroup(p.v, rules, g, 1)
  if (!next) return p.onToast('Ikke plass til å rotere her')
  p.onEdit(() => next)
}

/** The selection is a whole inner wall that moves (not a door, frame, decal, shelf or felt on it): R turns it. */
export function turnableWall(v: Variant, s: PlanSelection): boolean {
  if (!s.wallId || s.openingId || s.textileId || s.foilId || s.shelfId || s.felt !== undefined) return false
  const w = v.walls.find((x) => x.id === s.wallId)
  return !!w && canMoveWall(w)
}
