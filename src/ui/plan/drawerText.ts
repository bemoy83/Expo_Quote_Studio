// Text styles and the view box of the drawer drawings (the wall seen straight on), in metres of the drawing.
import { INK_FAINT, INK_MUTED } from '../colors'

export const TXT = { font: '500 0.11px var(--font-ui)', fill: INK_MUTED, pointerEvents: 'none' as const }
export const DIM = { font: '500 0.12px var(--font-numeric)', fill: INK_FAINT }

/** The view box for a drawing W wide and H high, with room for the dimensions left and under it. */
export function elevationBox(W: number, H: number, pad = 0.18): string {
  return `${-pad - 0.25} ${-pad} ${W + 2 * pad + 0.25} ${H + pad + 0.32}`
}
