// Position numbers in the small plan on the quote and the work order (docs/arbeidstegning.md, «Posisjonsnummer»;
// Bjørn 04.11.2026: never on the drawing surface). One chip per drawn thing, the number of the quote line it is priced
// on (calc/positions.ts): beside its wall face, in front of a door, on a piece of furniture. Plates in a row that share
// an article (a plate swap, full-plate print) get one chip for the row.
import type { CalcResult } from '../../../calc/calc'
import { positionsOf, type Positioned } from '../../../calc/positions'
import { foilCenter } from '../../../domain/decor'
import { defaultFace, faceNormal, sideOf } from '../../../domain/faces'
import { pointAlong } from '../../../domain/grid'
import { runNormal } from '../../../domain/textile/free'
import type { Point, Variant } from '../../../domain/types'
import { builtModules } from '../../../domain/walls'
import { INK, SURFACE } from '../../colors'
import { catalog, rules } from '../../env'
import type { Layer } from '../../tools'
import { linePx, sizePx, usePlanScale, type PlanScale } from '../planScale'
import { printBand, printOffset, textileOffset, textileWidth, wallWidth } from '../planStyle'

/** Chip size and its gap to what it marks, screen px. */
const CHIP = 13
const GAP = 3

const LAYER: Record<Positioned['kind'], Layer> = {
  textile: 'textile',
  freeTextile: 'textile',
  swap: 'walls',
  foil: 'foil',
  door: 'openings',
  object: 'objects',
}

interface Chip {
  pos: number
  at: Point
  layer: Layer
}

/** Where each number stands. */
function chips(v: Variant, res: CalcResult, sc: PlanScale): Chip[] {
  const p = positionsOf(v, res, catalog)
  const px = (n: number) => sizePx(sc, n)
  const [ww, tw, band, printOff, textOff] = [wallWidth(sc), textileWidth(sc), printBand(sc), printOffset(sc), textileOffset(sc)]
  const half = px(CHIP) / 2 + px(GAP)
  const wallOf = (id: string) => v.walls.find((w) => w.id === id)
  const mods = new Map(builtModules(v).map((m) => [m.key, m]))
  const out: Chip[] = []
  // Plates in a row on one wall with the same number: one chip at the middle of the row
  const rows: { wallId: string; side: 1 | -1; from: number; to: number; pos: number; layer: Layer; off: number }[] = []
  const row = (wallId: string, side: 1 | -1, from: number, to: number, pos: number, layer: Layer, off: number) => {
    const r = rows.find((x) => x.wallId === wallId && x.side === side && x.pos === pos && (Math.abs(x.to - from) < 1e-9 || Math.abs(x.from - to) < 1e-9))
    if (!r) rows.push({ wallId, side, from, to, pos, layer, off })
    else if (Math.abs(r.to - from) < 1e-9) r.to = to
    else r.from = from
  }
  const faceAt = (wallId: string, side: 1 | -1, t: number, off: number): Point | null => {
    const w = wallOf(wallId)
    if (!w) return null
    const n = faceNormal(w, side)
    const [x, y] = pointAlong(w, t)
    return [x + n[0] * off, y + n[1] * off]
  }
  for (const i of p.items) {
    const layer = LAYER[i.kind]
    switch (i.kind) {
      case 'textile': {
        const t = v.textiles.find((x) => x.id === i.id)!
        const at = faceAt(t.wallId, sideOf(v, t), t.from + t.width / 2, textOff + tw / 2 + half)
        if (at) out.push({ pos: i.pos, at, layer })
        break
      }
      case 'freeTextile': {
        const t = v.freeTextiles.find((x) => x.id === i.id)!
        const [nx, ny] = runNormal(t, 'a')
        // A quarter along on face A: clear of the T/F label in the middle of face B
        const o = tw / 2 + half
        const q = (a: number, b: number) => a + (b - a) / 4
        out.push({ pos: i.pos, at: [q(t.from[0], t.to[0]) + nx * o, q(t.from[1], t.to[1]) + ny * o], layer })
        break
      }
      case 'swap': {
        const m = mods.get(i.id)!
        const w = wallOf(m.wallId)
        if (w) row(m.wallId, defaultFace(v, w), m.index, m.index + 1, i.pos, layer, ww / 2 + half)
        break
      }
      case 'foil': {
        const f = v.foils.find((x) => x.id === i.id)!
        const side = sideOf(v, f)
        const off = printOff + band / 2 + half
        if (f.full) row(f.wallId, side, f.module, f.module + 1, i.pos, layer, off)
        else {
          const at = faceAt(f.wallId, side, foilCenter(rules, f), off)
          if (at) out.push({ pos: i.pos, at, layer })
        }
        break
      }
      case 'door': {
        // In front of the door, on the side its leaf swings to, a little into the module
        const o = v.openings.find((x) => x.id === i.id)!
        const w = wallOf(o.wallId)
        if (!w) break
        const at = faceAt(o.wallId, o.swing ?? defaultFace(v, w), o.module + 0.5, Math.min(0.45, ww / 2 + half + px(10)))
        if (at) out.push({ pos: i.pos, at, layer })
        break
      }
      case 'object': {
        const o = v.objects.find((x) => x.id === i.id)!
        out.push({ pos: i.pos, at: [o.x, o.y], layer })
        break
      }
    }
  }
  for (const r of rows) {
    // The middle plate of the row (left of the middle when even), so the chip never sits on a post
    const mid = r.from + Math.floor((r.to - r.from - 1) / 2) + 0.5
    const at = faceAt(r.wallId, r.side, mid, r.off)
    if (at) out.push({ pos: r.pos, at, layer: r.layer })
  }
  return out
}

/** The numbers, as small ink-edged squares like the chips in the quote's Pos. column. */
export function PosLayer({ v, res, dim }: { v: Variant; res: CalcResult; dim: (...layers: Layer[]) => number }) {
  const sc = usePlanScale()
  const px = (n: number) => sizePx(sc, n)
  const all = chips(v, res, sc)
  const s = px(CHIP)
  return (
    <g pointerEvents="none">
      {all.map((c, n) => (
        <g key={n} opacity={dim(c.layer)}>
          <rect x={c.at[0] - s / 2} y={c.at[1] - s / 2} width={s} height={s} rx={px(2)} fill={SURFACE} stroke={INK} strokeWidth={linePx(sc, 0.8)} />
          <text x={c.at[0]} y={c.at[1] + px(3.3)} textAnchor="middle" style={{ font: `500 ${px(9)}px var(--font-numeric)`, fill: INK }}>
            {c.pos}
          </text>
        </g>
      ))}
    </g>
  )
}
