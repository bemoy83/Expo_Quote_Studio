// When a press becomes a drag (Bjørn 9.11.2026: «klikk er klikk, men klikk og dra teller ikke som klikk ved slipp»): once
// the pointer has gone a little way from where it was pressed, so a small shake of the hand stays a click. Each drag kind
// says how far (`min`, plan m): further for what a click does something else with (a plate, a stroke), less for what is
// placed finely. Shared by the drag kinds in this folder.
import type { P } from './types'

/**
 * True once the pointer has gone `min` m from the press `p0`, and from then on (`moved`). The first time it sets
 * `moved` and calls `onStart`, where a drag that edits the sketch marks the undo step.
 */
export function goneFrom(d: { p0: P; moved: boolean }, q: P, min: number, onStart?: () => void): boolean {
  if (d.moved) return true
  if (Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < min) return false
  d.moved = true
  onStart?.()
  return true
}
