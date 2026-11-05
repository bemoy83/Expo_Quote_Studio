// A quarter turn of the selected furniture or frittstående tekstilvegg: from the selection pill and the R key
// (docs/pille-og-skuff.md). When it cannot turn, nothing changes and a toast says why.
import { rotateObject } from '../../domain/objects'
import { rotateFreeTextile } from '../../domain/textile/free'
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
  const r = rotateFreeTextile(p.v, rules, id)
  if ('error' in r) return p.onToast(r.error)
  p.onEdit(() => r.v)
}
