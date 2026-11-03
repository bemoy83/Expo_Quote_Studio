// What is selected in the plan (and 3D): one wall, room, object, frame, decal, door, beam or lane, and the wall face shown.
import type { FaceSide } from '../../domain/faces'
import type { FaceKey } from '../../domain/textile/free'

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
