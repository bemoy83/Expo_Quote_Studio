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
import { strokeAt, type PaintTool, type StrokePlate } from '../paintTools'
import type { ElevationPart } from './podiumView'

/** What a stroke over the side left as it was. */
const partsKept = (n: number) => `${count(n, 'plate', 'plater')} med print står som før`

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

/** The chosen tool on light opening `light` of part `i` of the side: `first` on press, then each one swept over. The
 *  stroke rule is the one of every drawer (paintTools.strokeAt); this says what a counter's plate is. */
export function counterPaintAt({ v, o, side, tool, paint, pm, onEdit, onCheckpoint, onToast }: CounterPaintDeps) {
  const sections = o.sections ?? []
  const ral = counterRal(o)
  const deps = { v, tool, paint, motif: pm?.id, kept: partsKept, onEdit, onCheckpoint, onToast }
  const plate = (p: ElevationPart, light: number): StrokePlate => {
    const open = p.lights[light] === 'open'
    return {
      fill: (r) => paintCounterSide(v, o.id, side.map((q) => q.key), r),
      printSide: (m) => {
        const keys = side.filter((q) => takesDecor(sections, q.part)).map((q) => q.key)
        return keys.length ? (x) => printCounterSide(x, o.id, keys, m) : 'Ingen del på denne siden kan ha print'
      },
      noPrint: () => (open ? 'Åpen: ingen print' : null),
      printOne: (m) => {
        const cur = printAt(sections, p.part, light)
        return cur?.motif === m && !cur.run ? null : (x) => printCounterPlate(x, o.id, p.key, light, m)
      },
      // Nothing where it is open
      colour: () => (open ? null : { cur: p.rals[light] ?? ral, base: ral, printed: !!printAt(sections, p.part, light) }),
      paintOne: (r) => (x) => paintCounterPlates(x, o.id, [p.key], r, light),
    }
  }
  return (i: number, light: number, first: boolean) => {
    const p = side[i]
    if (p) strokeAt(deps, plate(p, light), first)
  }
}
