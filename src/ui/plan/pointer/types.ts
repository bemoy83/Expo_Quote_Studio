// What the plan's pointer handlers share: the drag under way, and the context each handler gets (the sketch, the pen
// in hand, the hit tests and the callbacks). Each drag kind has its own file in this folder; usePlanPointer.ts picks it.
import type { Dispatch, SetStateAction } from 'react'
import type { Rect } from '../../../domain/floor/tiles'
import type { FaceSide } from '../../../domain/faces'
import type { Module } from '../../../domain/grid'
import type { BuiltModule } from '../../../domain/walls'
import type { Run } from '../../../domain/innerBeams'
import type { Motif, Point, Variant } from '../../../domain/types'
import type { PodiumDraw, PodiumDrag } from '../../../domain/podiums'
import type { PodiumGrip } from '../../../domain/podiumGrips'
import type { PodiumLink } from '../../../domain/podiumLinks'
import type { RoomDrag, WallDrag } from '../../drag'
import type { Brush, Tool } from '../../tools'
import type { TextileLine } from '../layers/Previews'
import type { PlanSelection } from '../selection'
import type { Erasing, EraseTarget } from './erase'
import type { FloorBrush } from './floorBrush'
import type { PlanHits } from './hits'
import type { Pens } from './pens'

export interface P {
  x: number
  y: number
}

/**
 * A press in Velg selects on release (`select`). A plain click goes through `clickSelect` (click.ts: selects what lies
 * under it, a second click on it or empty floor lets go); a drag never lets go of the selection. A wall dragged away is not
 * selected; furniture and rooms are.
 */
/** Shift on a straight stroke (Bjørn 14.11.2026): 250 steps while `fine`; Shift pressed or let go mid-stroke locks
 *  what is drawn (`lock`) and goes on from it in the new step. */
export interface StrokeSteps {
  fine?: boolean
  at?: [Point, Point]
  lock?: [Point, Point]
}

export type Drag =
  /** A straight stroke on the wall grid. `beamId`: Tøm pressed on a drawn takdrager, so a click takes all of it. */
  /** A straight stroke (stroke.ts). `fine`: Shift or «Fin» with the wall pen, 250 steps from a 250 node; `at`, the
   *  stroke as last shown; `lock`, what was drawn when Shift was pressed or let go, which the stroke goes on from. */
  | ({ kind: 'stroke'; p0: P; moved: boolean; beamId?: string } & StrokeSteps)
  /** A floor stroke: the tiles after the first line up with it (`anchor`). */
  | { kind: 'floor'; last: string | null; anchor: { i: number; j: number } | null }
  /** Fyll with rolled floor: an area from cell `from`; a click without a drag fills the stand. */
  | { kind: 'carpetFill'; from: { i: number; j: number }; moved: boolean }
  | { kind: 'click'; select: PlanSelection }
  /** `fuse`: a counter of Disker og podier dragged against another, the one it lies against (K15), or why not. */
  | { kind: 'object'; id: string; dx: number; dy: number; start: P; moved: boolean; select: PlanSelection; fuse?: string }
  | ({ kind: 'wall'; moved: boolean; select: PlanSelection } & WallDrag)
  /** `fine`: Shift held or «Fin» on in the pill (`fineLock`), it moves across in 50 mm steps off the grid (Byggeregel T15). */
  | ({ kind: 'beam'; moved: boolean; select: PlanSelection; fine?: boolean; fineLock?: boolean } & WallDrag)
  | ({ kind: 'room'; select: PlanSelection | null } & RoomDrag)
  /** The textile pen pressed (textile.ts), with Shift or «Fin» as the wall stroke. */
  | ({ kind: 'textile'; p0: P } & StrokeSteps)
  /** Disker og podier pressed (podium.ts): `at`, where the section the pen showed stands (the press, or where Shift froze
   *  it); `click`, what a click there stores (podiumStart); `drag`, what a drag draws from it, none on a counter or where it has no room; `last`, the pointer at the last
   *  move, where Shift pressed or let go goes on from. */
  | { kind: 'podium'; p0: P; at: P; click: PodiumDraw | null; drag: PodiumDrag | null; last: P; moved: boolean }
  /** A grip of the chosen counter of Disker og podier pressed, in Velg or with its pen (podiumGrip.ts, K14): its side or
   *  corner follows the pointer from the press `p0` in 500 steps, 250 with `fine` (Shift, or «Fin» on the pen). */
  | { kind: 'podiumGrip'; id: string; grip: PodiumGrip; p0: P; moved: boolean; fine: boolean }
  /** A link of the chosen counter pressed (podiumLink.ts, K15): a click breaks a joint or links a counter against it. */
  | { kind: 'podiumLink'; id: string; link: PodiumLink; p0: P; moved: boolean }
  | { kind: 'freeMove'; id: string; p0: P; v0: Variant; moved: boolean; select: PlanSelection }
  /** Door, decal or furniture pressed: shown until release, stored on release over the same target (place.ts). */
  /** `module`: the door's module, pressed; `door`: a door (not a curtain), turned by where the pointer is dragged. */
  | { kind: 'place'; what: 'opening' | 'decor' | 'object'; key: string; module?: Module; door?: boolean }
  /** The wall pen pressed on a plate that stands: colours plates along that wall on release (plates.ts). `as`: the drag
   *  turned across the wall, so it draws a new wall as a stroke. */
  | { kind: 'plates'; wallId: string; i0: number; p0: P; moved: boolean; as?: Extract<Drag, { kind: 'stroke' }>; fine?: boolean }
  /** The shelf pen pressed on a wall face: module `m0` to `m1` on that face, laid on release (shelf.ts). */
  | { kind: 'shelf'; wallId: string; s: FaceSide; m0: number; m1: number }
  /** Velg on a shelf: drag moves it and the shelves chosen with it (its row) along the wall or onto another wall face,
   *  with Alt a copy; release selects. */
  | { kind: 'shelfMove'; anchor: string; ids: string[]; p0: P; v0: Variant; moved: boolean; copy: boolean; start: PlanSelection; select: PlanSelection }
  /** Tøm on anything but walls and drawn beams: the first thing pressed, then more of its kind as the pointer passes. */
  | { kind: 'erase'; first: EraseTarget; p0: P; moved: boolean; done: Set<string> }

export type Edit = (fn: (v: Variant) => Variant, history?: boolean) => void

/** Everything a pointer handler reads or calls. Built afresh on every render of the plan. */
export interface PointerCtx {
  v: Variant
  tool: Tool
  brush: Brush | null
  selection: PlanSelection
  pens: Pens
  hits: PlanHits
  /** The wall modules as built. */
  mods: BuiltModule[]
  floor: FloorBrush
  /** Standard beams: a drawn one may not lie along them. */
  standardRuns: Run[]
  /** Edges carrying a stand wall: locked. */
  standKeys: Set<string>
  motifs?: Motif[]
  onEdit: Edit
  onCheckpoint: () => void
  onToast: (text: string) => void
  onSelect: (s: PlanSelection) => void
  /** The drawer is open: a click on the selected object keeps it (the drawer follows the selection). */
  drawerOpen?: boolean
  /** Double click: select this and open its drawer in detail. */
  onOpenDrawer?: (s: PlanSelection) => void
  /** A plain click (press and release without moving) in Velg: the click rules in click.ts. Owned by the hook. */
  clickSelect: (s: PlanSelection) => void
  setStroke: Dispatch<SetStateAction<[Point, Point] | null>>
  setTextileStroke: Dispatch<SetStateAction<TextileLine | null>>
  setFillRect: Dispatch<SetStateAction<Rect | null>>
  /** What a Tøm press will take on release (touch has no hover to show it). */
  setErasing: Dispatch<SetStateAction<Erasing | null>>
}

/** A drag kind's steps: each pointer move while it is under way, and the release. */
export interface DragHandlers<K extends Drag['kind']> {
  move?: (c: PointerCtx, d: Extract<Drag, { kind: K }>, q: P) => void
  up?: (c: PointerCtx, d: Extract<Drag, { kind: K }>, q: P) => void
}
