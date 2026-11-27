// Colouring in the wall drawer, as in a paint program: the paint bucket (the whole face) or the brush (one plate at a
// time, press and sweep) lays a plate colour or «Print» on the plates of the face shown (Bjørn 2.11.2026). The stroke
// rule is the one of every drawer (paintTools.strokeAt); this file says what a wall's plate is.
import { foilBlocked } from '../../../domain/decor'
import { doorRal } from '../../../domain/doors'
import type { FaceSide } from '../../../domain/faces'
import { paintLeaf, paintPlate, paintUpper, paintWallFace } from '../../../domain/paint'
import { fillPlates, printDoorPart, printPlate, printsOn, printWall } from '../../../domain/print'
import type { Motif, Variant, Wall } from '../../../domain/types'
import type { BuiltModule } from '../../../domain/walls'
import { rules } from '../../env'
import { printKept } from '../../fillKeeping'
import { findMotif } from '../../motifs'
import { PRINT } from '../drawerParts'
import { pickOn, strokeAt, type PaintTool, type StrokePlate } from '../paintTools'

export interface PaintDeps {
  v: Variant
  w: Wall
  s: FaceSide
  built: Map<string, BuiltModule>
  /** The wall's modules as built (undefined where another wall holds the module). */
  mods: (BuiltModule | undefined)[]
  motifs: Motif[]
  tool: PaintTool
  /** What the tools lay on: a plate colour (RAL) or PRINT. Unset: the wall's own colour. */
  paintSel: string | null
  /** The motif «Print» lays on, chosen in the motif library (Profilering). Unset: the first in the library. */
  motifSel: string | null
  /** The wall's own colour. */
  ral: string
  /** Nothing else is chosen (no frame, decal or door), so the tools are live. */
  free: boolean
  /** The colour a plate has without its own. */
  base: (key: string) => string
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onCheckpoint: () => void
  onToast: (text: string) => void
}

export function wallPaint({ v, w, s, built, mods, motifs, tool, paintSel, motifSel, ral, free, base, onEdit, onCheckpoint, onToast }: PaintDeps) {
  const painting = tool !== null && free
  const paint = paintSel ?? ral
  const pm = findMotif(motifs, motifSel ?? undefined) ?? motifs[0]
  const printing = paint === PRINT
  const printedAt = (x: Variant, i: number) => printsOn(x, w.id, s).find((f) => f.module === i && !f.upper)
  const deps = { v, tool, paint, motif: pm?.id, kept: printKept, onEdit, onCheckpoint, onToast }
  /**
   * Plate `i` of the wall (module key `key`) for the one stroke rule (paintTools.strokeAt). `leaf`: the door leaf of a
   * door module, a surface of its own beside the header (Bjørn 18.11.2026).
   */
  const plate = (i: number, key: string, leaf: boolean): StrokePlate => {
    const door = mods[i]?.opening
    return {
      fill: (r) => paintWallFace(v, w.id, s, r),
      printSide: (m) => (fillPlates(v, rules, w, s).length ? (x) => printWall(x, rules, w.id, s, m, pm!.ratio) : 'Ingen plate på denne siden kan ha print'),
      // Print is laid per module: a part of a split module (V10) takes none yet
      noPrint: () => (built.get(key)?.whole ? 'Delte plater kan ikke ha print ennå' : foilBlocked(v, rules, w.id, i, s, true)),
      printOne: (m, first) => {
        // A door: the brush prints the surface pressed, header or leaf
        if (door) return printDoorPart(v, rules, w.id, i, s, m, leaf ? 'leaf' : 'header') === v ? null : (x) => printDoorPart(x, rules, w.id, i, s, m, leaf ? 'leaf' : 'header')
        // Swept over, a plate with this motif already (also its share of a picture over more) is left as it is
        if (!first && printedAt(v, i)?.motif === m) return null
        return printPlate(v, rules, w.id, i, s, m) === v ? null : (x) => printPlate(x, rules, w.id, i, s, m)
      },
      colour: () => {
        if (leaf && !door) return null
        const cur = leaf ? doorRal(v, door!) : (built.get(key)?.plate ?? base(key))
        return { cur, base: base(key), printed: !!printedAt(v, i) }
      },
      paintOne: (r) => (leaf ? (x) => paintLeaf(x, door!.id, s, r) : (x) => paintPlate(x, w.id, s, i, key, r)),
    }
  }
  /**
   * The chosen tool on plate `i` (module key `key`): `first` on press, then for each plate swept over (brush only).
   * `leaf`: the door leaf of a door module, which the brush colours on its own; `up`: the upper felt of a raised plate
   * (V20), a surface of its own.
   */
  const paintAt = (i: number, key: string, first: boolean, leaf = false, up = false) => strokeAt(deps, up ? upper(i, key) : plate(i, key, leaf), first)
  /** A colour or «Print» picked on chosen plate `i` (the felt, or a door's leaf or header): the palette's way (pickOn). */
  const pickAt = (i: number, key: string, leaf = false) => (r: string, motif = pm?.id) => pickOn(plate(i, key, leaf), r, motif, onEdit, onToast)
  /** A colour picked on the upper felt of raised plate `i` (Byggeregel V20): a plate of its own over the middle rail. */
  const pickUpper = (i: number, key: string) => (r: string, motif = pm?.id) => pickOn(upper(i, key), r, motif, onEdit, onToast)
  /** The upper felt of raised plate `i` for the stroke rule (V20): a surface of its own, colour and print. */
  const upper = (i: number, key: string): StrokePlate => ({
    ...plate(i, key, false),
    noPrint: () => foilBlocked(v, rules, w.id, i, s, true, true),
    printOne: (m, first) => {
      const cur = printsOn(v, w.id, s).find((f) => f.module === i && f.upper)
      if (!first && cur?.motif === m) return null
      return printPlate(v, rules, w.id, i, s, m, true) === v ? null : (x) => printPlate(x, rules, w.id, i, s, m, true)
    },
    colour: () => ({ cur: mods[i]?.raise?.ral ?? base(key), base: base(key), printed: printsOn(v, w.id, s).some((f) => f.module === i && f.upper) }),
    paintOne: (r) => (x) => paintUpper(x, w.id, s, i, key, r),
  })
  return { painting, paint, printing, pm, paintAt, pickAt, pickUpper }
}
