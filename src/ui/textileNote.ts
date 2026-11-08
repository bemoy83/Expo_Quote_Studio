// The note on a textile whose picture is not settled (Bjørn 8.11.2026): «Husk valg av motiv» on a print without a motif,
// «Kundens egen duk» on the customer's own. Drawn as a faint cross from corner to corner with a pill on the diagonal, in
// the wall drawers (plan/elevation.tsx) and in 3D (scene3d/build/note.ts), never as a fill that looks like a motif.
// White textile has none: that choice is made.
import type { TextileFill } from '../domain/types'

export interface TextileNote {
  text: string
  icon: 'image' | 'layers'
}

export function textileNote(fill: TextileFill, hasMotif: boolean): TextileNote | null {
  if (fill === 'reuse') return { text: 'Kundens egen duk', icon: 'layers' }
  if (fill === 'print' && !hasMotif) return { text: 'Husk valg av motiv', icon: 'image' }
  return null
}

/** The icons as stroked path data on a 24 × 24 grid (Lucide's image and layers), so svg and canvas (Path2D) draw the same. */
export const NOTE_ICON: Record<TextileNote['icon'], string[]> = {
  image: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M7 9a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'],
  layers: [
    'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z',
    'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65',
    'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65',
  ],
}

/** The pill's layout in units of its height: padding, icon, gap between icon and text, and the text size. */
export const NOTE_PILL = { pad: 0.42, icon: 0.63, gap: 0.26, font: 0.55 } as const

/** The pill's slope, degrees, y down: along the diagonal from the bottom left corner to the top right. */
export const noteAngle = (w: number, h: number) => (-Math.atan2(h, w) * 180) / Math.PI
