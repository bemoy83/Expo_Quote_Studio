// What an edit stores: the change itself, then decor and free-standing textile fitted to it, and walls that close an
// area turned into a room. App's onEdit stores it; the plan's preview (docs/forhandsvisning.md) shows the same thing
// before the click, so the two never differ.
import { fitDecor } from '../domain/decor'
import { newlyClosedRooms, wallsToRoom } from '../domain/enclosures'
import { fitFreeTextiles } from '../domain/textile/free'
import type { Point, Variant } from '../domain/types'
import type { Motif } from '../persistence/file'
import { rules } from './env'
import { findMotif } from './motifs'

/** A decal's width over height, by motif; 0 for an unknown motif. */
export const ratioFor = (motifs: Motif[] | undefined) => (id: string | undefined) => findMotif(motifs, id)?.ratio ?? 0

/** The change with decor and free-standing textile fitted to it. */
export const settle = (x: Variant, ratio: (id: string | undefined) => number) => fitFreeTextiles(fitDecor(x, rules, ratio), rules)

/** Areas the walls of `after` close that `before` did not, made into rooms (null when there are none). */
export function closeRooms(before: Variant, after: Variant, ratio: (id: string | undefined) => number): { v: Variant; areas: Point[][] } | null {
  const areas = newlyClosedRooms(before, after)
  return areas.length ? { v: roomsFrom(after, areas, ratio), areas } : null
}

/** The areas made into rooms on x, decor fitted again. */
export const roomsFrom = (x: Variant, areas: Point[][], ratio: (id: string | undefined) => number) =>
  fitDecor(areas.reduce((y, o) => wallsToRoom(y, o) ?? y, x), rules, ratio)

/** What onEdit with history stores for `fn` on v. */
export function editResult(v: Variant, fn: (v: Variant) => Variant, motifs: Motif[] | undefined): Variant {
  const ratio = ratioFor(motifs)
  const after = settle(fn(v), ratio)
  return closeRooms(v, after, ratio)?.v ?? after
}
