// Textile walls: InFrame in front of a wall face, and free-standing frames on foot plates.
import { alongRun } from '../../../calc/textile/free'
import { runDirection } from '../../../domain/textile/free'
import { pointAlong, wallLength } from '../../../domain/grid'
import { rules } from '../../env'
import { findMotif } from '../../motifs'
import { sideOf } from '../../../domain/faces'
import { textileBox, textileOffset } from '../../../domain/textile/inFrame'
import { printMaterial } from './motifs'
import { ALU, ALU_FINISH, FABRIC, SELECT, type BuildContext } from './context'

export function buildTextile(c: BuildContext) {
  const { v, res, opts, H, mat, along, sel } = c
  // Textile walls (InFrame): a fabric box in an aluminium frame, standing in front of its face. The motif is
  // printed on the front.
  for (const t of v.textiles) {
    const w = v.walls.find((x) => x.id === t.wallId)
    if (!w) continue
    const L = wallLength(w)
    const from = Math.max(0, Math.min(L, t.from))
    const to = Math.max(from, Math.min(L, t.from + t.width))
    const s = sideOf(v, t)
    const off = s * (textileOffset(rules) + 0.005)
    const { bottom, height } = textileBox(t, rules)
    const h = Math.min(height, H - bottom)
    const glow = sel.textileId === t.id ? { emissive: SELECT, emissiveIntensity: 0.35 } : {}
    const fabric = mat('textile', FABRIC, { roughness: 1, ...glow })
    const alu = mat('textile', ALU, { ...ALU_FINISH, ...glow })
    const m = findMotif(opts.motifs, t.motif)
    const print = m ? printMaterial(m, (to - from) / h, opts.onLoad, glow) : fabric
    const faces = s === 1 ? [alu, alu, alu, alu, print, fabric] : [alu, alu, alu, alu, fabric, print]
    along(pointAlong(w, from), pointAlong(w, to), to - from - 0.02, h, rules.textile.depth, bottom, faces, { layer: 'textile', pick: { wallId: w.id, textileId: t.id } }, off)
  }

  // Frittstående tekstilvegger: a frame with textile on both faces (face A toward side 1), on foot plates
  for (const f of res.production.free) {
    const t = v.freeTextiles.find((x) => x.id === f.textileId)
    if (!t) continue
    const glow = sel.freeTextileId === t.id ? { emissive: SELECT, emissiveIntensity: 0.35 } : {}
    const alu = mat('textile', ALU, { ...ALU_FINISH, ...glow })
    const L = f.length / 1000
    const h = f.H / 1000
    const face = (x: (typeof f.faces)[number]) => {
      const m = x.fill === 'print' ? findMotif(opts.motifs, x.motif ?? undefined) : undefined
      if (m) return printMaterial(m, L / h, opts.onLoad, glow)
      return mat('textile', x.fill === 'white' ? '#ffffff' : FABRIC, { roughness: 1, ...glow })
    }
    const foot = rules.wall.feet / 10
    along(t.from, t.to, L, h, rules.textile.depth, foot, [alu, alu, alu, alu, face(f.faces[0]), face(f.faces[1])], { layer: 'textile', pick: { freeTextileId: t.id } })
    for (const at of f.supports) {
      const [x, y] = alongRun(t, at)
      const [dx, dy] = runDirection(t)
      const half = f.foot.along / 2000
      along([x - dx * half, y - dy * half], [x + dx * half, y + dy * half], 2 * half, foot, f.foot.across / 1000, 0, mat('textile', ALU, ALU_FINISH), { layer: 'textile' })
    }
  }
}
