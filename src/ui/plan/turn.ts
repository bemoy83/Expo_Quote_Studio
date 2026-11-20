// A quarter turn of the selected furniture or frittstående tekstilvegg: from the selection pill and the R key
// (docs/pille-og-skuff.md). When it cannot turn, nothing changes and a toast says why.
import { rotateObject } from '../../domain/objects'
import { rotateFreeTextile } from '../../domain/textile/free'
import { groupOf, groupSize } from '../../domain/joints'
import { turnGroup } from '../../domain/groupGrips'
import type { Variant } from '../../domain/types'
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

export function turnFree(p: Turn, id: string) {
  // Joined to other parts it turns with them, as the turn grip does (Byggeregel M6)
  const g = groupOf(p.v, { kind: 'textile', id })
  if (g.anchored && groupSize(g) > 1) return p.onToast('Tekstilveggen er koblet til en vegg som står fast · Løsne den først')
  if (groupSize(g) > 1) {
    const next = turnGroup(p.v, rules, g, 1)
    if (!next) return p.onToast('Ikke plass til å rotere her')
    return p.onEdit(() => next)
  }
  const r = rotateFreeTextile(p.v, rules, id)
  if ('error' in r) return p.onToast(r.error)
  p.onEdit(() => r.v)
}
