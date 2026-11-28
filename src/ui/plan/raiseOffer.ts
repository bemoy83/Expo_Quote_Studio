// Byggeregel X15: «Hev veggen til N» for a frame on a wall reaching over its top, with what it does to the quote. One
// answer for the pill (pill/RaiseOffer.tsx) and the drawer (TextileSettings), so the two never differ. Toward a
// neighbour the textile face turns white by itself (N1, `whiteToNeighbour`), so only the raise is offered.
import { useMemo } from 'react'
import { calc } from '../../calc/calc'
import { raiseFor, raiseUnder } from '../../domain/raise'
import type { Variant } from '../../domain/types'
import { DEFAULT_STAND_WALLS } from '../../domain/variant'
import { raiseTop } from '../../rules/rules'
import { catalog, pricing, rules } from '../env'
import { mm } from '../format'

export interface RaiseOffer {
  label: string
  title: string
  /** The sketch with the wall raised, the frame as it is. */
  next: Variant
  /** What it does to the quote, kr. */
  diff: number
}

/** The raise that takes textile `id` in, or null when its wall already does (or no raise is high enough). */
export function useRaiseOffer(v: Variant, id: string): RaiseOffer | null {
  return useMemo(() => {
    const len = raiseFor(v, rules, id)
    if (!len) return null
    const sum = (x: Variant) => calc(x, rules, catalog, DEFAULT_STAND_WALLS, pricing).sum
    const next = raiseUnder(v, rules, id)
    return { label: `Hev veggen til ${mm(raiseTop(len, rules) / 1000)}`, title: 'Hever veggen så den tar rammen, og skjuler baksiden mot naboen', next, diff: sum(next) - sum(v) }
  }, [v, id])
}
