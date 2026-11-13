// Which kind of pen is in hand. Velg and Tøm hold none of them: Tøm takes whatever lies under the pointer (erase.ts).
import { placedBy, type Brush, type Tool } from '../../tools'

export function pens(tool: Tool, brush: Brush | null) {
  const pen = tool === 'brush'
  return {
    wallTool: pen && (brush?.kind === 'wall'),
    floorTool: pen && brush?.kind === 'floor',
    openingTool: pen && brush?.kind === 'opening',
    /** Møbel: a piece on the floor, placed where it has room. */
    objectTool: pen && !!placedBy(brush),
    /** Disker og podier: a click stores a standard counter or a section, a drag grows it (Byggeregler K10, K22). */
    podiumTool: pen && brush?.kind === 'podium',
    decorTool: pen && brush?.kind === 'motif',
    /** One textile brush: on a system wall it is mounted there, anywhere else it stands free (domain/textile/brush). */
    textileTool: pen && brush?.kind === 'textile',
    /** Innvendig takdrager, drawn on the wall grid like a wall. */
    beamTool: pen && brush?.kind === 'beam',
    /** Hylle: in a wall module, on the face clicked; a drag along the wall lays a row. */
    shelfTool: pen && brush?.kind === 'shelf',
  }
}

export type Pens = ReturnType<typeof pens>
