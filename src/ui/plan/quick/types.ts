// What every tool's quick picks get: the props from the app, plus the shared head (name of what is in hand), «…» and
// a test for the pen in hand.
import type { ReactNode } from 'react'
import type { FloorBrushSize } from '../../../domain/floor/brush'
import type { TileSize } from '../../../domain/floor/tiles'
import type { Motif } from '../../../domain/types'
import type { Brush, DockTool, PenPicks, PenTool } from '../../tools'

export interface QuickPicksProps {
  tool: DockTool
  brush: Brush | null
  /** Name of what the pen draws, and a short line under it. */
  name: string
  meta?: string
  wallRal: string
  motifs: Motif[]
  onPick: (b: Brush) => void
  /** Open the panel on the tool's tab. */
  onMore: () => void
  /** Add a 1 × 1 m bakrom in a free corner. */
  onAddRoom: () => void
  /** Add the customer's own motif to the library. */
  onUpload: (f: File) => void
  floorSize: FloorBrushSize
  onFloorSize: (s: FloorBrushSize) => void
  otherSize: TileSize
  onOtherSize: (s: TileSize) => void
  onFill: () => void
  /** The wall pen's bucket: every wall in the pen's colour. */
  onFillWalls: () => void
  /** The bucket with a door in hand: every door leaf in this colour. */
  onFillDoors: (ral: string) => void
  /** The bucket with a curtain in hand: every curtain in this colour. */
  onFillCurtains: (fabric: string) => void
  /** The stand's wall colour: what a door with no colour of its own has. */
  standRal: string
  /** The bucket of Disker og podier: every counter and podium it drew in the pen's colour. */
  onFillPodiums: () => void
  /** The item behind each function, per tool. */
  picks: Partial<Record<PenTool, PenPicks>>
}

export interface QuickCtx {
  p: QuickPicksProps
  /** Name of what is in hand (`QName`). */
  head: ReactNode
  /** «…»: the catalog in the left rail, on the tool's tab. */
  more: ReactNode
  /** This pen is the one in hand. */
  is: (b: Brush) => boolean
}
