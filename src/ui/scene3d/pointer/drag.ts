// Velg in the 3D view, as in the plan: a press picks what to drag (decor or a shelf on its face, furniture, a room, an
// inner wall), a move drags it, a release drops it or, without moving, selects what was pressed. Anything else orbits
// the camera.
import { moveFoilBy } from '../../../domain/decor'
import { canMoveWall } from '../../../domain/edit'
import { sideOf, type FaceSide } from '../../../domain/faces'
import { moveObject } from '../../../domain/objects'
import { faceOfPoint } from '../../../domain/textile/free'
import { moveTextileBy } from '../../../domain/textile/inFrame'
import { dragShelves, shelfHeight, shelfRow, shelvesOf } from '../../../domain/shelves'
import type { Foil, Shelf, TextileWall, Variant, Wall } from '../../../domain/types'
import { dragRoom, dragWall, dropObject, dropRoom, roomDrag, type RoomDrag, type WallDrag } from '../../drag'
import { place, rules } from '../../env'
import { findMotif } from '../../motifs'
import type { Motif } from '../../../persistence/file'
import { chosenShelves, type PlanSelection } from '../../plan/selection'
import type { Hit, SceneHits } from './hits'

/** What the 3D view hands the pointer: the model now, and how to change it. */
export interface PointerProps {
  v: Variant
  selection: PlanSelection
  onSelect: (s: PlanSelection) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onCheckpoint: () => void
  onToast: (text: string) => void
  motifs: Motif[]
}

export type Drag =
  | { kind: 'orbit' }
  | { kind: 'object'; id: string; start: { x: number; y: number }; off: { x: number; y: number }; moved: boolean }
  | ({ kind: 'wall'; moved: boolean } & WallDrag)
  /** A room: moved, or one side dragged. Tracked on a level plane at the height it was grabbed. */
  | ({ kind: 'room'; y: number } & RoomDrag)
  /** A textile or foil dragged on its face: deltas from where it was grabbed (t along the wall, h up). */
  | { kind: 'decor'; item: { textile: TextileWall } | { foil: Foil }; w: Wall; s: FaceSide; t0: number; h0: number; moved: boolean }
  /** A shelf dragged on its face: up and down in 50 mm steps, sideways felt by felt (as in the wall drawer). */
  | { kind: 'shelf'; shelf: Shelf; ids: string[]; w: Wall; s: FaceSide; t0: number; h0: number; moved: boolean }

/** Pointer moves under this many px are a click. */
export const CLICK_PX = 4

/** What a press on `hit` starts dragging; orbit when it is nothing that moves. */
export function startDrag(P: PointerProps, hits: SceneHits, hit: Hit | null, e: PointerEvent): Drag {
  const deco = hit?.textileId ? P.v.textiles.find((x) => x.id === hit.textileId) : hit?.foilId ? P.v.foils.find((x) => x.id === hit.foilId) : undefined
  const w = deco && P.v.walls.find((x) => x.id === deco.wallId)
  const sh = hit?.shelfId ? shelvesOf(P.v).find((x) => x.id === hit.shelfId) : undefined
  const sw = sh && P.v.walls.find((x) => x.id === sh.wallId)
  if (sh && sw) {
    const s = sideOf(P.v, sh)
    const q = hits.onFace(e, sw, s)
    // The chosen shelves go with it when it is one of them, else its row (Bjørn 9.11.2026)
    const chosen = chosenShelves(P.v, P.selection)
    const ids = chosen.includes(sh.id) ? chosen : shelfRow(P.v, sh.id).map((x) => x.id)
    if (q) return { kind: 'shelf', shelf: sh, ids, w: sw, s, t0: q.t, h0: q.h, moved: false }
  }
  if (deco && w) {
    const s = sideOf(P.v, deco)
    const q = hits.onFace(e, w, s)
    if (q) return { kind: 'decor', item: 'from' in deco ? { textile: deco } : { foil: deco }, w, s, t0: q.t, h0: q.h, moved: false }
  } else if (hit?.objectId) {
    const o = P.v.objects.find((x) => x.id === hit.objectId)
    const q = hits.onFloor(e)
    if (o && q) return { kind: 'object', id: o.id, start: { x: o.x, y: o.y }, off: { x: q.x - o.x, y: q.y - o.y }, moved: false }
  } else if (hits.sideAt(hit) || hit?.roomId || P.v.walls.find((x) => x.id === hit?.wallId)?.room) {
    // The top of a room side resizes the room; its roof or its own wall moves it
    const side = hits.sideAt(hit)
    const w = P.v.walls.find((x) => x.id === hit!.wallId)
    const id = side?.room.id ?? hit!.roomId ?? w!.room!.id
    const mode = side?.side ?? 'move'
    const y = hit!.point.y
    const q = hits.onFloor(e, y)
    if (q) return { kind: 'room', ...roomDrag(id, mode, q, P.v), y }
  } else if (hit?.wallId) {
    const w = P.v.walls.find((x) => x.id === hit.wallId)
    const q = hits.onFloor(e)
    if (w && q && canMoveWall(w)) return { kind: 'wall', id: w.id, p0: q, v0: P.v, delta: '0,0', horizontal: w.from[1] === w.to[1], moved: false }
  }
  return { kind: 'orbit' }
}

/** A move of a drag that has gone past the click distance. */
export function moveDrag(P: PointerProps, hits: SceneHits, drag: Exclude<Drag, { kind: 'orbit' }>, e: PointerEvent) {
  if (drag.kind === 'decor') {
    const f = hits.onFace(e, drag.w, drag.s)
    if (!f) return
    if (!drag.moved) P.onCheckpoint()
    drag.moved = true
    const { item, t0, h0 } = drag
    const dt = f.t - t0
    const dh = f.h - h0
    if ('textile' in item) P.onEdit((x) => moveTextileBy(x, rules, item.textile, dt, dh), false)
    else P.onEdit((x) => moveFoilBy(x, rules, item.foil, dt, dh, findMotif(P.motifs, item.foil.motif)?.ratio ?? 0), false)
    return
  }
  if (drag.kind === 'shelf') {
    const f = hits.onFace(e, drag.w, drag.s)
    if (!f) return
    if (!drag.moved) P.onCheckpoint()
    drag.moved = true
    const { shelf } = drag
    const module = shelf.module + Math.round(f.t - drag.t0)
    const y = shelfHeight(rules, shelf.y + f.h - drag.h0)
    P.onEdit((x) => dragShelves(x, rules, shelf.id, drag.ids, module, y), false)
    return
  }
  if (drag.kind === 'room') {
    const q = hits.onFloor(e, drag.y)
    if (q) dragRoom(drag, q, P.onEdit, P.onCheckpoint)
    return
  }
  const q = hits.onFloor(e)
  if (!q) return
  if (drag.kind === 'object') {
    if (!drag.moved) P.onCheckpoint()
    drag.moved = true
    const d = drag
    P.onEdit((x) => moveObject(x, place, d.id, q.x - d.off.x, q.y - d.off.y), false)
  } else {
    drag.moved = true
    dragWall(drag, q, P.onEdit, P.onCheckpoint)
  }
}

/** The release: drop what was dragged, or select what was pressed. */
export function endDrag(P: PointerProps, hits: SceneHits, d: Drag | null, hit: Hit | null, click: boolean) {
  if (d?.kind === 'object' && d.moved) return dropObject(P.v, d.id, d.start, P.onEdit, P.onToast)
  if (d?.kind === 'room' && d.moved) return dropRoom(d, P.onEdit, P.onToast)
  if (hit?.shelfId) {
    const f = shelvesOf(P.v).find((x) => x.id === hit.shelfId)
    // A shelf already chosen keeps the choice (its row, or only it)
    const keep = chosenShelves(P.v, P.selection).includes(hit.shelfId)
    if (f) P.onSelect({ wallId: f.wallId, side: sideOf(P.v, f), shelfId: f.id, shelfOnly: keep ? P.selection.shelfOnly : undefined })
    return
  }
  // A frame or decal is selected when let go, so the drawer does not open (and shrink the view) mid-drag
  if (hit?.textileId || hit?.foilId) {
    const deco = P.v.textiles.find((x) => x.id === hit.textileId) ?? P.v.foils.find((x) => x.id === hit.foilId)
    if (deco) P.onSelect({ wallId: deco.wallId, side: sideOf(P.v, deco), ...(hit.textileId ? { textileId: deco.id } : { foilId: deco.id }) })
    return
  }
  if (!click) return
  if (hit?.objectId) P.onSelect({ objectId: hit.objectId })
  else if (hit?.freeTextileId) {
    const t = P.v.freeTextiles.find((x) => x.id === hit.freeTextileId)
    if (t) P.onSelect({ freeTextileId: t.id, freeFace: faceOfPoint(t, hits.toModel(hit.point)) })
  } else if (hit?.openingId) P.onSelect({ openingId: hit.openingId })
  else if (hit?.roomId) P.onSelect({ roomId: hit.roomId })
  else if (hit?.wallId) P.onSelect({ wallId: hit.wallId, side: hits.faceOf(hit)?.s })
  else P.onSelect({})
}

/** The cursor over what is under the pointer while nothing is pressed. */
export function hoverCursor(v: Variant, hit: Hit | null, resizing: string | null) {
  const w = hit?.wallId ? v.walls.find((x) => x.id === hit.wallId) : undefined
  const movable = hit?.objectId || hit?.textileId || hit?.foilId || hit?.shelfId || hit?.roomId || (w && (w.room || canMoveWall(w)))
  return resizing ?? (movable ? 'move' : hit ? 'pointer' : 'grab')
}
