// Notes a pill adds to its meta line, shared by the pills of walls and textile walls.
import { neighbourNotes, noteFor } from '../../../domain/neighbour'
import type { Variant } from '../../../domain/types'
import { rules } from '../../env'

/** Byggeregel N1: a tall thing near a neighbour says so in its pill. */
export const withNeighbour = (v: Variant, id: string, meta: string) => {
  const n = noteFor(neighbourNotes(v, rules), id)
  // Short in the pill, where it shares the row with the palette (Bjørn 28.11.2026); the whole reason is in the drawer's hint
  return n ? `${meta} · nabogodkjenning` : meta
}
