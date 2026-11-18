// Fyll over the whole stand, and the paint bucket over a face, with print as a choice made on purpose (Bjørn 18.11.2026):
// the stroke leaves printed plates and doors as they are, and the toast says so. Fyll on the whole stand (the Vegg pill,
// the stand colour in the panel) offers in the toast to colour them too: over the drawing, never inside a drawer or the
// panel, so no setting is pushed out of place.
import type { Painted, PrintChoice } from '../domain/paint'
import type { Variant } from '../domain/types'
import type { ToastMsg } from './useToast'

/** What the toast says when a stroke went past printed plates. */
export const printKept = (n: number) => (n === 1 ? 'Feltet med print står som før' : `${n} felt med print står som før`)

/** Fill with `fill`, keeping the prints; the toast offers «Farg også dem», which colours those too and takes their print off. */
export function fillKeeping(v: Variant, fill: (x: Variant, prints: PrintChoice) => Painted, onEdit: (fn: (x: Variant) => Variant) => void, onToast: (m: ToastMsg) => void) {
  const r = fill(v, 'keep')
  if (r.v !== v) onEdit(() => r.v)
  if (!r.skipped) return
  onToast({
    text: printKept(r.skipped),
    action: 'Farg også dem',
    onAction: () => {
      onEdit(() => fill(v, 'off').v)
      onToast({ text: r.skipped === 1 ? 'Printen er tatt av feltet' : `Printen er tatt av ${r.skipped} felt` })
    },
  })
}
