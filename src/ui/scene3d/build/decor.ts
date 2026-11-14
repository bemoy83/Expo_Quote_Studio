// Foil decor and stretched print on the wall plates, over the door leaf and header where a print covers a door.
import { foilCenter } from '../../../domain/decor'
import { doorWindows } from '../../../domain/doors'
import { cropWindow, plateCrop } from '../../../domain/print'
import { pointAlong } from '../../../domain/grid'
import { productOf, rules } from '../../env'
import { findMotif } from '../../motifs'
import { sideOf } from '../../../domain/faces'
import { cropMaterial, printMaterial } from './motifs'
import { FABRIC, selectGlow, type BuildContext, type Tag } from './context'

export function buildDecor(c: BuildContext) {
  const { v, opts, mat, along, mods, sel } = c
  // Foil decor: a thin print on the wall plate, inside its felt. A print over a door covers its header and its leaf.
  const doorAt = new Set(mods.filter((m) => m.opening && productOf(m.opening.product)?.opening === 'door').map((m) => `${m.opening!.wallId}|${m.opening!.module}`))
  for (const f of v.foils) {
    const w = v.walls.find((x) => x.id === f.wallId)
    if (!w) continue
    const s = sideOf(v, f)
    const c = foilCenter(v, rules, f)
    const m = findMotif(opts.motifs, f.motif)
    const glow = selectGlow(sel.foilId === f.id)
    const tag: Tag = { layer: 'foil', pick: { wallId: w.id, foilId: f.id } }
    const blank = mat('foil', FABRIC, { roughness: 0.6, ...glow })
    const face = s * (rules.wall.profile.thickness / 2 + 0.002)
    if (!f.full || (!f.crop && !doorAt.has(`${f.wallId}|${f.module}`))) {
      const print = m ? printMaterial(m, f.width / f.height, opts.onLoad, glow) : blank
      along(pointAlong(w, c - f.width / 2), pointAlong(w, c + f.width / 2), f.width, f.height, 0.002, f.y - f.height / 2, print, tag, face)
      continue
    }
    const crop = plateCrop(f, m?.ratio ?? 0)
    const y0 = f.y - f.height / 2
    const y1 = f.y + f.height / 2
    const box = { x0: -f.width / 2, x1: f.width / 2, y0, y1 }
    const band = (lo: number, hi: number, width: number, off: number) => {
      const win = { x0: -width / 2, x1: width / 2, y0: lo, y1: hi }
      const print = m ? cropMaterial(m, cropWindow(crop, box, win), opts.onLoad, glow) : blank
      along(pointAlong(w, c - width / 2), pointAlong(w, c + width / 2), width, hi - lo, 0.002, lo, print, tag, off)
    }
    if (!doorAt.has(`${f.wallId}|${f.module}`)) {
      band(y0, y1, f.width, face)
      continue
    }
    // Door: the picture shows through the header plate between its rails and the leaf plate inside its 292 frame
    // (lysåpning); rails and frame hide their strip of it. The leaf plate sits in the middle of the 20 mm frame.
    const { header, leaf } = doorWindows(rules)
    band(header.y0, header.y1, header.w, face)
    band(leaf.y0, leaf.y1, leaf.w, s * (0.0015 + 0.001))
  }
}
