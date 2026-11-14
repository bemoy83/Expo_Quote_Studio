// What every drawing pen shares (Bjørn 14.11.2026: one drawing tool, one thing to learn): Vegg, Tekstil and Takdrager
// (run.ts) and Disker og podier (podium.ts). A press works on what the pen shows (`at`: where Shift froze the preview,
// else the press); it draws once it has moved DRAW_DRAG, else it is a click. Shift or «Fin» on the pen draws in 250 steps.
import type { Brush } from '../../tools'
import type { P } from './types'

/** A press that moves this far (m) draws instead of clicking; less than the 75 mm a press in the middle waits with Shift. */
export const DRAW_DRAG = 0.05

/** A drawing pen pressed: at `p0`, on what the pen showed at `at`, the pointer last at `last`. */
export interface DrawPress {
  p0: P
  at: P
  last: P
  moved: boolean
}

export const startPress = (q: P, frozen: P | null): DrawPress => ({ p0: q, at: frozen ?? q, last: q, moved: false })

/** The pointer moved to q while pressed. */
export function pressMove(d: DrawPress, q: P) {
  if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) > DRAW_DRAG) d.moved = true
  d.last = q
}

/** «Fin» on in the quick picks: Shift held, for touch, without the preview standing still. A standard counter has none. */
export const penFine = (b: Brush | null) => !!b && 'fine' in b && !!b.fine && !(b.kind === 'podium' && b.stock)
