// What is selected in the plan (and 3D): one wall, room, object, frame, decal, door, beam or lane, and the wall face shown.
import { removeFoil } from '../../domain/decor'
import { doorFace, removeOpening } from '../../domain/doors'
import type { FaceSide } from '../../domain/faces'
import { removeLane } from '../../domain/floor/edit'
import { removeFill } from '../../domain/floor/rollFill'
import { removeInnerBeam } from '../../domain/innerBeams'
import { removeObject } from '../../domain/objects'
import { removeRoom } from '../../domain/rooms'
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
  /** A door or curtain, chosen in the wall drawer of the wall it stands in. */
  openingId?: string
  /** A lane of engangsteppe placed on its own: its top left cell. */
  lane?: { i: number; j: number }
  /** Engangsteppe laid by Fyll (domain/floor/rollFill.ts). */
  fill?: string
}

/** The wall a chosen door stands in, on the face its drawer showed: the wall drawer with colour and graphics. */
export function doorWall(v: Variant, sel: PlanSelection): PlanSelection {
  const o = v.openings.find((x) => x.id === sel.openingId)
  const w = o && v.walls.find((x) => x.id === o.wallId)
  return o && w ? { wallId: w.id, side: sel.side ?? doorFace(v, w, o) } : {}
}

/** Delete (or Backspace) on the selection: what it removes, and what is selected after. Null when nothing is removed. */
export function deleteSelection(v: Variant, sel: PlanSelection): { edit: (v: Variant) => Variant; select: PlanSelection } | null {
  const { lane, fill, textileId, foilId, freeTextileId, beamId, roomId, openingId, objectId } = sel
  if (fill) return { edit: (x) => removeFill(x, fill), select: {} }
  if (lane) return { edit: (x) => removeLane(x, lane), select: {} }
  // A frame or decal: the wall drawer stays on its face
  if (textileId) return { edit: (x) => removeTextile(x, textileId), select: { wallId: sel.wallId, side: sel.side } }
  if (foilId) return { edit: (x) => removeFoil(x, foilId), select: { wallId: sel.wallId, side: sel.side } }
  if (freeTextileId) return { edit: (x) => removeFreeTextile(x, freeTextileId), select: {} }
  if (beamId) return { edit: (x) => removeInnerBeam(x, beamId), select: {} }
  if (roomId) return { edit: (x) => removeRoom(x, roomId), select: {} }
  // The wall drawer stays open on the wall the door stood in
  if (openingId) return { edit: (x) => removeOpening(x, openingId), select: doorWall(v, sel) }
  if (objectId) return { edit: (x) => removeObject(x, objectId), select: {} }
  return null
}
