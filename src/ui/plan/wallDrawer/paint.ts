// Colouring in the wall drawer, as in a paint program: the paint bucket (the whole face) or the brush (one plate at a
// time, press and sweep) lays a plate colour or «Print» on the plates of the face shown (Bjørn 2.11.2026).
import { feltBlocked } from '../../../domain/decor'
import { setDoorRal, doorRal, paintDoors } from '../../../domain/doors'
import { setWallPlate } from '../../../domain/edit'
import type { FaceSide } from '../../../domain/faces'
import { setPanels } from '../../../domain/panels'
import { clearPrint, fillPlates, printPlate, printsOn, printWall } from '../../../domain/print'
import type { Motif, Variant, Wall } from '../../../domain/types'
import type { BuiltModule } from '../../../domain/walls'
import { rules } from '../../env'
import { findMotif } from '../../motifs'
import { PRINT } from '../drawerParts'

/** Which tool is out: the paint bucket (the whole face), the brush (plate by plate), or none. */
export type PaintTool = 'wall' | 'plate' | null

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
  printSel: string | null
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

export function wallPaint({ v, w, s, built, mods, motifs, tool, paintSel, printSel, ral, free, base, onEdit, onCheckpoint, onToast }: PaintDeps) {
  const painting = tool !== null && free
  const paint = paintSel ?? ral
  const pm = findMotif(motifs, printSel ?? undefined) ?? motifs[0]
  const printing = paint === PRINT
  const printedAt = (x: Variant, i: number) => printsOn(x, w.id, s).find((f) => f.module === i)
  /**
   * Brush on a plate: its colour, or the wall's again when it already has the brush's colour. A print on this face of
   * the plate comes off (the colour shows again); decals stay.
   */
  const paintPlate = (i: number, key: string, first: boolean) => {
    const cur = built.get(key)?.plate
    const printed = !!printedAt(v, i)
    const to = first && cur === paint && !printed ? base(key) : paint
    if (!first && cur === to && !printed) return
    if (first) onCheckpoint()
    onEdit((x) => clearPrint(setPanels(x, [key], to, base), w.id, s, [i]), false)
  }
  /**
   * Brush on a door leaf: as on a plate, the leaf has a colour of its own; the header above it is a plate. A print on the
   * door (header and leaf as one picture) comes off.
   */
  const paintLeaf = (i: number, key: string, first: boolean) => {
    const o = mods[i]?.opening
    if (!o) return
    const printed = !!printedAt(v, i)
    const cur = doorRal(v, o)
    const to = first && cur === paint && !printed ? base(key) : paint
    if (!first && cur === to && !printed) return
    if (first) onCheckpoint()
    onEdit((x) => clearPrint(setDoorRal(x, o.id, to), w.id, s, [i]), false)
  }
  /**
   * The chosen tool on plate `i` (module key `key`): `first` on press, then for each plate swept over (brush only).
   * `leaf`: the door leaf of a door module, which the brush colours on its own.
   */
  const paintAt = (i: number, key: string, first: boolean, leaf = false) => {
    if (printing && !pm) {
      if (first) onToast('Last opp et motiv i Profilering først')
      return
    }
    if (tool === 'wall') {
      if (!first) return
      if (printing) {
        if (!fillPlates(v, rules, w, s).length) return onToast('Ingen plate på denne siden kan ha print')
        return onEdit((x) => printWall(x, rules, w.id, s, pm!.id, pm!.ratio))
      }
      return onEdit((x) => clearPrint(paintDoors(setWallPlate(x, w.id, paint), w.id, paint), w.id, s))
    }
    if (!printing) return leaf ? paintLeaf(i, key, first) : paintPlate(i, key, first)
    const why = feltBlocked(v, rules, w.id, i, s, true)
    if (why) {
      if (first) onToast(why)
      return
    }
    // Sweeping on over a plate that already has the motif leaves it; a click on it takes the motif off
    if (!first && printedAt(v, i)?.motif === pm!.id) return
    if (first) onCheckpoint()
    onEdit((x) => printPlate(x, rules, w.id, i, s, pm!.id), false)
  }
  return { painting, paint, printing, pm, paintAt }
}
