// Colouring in the drawer for a counter of Disker og podier, as in the wall drawer (Bjørn 18.11.2026: the wall drawer is
// the template): the paint bucket lays a plate colour or «Print» on the whole side shown, the brush on one plate at a
// time, pressed and swept. A plate is a light opening of a part, its sliding door one surface (K6), and takes print on
// its own (K20): the brush the whole motif, the bucket one picture over the side. The rules are domain/paint.ts's: the
// bucket leaves printed plates as they are, the brush is the last stroke.
import { counterRal } from '../../../domain/objects'
import { paintCounterPlates, paintCounterSide } from '../../../domain/paint'
import { printAt, printCounterPlate, printCounterSide, takesDecor } from '../../../domain/podiumDecor'
import type { Motif, PlacedObject, Variant } from '../../../domain/types'
import { count } from '../../format'
import { PRINT } from '../drawerParts'
import { applyFill, brushTo, NO_MOTIF, type PaintTool } from '../paintTools'
import type { ElevationPart } from './podiumView'

/** What a stroke over the side left as it was. */
export const partsKept = (n: number) => `${count(n, 'plate', 'plater')} med print står som før`

export interface CounterPaintDeps {
  v: Variant
  o: PlacedObject
  /** The parts of the side shown, left to right. */
  side: ElevationPart[]
  tool: PaintTool
  /** What the tools lay on: a plate colour (RAL) or PRINT. */
  paint: string
  /** The motif «Print» lays on. */
  pm: Motif | undefined
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onCheckpoint: () => void
  onToast: (text: string) => void
}

/** The chosen tool on light opening `light` of part `i` of the side: `first` on press, then each one swept over. */
export function counterPaintAt({ v, o, side, tool, paint, pm, onEdit, onCheckpoint, onToast }: CounterPaintDeps) {
  const sections = o.sections ?? []
  const ral = counterRal(o)
  const printing = paint === PRINT
  return (i: number, light: number, first: boolean) => {
    const p = side[i]
    if (!p || !tool) return
    if (printing && !pm) {
      if (first) onToast(NO_MOTIF)
      return
    }
    if (tool === 'bucket') {
      if (!first) return
      if (printing) {
        const keys = side.filter((q) => takesDecor(sections, q.part)).map((q) => q.key)
        if (!keys.length) return onToast('Ingen del på denne siden kan ha print')
        return onEdit((x) => printCounterSide(x, o.id, keys, pm!.id))
      }
      return applyFill(v, paintCounterSide(v, o.id, side.map((q) => q.key), paint), onEdit, onToast, partsKept)
    }
    // The brush: the whole motif on the plate, the same motif again does nothing
    if (printing) {
      if (p.lights[light] === 'open') {
        if (first) onToast('Åpen: ingen print')
        return
      }
      const cur = printAt(sections, p.part, light)
      if (cur?.motif === pm!.id && !cur.run) return
      if (first) onCheckpoint()
      return onEdit((x) => printCounterPlate(x, o.id, p.key, light, pm!.id), false)
    }
    // A colour on the plate, or the counter's again when it already has the brush's; nothing where it is open
    if (p.lights[light] === 'open') return
    const to = brushTo(p.rals[light] ?? ral, paint, ral, !!printAt(sections, p.part, light), first)
    if (to === null) return
    if (first) onCheckpoint()
    onEdit((x) => paintCounterPlates(x, o.id, [p.key], to, light), false)
  }
}
