// Foil decor and stretched print on the wall plates, over the door leaf and header where a print covers a door.
import { foilCenter } from '../../../domain/decor'
import { cropBand, plateCrop } from '../../../domain/print'
import { pointAlong } from '../../../domain/grid'
import { productOf, rules } from '../../env'
import { findMotif } from '../../motifs'
import { sideOf } from '../../../domain/faces'
import { cropMaterial, printMaterial } from './motifs'
import { FABRIC, SELECT, type BuildContext, type Tag } from './context'

export function buildDecor(c: BuildContext) {
  const { v, opts, mat, along, mods, sel } = c
  // Foil decor: a thin print on the wall plate, inside its felt. A print over a door covers its header and its leaf.
  const doorAt = new Set(mods.filter((m) => m.opening && productOf(m.opening.product)?.opening === 'door').map((m) => `${m.opening!.wallId}|${m.opening!.module}`))
  for (const f of v.foils) {
    const w = v.walls.find((x) => x.id === f.wallId)
    if (!w) continue
    const s = sideOf(v, f)
    const c = foilCenter(rules, f)
    const m = findMotif(opts.motifs, f.motif)
    const glow = sel.foilId === f.id ? { emissive: SELECT, emissiveIntensity: 0.35 } : {}
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
    const band = (lo: number, hi: number, width: number, off: number) => {
      const print = m ? cropMaterial(m, cropBand(crop, y0, y1, lo, hi), opts.onLoad, glow) : blank
      along(pointAlong(w, c - width / 2), pointAlong(w, c + width / 2), width, hi - lo, 0.002, lo, print, tag, off)
    }
    if (!doorAt.has(`${f.wallId}|${f.module}`)) {
      band(y0, y1, f.width, face)
      continue
    }
    // Door: the header plate above, the leaf (thicker, and down to the floor) below. The picture runs on over both.
    band(rules.door.height, y1, f.width, face)
    band(0, rules.door.height - 0.01, rules.door.swing, s * (0.02 + 0.002))
  }
}
