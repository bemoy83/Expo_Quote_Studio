// Which kind of pen is in hand. Velg and Tøm hold none of them: Tøm takes whatever lies under the pointer (erase.ts).
import type { Brush, Tool } from '../../tools'

export function pens(tool: Tool, brush: Brush | null) {
  const pen = tool === 'brush'
  return {
    wallTool: pen && (brush?.kind === 'wall'),
    floorTool: pen && brush?.kind === 'floor',
    openingTool: pen && brush?.kind === 'opening',
    objectTool: pen && brush?.kind === 'object',
    decorTool: pen && brush?.kind === 'motif',
    /** One textile brush: on a system wall it is mounted there, anywhere else it stands free (domain/textile/brush). */
    textileTool: pen && brush?.kind === 'textile',
    /** Innvendig takdrager, drawn on the wall grid like a wall. */
    beamTool: pen && brush?.kind === 'beam',
  }
}

export type Pens = ReturnType<typeof pens>
