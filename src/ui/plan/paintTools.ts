// The paint bucket and the brush, shared by every drawer that colours plates (Bjørn 18.11.2026: the wall drawer is the
// template, the counter drawer works the same): the tool out and what it lays on, the rule of the brush, the bucket's
// toast, the one stroke rule (`strokeAt`, Byggeregel V15) and press-and-sweep in the drawing. The colour and print
// rules on each kind of plate are domain/paint.ts's, print.ts's and podiumDecor.ts's.
import { useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Painted } from '../../domain/paint'
import type { Variant } from '../../domain/types'

/** The tool out: the paint bucket (the whole side shown), the brush (plate by plate, press and sweep), or none. */
export type PaintTool = 'bucket' | 'brush' | null

/** «Print» as the last choice of the palette: the motif chosen in Profilering, foil over whole plates. */
export const PRINT = 'print'

/** What a print stroke says before there is a motif to lay. */
export const NO_MOTIF = 'Last opp et motiv i Profilering først'

/**
 * What the brush lays on a plate that has `cur` (and a print on the face shown or not): the brush's colour, or on the
 * press the plate's own again (`base`) when it already has the brush's. Null: a plate swept over that has it already.
 */
export function brushTo(cur: string, paint: string, base: string, printed: boolean, first: boolean): string | null {
  const to = first && cur === paint && !printed ? base : paint
  return !first && cur === to && !printed ? null : to
}

/** The bucket's colour on a side: the edit, and the toast saying what it left (`kept`: felt or parts with print). */
function applyFill(v: Variant, r: Painted, onEdit: (fn: (v: Variant) => Variant) => void, onToast: (t: string) => void, kept: (n: number) => string) {
  if (r.v !== v) onEdit(() => r.v)
  if (r.skipped) onToast(kept(r.skipped))
}

/** Change a sketch: what a stroke hands the drawer's onEdit. */
type Edit = (v: Variant) => Variant

/**
 * The plate a stroke lands on, as each drawer knows it (felles plateregel, Bjørn 18.11.2026): what the one stroke rule
 * in `strokeAt` needs, so the wall and the counter drawer colour and print the same way.
 */
export interface StrokePlate {
  /** The bucket with a colour: the whole side in it, printed plates left as they are (V16). */
  fill: (ral: string) => Painted
  /** The bucket with «Print»: one picture over the side, or why no plate on it can take one. */
  printSide: (motif: string) => Edit | string
  /** Why the plate takes no print (a toast), or null. */
  noPrint: () => string | null
  /** The brush with «Print»: the whole motif on the plate; null when it has it already (the same motif does nothing).
   *  `first`: the press, not a plate swept over. */
  printOne: (motif: string, first: boolean) => Edit | null
  /** The plate's colour as it shows, the colour it has without its own, and whether a print covers it on this face;
   *  null where the brush lays no colour (an open light opening). */
  colour: () => { cur: string; base: string; printed: boolean } | null
  /** The brush with a colour: the plate in `ral`, its print on this face off (the last stroke wins). */
  paintOne: (ral: string) => Edit
}

export interface StrokeDeps {
  v: Variant
  tool: PaintTool
  /** A plate colour (RAL) or PRINT. */
  paint: string
  /** The motif «Print» lays on. */
  motif: string | undefined
  /** What the bucket's toast says it left: plates with print. */
  kept: (n: number) => string
  onEdit: (fn: Edit, history?: boolean) => void
  onCheckpoint: () => void
  onToast: (text: string) => void
}


/**
 * The one stroke rule of the paint bucket and the brush, for every drawer that colours plates (V15, V16): the bucket on
 * the press only, the whole side; the brush on the press and on each plate swept over. `first`: the press.
 */
export function strokeAt(d: StrokeDeps, plate: StrokePlate, first: boolean) {
  const { v, tool, paint, motif, onEdit, onCheckpoint, onToast } = d
  if (!tool) return
  const printing = paint === PRINT
  if (printing && !motif) {
    if (first) onToast(NO_MOTIF)
    return
  }
  if (tool === 'bucket') {
    if (!first) return
    if (!printing) return applyFill(v, plate.fill(paint), onEdit, onToast, d.kept)
    const edit = plate.printSide(motif!)
    return typeof edit === 'string' ? onToast(edit) : onEdit(edit)
  }
  if (printing) {
    const why = plate.noPrint()
    if (why) {
      if (first) onToast(why)
      return
    }
    const edit = plate.printOne(motif!, first)
    if (!edit) return
    if (first) onCheckpoint()
    return onEdit(edit, false)
  }
  const c = plate.colour()
  const to = c && brushTo(c.cur, paint, c.base, c.printed, first)
  if (!to) return
  if (first) onCheckpoint()
  onEdit(plate.paintOne(to), false)
}

/** What a drawer keeps for its paint tools between renders: the tool, what it lays on, the motif «Print» lays. */
export function usePaintTools() {
  const [tool, setTool] = useState<PaintTool>(null)
  /** A plate colour (RAL) or PRINT. Unset: what the side has. */
  const [paintSel, setPaint] = useState<string | null>(null)
  /** The motif «Print» lays on, chosen in Profilering. Unset: the one shown, else the first in the library. */
  const [motifSel, setMotif] = useState<string | null>(null)
  return { tool, setTool, paintSel, setPaint, motifSel, setMotif }
}

/** The cursor over a plate while a tool is out. */
const toolCursor = (tool: PaintTool) => (tool === 'bucket' ? 'copy' : 'crosshair')

/**
 * Press and sweep in a drawing: `on(tool, at)` gives a plate its pointer handlers, `at(first)` is called on the press
 * and, with the brush, for each plate swept over while the button is down.
 */
export function useSweep() {
  /** True from a press on a plate until it is let go: the brush sweeps over the plates entered meanwhile. */
  const sweeping = useRef(false)
  return (tool: PaintTool, at: (first: boolean) => void) => ({
    style: { cursor: toolCursor(tool), touchAction: 'none' as const },
    onPointerDown: (e: RPointerEvent) => {
      e.stopPropagation()
      // A finger enters the plate (with the button down) just before it presses it, so a sweep only counts once
      // the press has begun: else the brush printed the plate on enter and the press took the print off again.
      sweeping.current = true
      const end = () => {
        sweeping.current = false
        window.removeEventListener('pointerup', end)
        window.removeEventListener('pointercancel', end)
      }
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', end)
      // Touch (iPad) holds the pointer on the plate it went down on, so the next plates would never see it
      // enter. Letting go of it makes a sweep with a finger or pen work like one with the mouse.
      // The capture is on the element pressed, which may be inside the plate's group.
      for (const t of [e.target, e.currentTarget] as Element[]) if (t.hasPointerCapture?.(e.pointerId)) t.releasePointerCapture(e.pointerId)
      if (e.button === 0) at(true)
    },
    onPointerEnter: (e: RPointerEvent) => {
      if (tool === 'brush' && sweeping.current && e.buttons === 1) at(false)
    },
  })
}
