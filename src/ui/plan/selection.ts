// What is selected in the plan (and 3D): one wall, room, object, frame, decal, shelf, door, beam or lane, and the wall face shown.
import { removeFoil } from '../../domain/decor'
import { doorFace, openingById, removeOpening } from '../../domain/doors'
import { faces, type FaceSide } from '../../domain/faces'
import { removeLane } from '../../domain/floor/edit'
import { removeFill } from '../../domain/floor/rollFill'
import { removeInnerBeam } from '../../domain/innerBeams'
import { removeObject } from '../../domain/objects'
import { removeRoom } from '../../domain/rooms'
import { removeShelves } from '../../domain/shelves/edit'
import { shelfRow, shelvesOf } from '../../domain/shelves/model'
import { removeFreeTextile, type FaceKey } from '../../domain/textile/free'
import { removeTextile } from '../../domain/textile/inFrame'
import type { FloorTile, Foil, FreeTextile, InnerBeam, Opening, PlacedObject, Room, Shelf, TextileWall, Variant, Wall } from '../../domain/types'

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
  /** «Fin» on in its pill: a drag moves it across in 50 mm steps, as Shift + drag does on desktop (Byggeregel T15). */
  beamFine?: boolean
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

/** What a selection is about. The one order a selection is read in: the first field set says it (a selection made by a
 *  click sets only one of these, besides the wall and face a frame, decal or shelf is on). */
export type Kind = 'fill' | 'lane' | 'textile' | 'foil' | 'shelf' | 'free' | 'beam' | 'opening' | 'object' | 'room' | 'wall'

/** The kind and id of what a selection is about, without looking it up; null when nothing is selected. */
export function kindOf(s: PlanSelection): { kind: Kind; id: string } | null {
  if (s.fill) return { kind: 'fill', id: s.fill }
  if (s.lane) return { kind: 'lane', id: `${s.lane.i},${s.lane.j}` }
  if (s.textileId) return { kind: 'textile', id: s.textileId }
  if (s.foilId) return { kind: 'foil', id: s.foilId }
  if (s.shelfId) return { kind: 'shelf', id: s.shelfId }
  if (s.freeTextileId) return { kind: 'free', id: s.freeTextileId }
  if (s.beamId) return { kind: 'beam', id: s.beamId }
  if (s.openingId) return { kind: 'opening', id: s.openingId }
  if (s.objectId) return { kind: 'object', id: s.objectId }
  if (s.roomId) return { kind: 'room', id: s.roomId }
  if (s.wallId) return { kind: 'wall', id: s.wallId }
  return null
}

/** The kinds that open in the wall drawer: the wall, and a door, frame, decal or shelf on it. */
export const ON_WALL: ReadonlySet<Kind> = new Set<Kind>(['opening', 'textile', 'foil', 'shelf', 'wall'])

/** The object a selection is about, so a second click on it can be told apart: the face shown does not count. */
export function selectionKey(s: PlanSelection): string {
  const k = kindOf(s)
  return k ? `${k.kind}:${k.id}` : ''
}

/** Whether the selection has a drawer: a wall with its doors, frames and decals, a free-standing textile wall, or
 *  engangsteppe (only under the plan). Furniture, rooms and drawn takdragere have none. */
export function hasDrawer(s: PlanSelection, view: 'plan' | '3d' = 'plan'): boolean {
  const k = kindOf(s)?.kind
  return k === 'fill' || k === 'lane' ? view === 'plan' : k === 'free' || (!!k && ON_WALL.has(k))
}

/** A wall and the face its drawer and pill act on, with what on it is chosen. */
export type OnWall = { wall: Wall; side: FaceSide } & (
  | { kind: 'opening'; opening: Opening }
  | { kind: 'textile'; textile: TextileWall }
  | { kind: 'foil'; foil: Foil }
  | { kind: 'shelf'; shelf: Shelf }
  /** The wall itself, with the felt chosen in its drawer (unchecked: the drawer knows which felts take one). */
  | { kind: 'wall'; felt?: number }
)

/** Whether what is chosen opens in the wall drawer. */
export const isOnWall = (c: Chosen | null): c is OnWall => !!c && ON_WALL.has(c.kind)

/** What is selected, looked up in the sketch: one place that reads a selection, for the pill, its anchor and the drawers. */
export type Chosen =
  | { kind: 'fill'; fill: string; tiles: FloorTile[] }
  | { kind: 'lane'; lane: { i: number; j: number }; tile: FloorTile }
  | { kind: 'room'; room: Room }
  | { kind: 'beam'; beam: InnerBeam; fine: boolean }
  | { kind: 'object'; object: PlacedObject }
  | { kind: 'free'; textile: FreeTextile; face: FaceKey }
  | OnWall

/**
 * What the selection is about in `v`, or null when it is gone (or nothing is selected). A frame, decal or shelf that is
 * gone (undone) leaves its wall chosen. The face is the one the selection names, else the one a door's drawer shows, else
 * the wall's first.
 */
export function chosen(v: Variant, sel: PlanSelection): Chosen | null {
  const k = kindOf(sel)
  if (!k) return null
  switch (k.kind) {
    case 'fill': {
      const tiles = v.floor.tiles.filter((t) => t.fill === sel.fill)
      return tiles.length ? { kind: 'fill', fill: k.id, tiles } : null
    }
    case 'lane': {
      const lane = sel.lane!
      const tile = v.floor.tiles.find((t) => t.i === lane.i && t.j === lane.j)
      return tile ? { kind: 'lane', lane, tile } : null
    }
    case 'room': {
      const room = v.rooms.find((x) => x.id === k.id)
      return room ? { kind: 'room', room } : null
    }
    case 'beam': {
      const beam = v.innerBeams?.find((x) => x.id === k.id)
      return beam ? { kind: 'beam', beam, fine: !!sel.beamFine } : null
    }
    case 'object': {
      const object = v.objects.find((x) => x.id === k.id)
      return object ? { kind: 'object', object } : null
    }
    case 'free': {
      const textile = v.freeTextiles.find((x) => x.id === k.id)
      return textile ? { kind: 'free', textile, face: sel.freeFace ?? 'a' } : null
    }
  }
  // A door is chosen without its wall: it stands in its own
  const opening = k.kind === 'opening' ? openingById(v, k.id) : undefined
  const wall = v.walls.find((x) => x.id === (opening?.wallId ?? sel.wallId))
  if (!wall) return null
  const fs = faces(v, wall)
  const want = sel.side ?? (opening && doorFace(v, wall, opening))
  const side = want && fs.includes(want) ? want : fs[0]
  if (opening) return { kind: 'opening', wall, side, opening }
  const textile = sel.textileId ? v.textiles.find((x) => x.id === sel.textileId && x.wallId === wall.id) : undefined
  if (textile) return { kind: 'textile', wall, side, textile }
  const foil = sel.foilId ? v.foils.find((x) => x.id === sel.foilId && x.wallId === wall.id) : undefined
  if (foil) return { kind: 'foil', wall, side, foil }
  const shelf = sel.shelfId ? shelvesOf(v).find((x) => x.id === sel.shelfId && x.wallId === wall.id) : undefined
  if (shelf) return { kind: 'shelf', wall, side, shelf }
  return { kind: 'wall', wall, side, felt: sel.felt }
}

/** The wall a chosen door stands in, on the face its drawer showed: the wall drawer with colour and graphics. */
export function doorWall(v: Variant, sel: PlanSelection): PlanSelection {
  const o = v.openings.find((x) => x.id === sel.openingId)
  const w = o && v.walls.find((x) => x.id === o.wallId)
  return o && w ? { wallId: w.id, side: sel.side ?? doorFace(v, w, o) } : {}
}

/** Delete (or Backspace) on the selection: what it removes, and what is selected after. Null when nothing is removed. */
export function deleteSelection(v: Variant, sel: PlanSelection): { edit: (v: Variant) => Variant; select: PlanSelection } | null {
  const k = kindOf(sel)
  // A frame, decal or shelf: the wall drawer stays on its face
  const onFace = { wallId: sel.wallId, side: sel.side }
  switch (k?.kind) {
    case 'fill':
      return { edit: (x) => removeFill(x, k.id), select: {} }
    case 'lane':
      return { edit: (x) => removeLane(x, sel.lane!), select: {} }
    case 'textile':
      return { edit: (x) => removeTextile(x, k.id), select: onFace }
    case 'foil':
      return { edit: (x) => removeFoil(x, k.id), select: onFace }
    case 'shelf':
      return { edit: (x) => removeShelves(x, chosenShelves(x, sel)), select: onFace }
    case 'free':
      return { edit: (x) => removeFreeTextile(x, k.id), select: {} }
    case 'beam':
      return { edit: (x) => removeInnerBeam(x, k.id), select: {} }
    case 'room':
      return { edit: (x) => removeRoom(x, k.id), select: {} }
    // The wall drawer stays open on the wall the door stood in
    case 'opening':
      return { edit: (x) => removeOpening(x, k.id), select: doorWall(v, sel) }
    case 'object':
      return { edit: (x) => removeObject(x, k.id), select: {} }
    default:
      return null
  }
}

/** The shelves a selection acts on: the chosen shelf's row, or only that shelf with `shelfOnly` (Bjørn 9.11.2026). */
export function chosenShelves(v: Variant, sel: PlanSelection): string[] {
  if (!sel.shelfId) return []
  return sel.shelfOnly ? [sel.shelfId] : shelfRow(v, sel.shelfId).map((x) => x.id)
}
