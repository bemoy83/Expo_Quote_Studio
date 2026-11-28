// What an edit stores: the change itself, then decor and free-standing textile fitted to it, the plates' own colours carried along, and walls that close an
// area turned into a room. App's onEdit stores it; the plan's preview (docs/forhandsvisning.md) shows the same thing
// before the click, so the two never differ.
import { fitDecor } from '../domain/decor'
import { facesNeighbour, neighbourDistance, neighbourNotes, whiteToNeighbour } from '../domain/neighbour'
import { sideOf } from '../domain/faces'
import { fitBreaks } from '../domain/replaceWalls'
import { DOOR_NO_SWING, settleSwings, shutsDoor } from '../domain/doors'
import { newFootClash } from '../calc/footPlates'
import { newlyClosedRooms, wallsToRoom } from '../domain/enclosures'
import { carryDecor } from '../domain/plateDecor'
import { carryTextiles, freeTextiles, settleCorners } from '../domain/textile/mounts'
import { framesInObjects, furnitureOnPlates } from '../domain/objects'
import { fitShelves } from '../domain/shelves/edit'
import { blocked, fitFreeTextiles, joinFreeToFrames } from '../domain/textile/free'
import type { Motif, Point, Variant } from '../domain/types'
import { floorBoxes, floorOfVariant, footPlatesOf, place, rules } from './env'
import { findMotif } from './motifs'

/** A decal's width over height, by motif; 0 for an unknown motif. */
export const ratioFor = (motifs: Motif[] | undefined) => (id: string | undefined) => findMotif(motifs, id)?.ratio ?? 0

/** The change with walls laid out round their doors (D8), decor, frames in corners joined (X7) also with free-standing runs ending at them (X11), free-standing textile and shelves fitted to it, textile faces toward a near neighbour white (N1), and doors turned to a side with free floor (D7). */
export const settle = (x: Variant, ratio: (id: string | undefined) => number) =>
  settleSwings(whiteToNeighbour(fitShelves(fitFreeTextiles(joinFreeToFrames(settleCorners(fitDecor(fitBreaks(x), rules, ratio))), rules), rules), rules).v, place.swings, floorBoxes)

/** `fn` on v, the textile walls mounted on walls it moved taken along (Byggeregler X13, M1). */
const edited = (v: Variant, fn: (v: Variant) => Variant) => carryTextiles(v, fn(v))

/** `fn` on v settled and the plates' decor carried to where they went, or v itself when it would leave a door with no
 *  free floor on either side (Byggeregel D7), or put a free-standing textile wall where something stands (F1, F2). */
export function guarded(v: Variant, fn: (v: Variant) => Variant, ratio: (id: string | undefined) => number): Variant {
  const raw = edited(v, fn)
  const after = carryDecor(v, settle(raw, ratio))
  return shutsDoor(v, after, place.swings, floorBoxes) || physical(v, raw, after) ? v : after
}

/** Byggeregler F1, F2: why `after` puts a free-standing textile wall where something already stands, that `before` did
 *  not: its frame in a counter or furniture, or its foot plates on a plate or foot. Null when nothing new is in the way. */
function physical(before: Variant, raw: Variant, after: Variant): string | null {
  if (before === raw) return null
  // A textile wall the edit would put a wall in or through (F1) is not taken away: the edit stops (Bjørn 21.11.2026)
  const stood = new Set(freeTextiles(before).filter((t) => !blocked(before, rules, t, freeTextiles(before).filter((o) => o.id !== t.id))).map((t) => t.id))
  for (const t of freeTextiles(raw)) {
    if (!stood.has(t.id)) continue
    const why = blocked(raw, rules, t, freeTextiles(raw).filter((o) => o.id !== t.id))
    if (why) return why
  }
  const was = new Set(framesInObjects(before, place))
  if (framesInObjects(after, place).some((id) => !was.has(id))) return 'Tekstilveggen står i en disk eller et møbel'
  // Furniture on a foot plate (F2): only worked out when there is furniture, as it lays out every plate
  if (after.objects.some((o) => !o.sections && !place.isCounter(o.product))) {
    const sat = new Set(furnitureOnPlates(before, place, footPlatesOf(before)))
    if (furnitureOnPlates(after, place, footPlatesOf(after)).some((id) => !sat.has(id))) return 'Fotplatene treffer et møbel'
  }
  return newFootClash(floorOfVariant(before), floorOfVariant(after))
}

/** Why `fn` on v is refused, said in a toast: a door left without free floor (D7), a textile wall where something
 *  stands (F1, F2); or null. */
export function refused(v: Variant, fn: (v: Variant) => Variant, ratio: (id: string | undefined) => number): string | null {
  const raw = edited(v, fn)
  const after = settle(raw, ratio)
  if (shutsDoor(v, after, place.swings, floorBoxes)) return DOOR_NO_SWING
  return physical(v, raw, after)
}

/** Why `fn` on v is refused (`refused`), or else what Byggeregel N1 did to it on its own: textile faces toward a near
 *  neighbour turned white, print and decals taken off upper felts facing one. Null when neither, for the toast. */
export function editNote(v: Variant, fn: (v: Variant) => Variant, ratio: (id: string | undefined) => number): string | null {
  const raw = edited(v, fn)
  const after = settle(raw, ratio)
  if (shutsDoor(v, after, place.swings, floorBoxes)) return DOOR_NO_SWING
  return physical(v, raw, after) ?? (after === v ? null : neighbourNote(v, after))
}

/** What N1 changed from `before` to `after` by itself, said in a toast; null when nothing. */
export function neighbourNote(before: Variant, after: Variant): string | null {
  const white = neighbourNotes(after, rules).filter((n) => {
    if (!n.face) return false
    const t = before.textiles.find((x) => x.id === n.id)
    return !!t && t[n.face]?.fill !== 'white'
  }).length
  const gone = before.foils.filter((f) => f.upper && facesNeighbour(after, rules, f.wallId, sideOf(before, f)) && !after.foils.some((g) => g.id === f.id)).length
  const parts = [white ? 'siden mot naboen blir hvit duk' : '', gone ? 'print og dekal mot naboen er tatt bort' : ''].filter(Boolean)
  return parts.length ? `Nærmere naboen enn ${neighbourDistance(rules)}: ${parts.join(', ')}` : null
}

/** Areas the walls of `after` close that `before` did not, made into rooms (null when there are none). */
export function closeRooms(before: Variant, after: Variant, ratio: (id: string | undefined) => number): { v: Variant; areas: Point[][] } | null {
  const areas = newlyClosedRooms(before, after)
  return areas.length ? { v: roomsFrom(after, areas, ratio), areas } : null
}

/** The areas made into rooms on x, decor and shelves fitted again, the plates' decor carried to the room sides. */
export const roomsFrom = (x: Variant, areas: Point[][], ratio: (id: string | undefined) => number) =>
  carryDecor(x, fitShelves(fitDecor(areas.reduce((y, o) => wallsToRoom(y, o) ?? y, x), rules, ratio), rules))

/** What onEdit with history stores for `fn` on v. */
export function editResult(v: Variant, fn: (v: Variant) => Variant, motifs: Motif[] | undefined): Variant {
  const ratio = ratioFor(motifs)
  const after = guarded(v, fn, ratio)
  return closeRooms(v, after, ratio)?.v ?? after
}
