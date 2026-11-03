// What the plan's pointer handlers share: the drag under way, and the context each handler gets (the sketch, the pen
// in hand, the hit tests and the callbacks). Each drag kind has its own file in this folder; usePlanPointer.ts picks it.
import type { Dispatch, SetStateAction } from 'react'
import type { FloorAction } from '../../../domain/floor/brush'
import type { Rect } from '../../../domain/floor/tiles'
import type { Run } from '../../../domain/innerBeams'
import type { Point, Variant } from '../../../domain/types'
import type { Motif } from '../../../persistence/file'
import type { RoomDrag, WallDrag } from '../../drag'
import type { Brush, Tool } from '../../tools'
import type { TextileLine } from '../layers/Previews'
import type { PlanSelection } from '../selection'
import type { FloorBrush } from './floorBrush'
import type { PlanHits } from './hits'
import type { Pens } from './pens'

export interface P {
  x: number
  y: number
}

/**
 * A press in Velg selects on release (`select`), so the wall drawer does not open, and shrink the plan, mid-drag.
 * A wall dragged away is not selected; furniture and rooms are.
 */
export type Drag =
  | { kind: 'stroke'; p0: P; moved: boolean }
  /** A floor stroke: the tiles after the first line up with it (`anchor`). */
  | { kind: 'floor'; last: string | null; anchor: { i: number; j: number } | null }
  /** A stroke of rolled floor from `from`: whole lanes, laid on release (`rollPending` until then). */
  | { kind: 'roll'; from: P; moved: boolean }
  /** Fyll with rolled floor: an area from cell `from`; a click without a drag fills the stand. */
  | { kind: 'carpetFill'; from: { i: number; j: number }; moved: boolean }
  | { kind: 'click'; select: PlanSelection }
  | { kind: 'object'; id: string; dx: number; dy: number; start: P; moved: boolean; select: PlanSelection }
  | ({ kind: 'wall'; moved: boolean; select: PlanSelection } & WallDrag)
  | ({ kind: 'beam'; moved: boolean } & WallDrag)
  | ({ kind: 'room'; select: PlanSelection | null } & RoomDrag)
  | { kind: 'textile'; p0: P }
  | { kind: 'freeMove'; id: string; p0: P; v0: Variant; moved: boolean; select: PlanSelection }

export type Edit = (fn: (v: Variant) => Variant, history?: boolean) => void

/** Everything a pointer handler reads or calls. Built afresh on every render of the plan. */
export interface PointerCtx {
  v: Variant
  tool: Tool
  brush: Brush | null
  selection: PlanSelection
  pens: Pens
  hits: PlanHits
  floor: FloorBrush
  /** Cell size of the textile brush's drawing grid, m. */
  step: number
  /** Standard beams: a drawn one may not lie along them. */
  standardRuns: Run[]
  /** Edges carrying a stand wall: locked. */
  standKeys: Set<string>
  /** What the roll stroke in progress will lay on release. */
  rollPending: FloorAction | null
  motifs?: Motif[]
  onEdit: Edit
  onCheckpoint: () => void
  onToast: (text: string) => void
  onSelect: (s: PlanSelection) => void
  setStroke: Dispatch<SetStateAction<[Point, Point] | null>>
  setTextileStroke: Dispatch<SetStateAction<TextileLine | null>>
  setRollPending: Dispatch<SetStateAction<FloorAction | null>>
  setFillRect: Dispatch<SetStateAction<Rect | null>>
}

/** A drag kind's steps: each pointer move while it is under way, and the release. */
export interface DragHandlers<K extends Drag['kind']> {
  move?: (c: PointerCtx, d: Extract<Drag, { kind: K }>, q: P) => void
  up?: (c: PointerCtx, d: Extract<Drag, { kind: K }>, q: P) => void
}
