// What is selected in the plan (and 3D): one wall, room, object, frame, decal, shelf, door, beam or lane, and the wall face shown.
import { removeFoil } from '../../domain/decor'
import { doorFace, removeOpening } from '../../domain/doors'
import type { FaceSide } from '../../domain/faces'
import { removeLane } from '../../domain/floor/edit'
import { removeFill } from '../../domain/floor/rollFill'
import { removeInnerBeam } from '../../domain/innerBeams'
import { removeObject } from '../../domain/objects'
import { removeRoom } from '../../domain/rooms'
import { removeShelves } from '../../domain/shelves/edit'
import { shelfRow } from '../../domain/shelves/model'
import { removeFreeTextile, type FaceKey } from '../../domain/textile/free'
import { removeTextile } from '../../domain/textile/inFrame'
import type { Variant } from '../../domain/types'

export interface PlanSelection {
  wallId?: string
  roomId?: string
  objectId?: string
  /** Wall face shown in the wall drawer. */
  side?: FaceSide
  textileId?: string
  foilId?: string
  /** A frittstående tekstilvegg, and the face shown in its drawer. */
  freeTextileId?: string
  freeFace?: FaceKey
  /** An innvendig takdrager. */
  beamId?: string
  /** A shelf (hylle 6311), chosen in the wall drawer of its wall, on its face. With it comes its row (the shelves beside it
   *  at its height), unless `shelfOnly`: then only this one (chosenShelves). */
  shelfId?: string
  shelfOnly?: boolean
  /** A felt (module) of the wall, chosen in the wall drawer to put shelves in it (Bjørn 9.11.2026). Only with `wallId`. */
  felt?: number
  /** A door or curtain, chosen in the wall drawer of the wall it stands in. */
  openingId?: string
  /** A lane of engangsteppe placed on its own: its top left cell. */
  lane?: { i: number; j: number }
  /** Engangsteppe laid by Fyll (domain/floor/rollFill.ts). */
  fill?: string
}

/** How the drawer under the plan stands: closed, or open in one of its two heights (docs/pille-og-skuff.md). A plain
 *  click only selects; Mer in the pill opens it. */
export type DrawerState = 'closed' | 'compact' | 'detail'

/** The object a selection is about, so a second click on it can be told apart: the face shown does not count. */
export function selectionKey(s: PlanSelection): string {
  if (s.fill) return `fill:${s.fill}`
  if (s.lane) return `lane:${s.lane.i},${s.lane.j}`
  if (s.textileId) return `textile:${s.textileId}`
  if (s.foilId) return `foil:${s.foilId}`
  if (s.shelfId) return `shelf:${s.shelfId}`
  if (s.freeTextileId) return `free:${s.freeTextileId}`
  if (s.beamId) return `beam:${s.beamId}`
  if (s.openingId) return `opening:${s.openingId}`
  if (s.objectId) return `object:${s.objectId}`
  if (s.roomId) return `room:${s.roomId}`
  if (s.wallId) return `wall:${s.wallId}`
  return ''
}

/** Whether the selection has a drawer: a wall with its doors, frames and decals, a free-standing textile wall, or
 *  engangsteppe (only under the plan). Furniture, rooms and drawn takdragere have none. */
export function hasDrawer(s: PlanSelection, view: 'plan' | '3d' = 'plan'): boolean {
  return !!(s.wallId || s.openingId || s.freeTextileId || ((s.lane || s.fill) && view === 'plan'))
}

/** The wall a chosen door stands in, on the face its drawer showed: the wall drawer with colour and graphics. */
export function doorWall(v: Variant, sel: PlanSelection): PlanSelection {
  const o = v.openings.find((x) => x.id === sel.openingId)
  const w = o && v.walls.find((x) => x.id === o.wallId)
  return o && w ? { wallId: w.id, side: sel.side ?? doorFace(v, w, o) } : {}
}

/** Delete (or Backspace) on the selection: what it removes, and what is selected after. Null when nothing is removed. */
export function deleteSelection(v: Variant, sel: PlanSelection): { edit: (v: Variant) => Variant; select: PlanSelection } | null {
  const { lane, fill, textileId, foilId, shelfId, freeTextileId, beamId, roomId, openingId, objectId } = sel
  if (fill) return { edit: (x) => removeFill(x, fill), select: {} }
  if (lane) return { edit: (x) => removeLane(x, lane), select: {} }
  // A frame or decal: the wall drawer stays on its face
  if (textileId) return { edit: (x) => removeTextile(x, textileId), select: { wallId: sel.wallId, side: sel.side } }
  if (foilId) return { edit: (x) => removeFoil(x, foilId), select: { wallId: sel.wallId, side: sel.side } }
  if (shelfId) return { edit: (x) => removeShelves(x, chosenShelves(x, sel)), select: { wallId: sel.wallId, side: sel.side } }
  if (freeTextileId) return { edit: (x) => removeFreeTextile(x, freeTextileId), select: {} }
  if (beamId) return { edit: (x) => removeInnerBeam(x, beamId), select: {} }
  if (roomId) return { edit: (x) => removeRoom(x, roomId), select: {} }
  // The wall drawer stays open on the wall the door stood in
  if (openingId) return { edit: (x) => removeOpening(x, openingId), select: doorWall(v, sel) }
  if (objectId) return { edit: (x) => removeObject(x, objectId), select: {} }
  return null
}

/** The shelves a selection acts on: the chosen shelf's row, or only that shelf with `shelfOnly` (Bjørn 9.11.2026). */
export function chosenShelves(v: Variant, sel: PlanSelection): string[] {
  if (!sel.shelfId) return []
  return sel.shelfOnly ? [sel.shelfId] : shelfRow(v, sel.shelfId).map((x) => x.id)
}
