// The paint bucket and the brush, shared by every drawer that colours plates (Bjørn 18.11.2026: the wall drawer is the
// template, the counter drawer works the same): the tool out and what it lays on, the rule of the brush, the bucket's
// toast, and press-and-sweep in the drawing. The colour and print rules themselves are domain/paint.ts's.
import { useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Painted } from '../../domain/paint'
import type { Variant } from '../../domain/types'

/** The tool out: the paint bucket (the whole side shown), the brush (plate by plate, press and sweep), or none. */
export type PaintTool = 'bucket' | 'brush' | null

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
export function applyFill(v: Variant, r: Painted, onEdit: (fn: (v: Variant) => Variant) => void, onToast: (t: string) => void, kept: (n: number) => string) {
  if (r.v !== v) onEdit(() => r.v)
  if (r.skipped) onToast(kept(r.skipped))
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
export const toolCursor = (tool: PaintTool) => (tool === 'bucket' ? 'copy' : 'crosshair')

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
