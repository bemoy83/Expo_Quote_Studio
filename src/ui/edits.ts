// What an edit stores: the change itself, then decor and free-standing textile fitted to it, and walls that close an
// area turned into a room. App's onEdit stores it; the plan's preview (docs/forhandsvisning.md) shows the same thing
// before the click, so the two never differ.
import { fitDecor } from '../domain/decor'
import { settleSwings, shutsDoor } from '../domain/doors'
import { newlyClosedRooms, wallsToRoom } from '../domain/enclosures'
import { fitShelves } from '../domain/shelves/edit'
import { fitFreeTextiles } from '../domain/textile/free'
import type { Motif, Point, Variant } from '../domain/types'
import { floorBoxes, place, rules } from './env'
import { findMotif } from './motifs'

/** A decal's width over height, by motif; 0 for an unknown motif. */
export const ratioFor = (motifs: Motif[] | undefined) => (id: string | undefined) => findMotif(motifs, id)?.ratio ?? 0

/** The change with decor, free-standing textile and shelves fitted to it, and doors turned to a side with free floor (D7). */
export const settle = (x: Variant, ratio: (id: string | undefined) => number) =>
  settleSwings(fitShelves(fitFreeTextiles(fitDecor(x, rules, ratio), rules), rules), place.swings, floorBoxes)

/** `fn` on v settled, or v itself when it would leave a door with no free floor on either side (Byggeregel D7). */
export function guarded(v: Variant, fn: (v: Variant) => Variant, ratio: (id: string | undefined) => number): Variant {
  const after = settle(fn(v), ratio)
  return shutsDoor(v, after, place.swings, floorBoxes) ? v : after
}

/** Areas the walls of `after` close that `before` did not, made into rooms (null when there are none). */
export function closeRooms(before: Variant, after: Variant, ratio: (id: string | undefined) => number): { v: Variant; areas: Point[][] } | null {
  const areas = newlyClosedRooms(before, after)
  return areas.length ? { v: roomsFrom(after, areas, ratio), areas } : null
}

/** The areas made into rooms on x, decor and shelves fitted again. */
export const roomsFrom = (x: Variant, areas: Point[][], ratio: (id: string | undefined) => number) =>
  fitShelves(fitDecor(areas.reduce((y, o) => wallsToRoom(y, o) ?? y, x), rules, ratio), rules)

/** What onEdit with history stores for `fn` on v. */
export function editResult(v: Variant, fn: (v: Variant) => Variant, motifs: Motif[] | undefined): Variant {
  const ratio = ratioFor(motifs)
  const after = guarded(v, fn, ratio)
  return closeRooms(v, after, ratio)?.v ?? after
}
