// Position numbers in the small plan on the quote and the work order (docs/arbeidstegning.md, «Posisjonsnummer»;
// Bjørn 04.11.2026: never on the drawing surface). One chip per drawn thing, the number of the quote line it is priced
// on (calc/positions.ts): beside its wall face, in front of a door, on a piece of furniture. Plates in a row that share
// an article (a plate swap, full-plate print) get one chip for the row.
import type { CalcResult } from '../../../calc/calc'
import { positionsOf, type Positioned } from '../../../calc/positions'
import { foilCenter, foilSpan } from '../../../domain/decor'
import { defaultFace, faceNormal, sideOf } from '../../../domain/faces'
import { pointAlong } from '../../../domain/grid'
import { runNormal, type FaceKey } from '../../../domain/textile/free'
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
  label: string
  at: Point
  layer: Layer
}

/** Where each number stands. With `textileLabels` (the work order) textile walls show the labels their textiles are
 *  marked with instead of the quote number: T1, T2 … on a wall face, F1A and F1B on the two faces of a free-standing
 *  one (Bjørn 7.11.2026: the sketch shows which textile goes where). */
function chips(v: Variant, res: CalcResult, sc: PlanScale, textileLabels: boolean): Chip[] {
  const p = positionsOf(v, res, catalog)
  const frameLabel = new Map(res.production.pieces.map((x) => [x.textileId, x.pos]))
  const freeFaces = new Map(res.production.free.map((f) => [f.textileId, f.faces]))
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
        const label = textileLabels ? frameLabel.get(t.id) : String(i.pos)
        if (at && label) out.push({ label, at, layer })
        break
      }
      case 'freeTextile': {
        const t = v.freeTextiles.find((x) => x.id === i.id)!
        // At the middle of a face, like a textile wall's chip beside its wall face
        const beside = (face: FaceKey): Point => {
          const [nx, ny] = runNormal(t, face)
          const o = tw / 2 + half
          return [(t.from[0] + t.to[0]) / 2 + nx * o, (t.from[1] + t.to[1]) / 2 + ny * o]
        }
        // The work order: each face's textile label (F1A, F1B), as the textiles are marked; the quote: the number on A
        if (textileLabels) for (const f of freeFaces.get(t.id) ?? []) out.push({ label: f.pos, at: beside(f.face), layer })
        else out.push({ label: String(i.pos), at: beside('a'), layer })
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
        if (f.full) {
          const [a, b] = foilSpan(v, rules, f)
          row(f.wallId, side, a, b, i.pos, layer, off)
        } else {
          const at = faceAt(f.wallId, side, foilCenter(v, rules, f), off)
          if (at) out.push({ label: String(i.pos), at, layer })
        }
        break
      }
      case 'door': {
        // In front of the door, on the side its leaf swings to, a little into the module
        const o = v.openings.find((x) => x.id === i.id)!
        const w = wallOf(o.wallId)
        if (!w) break
        const at = faceAt(o.wallId, o.swing ?? defaultFace(v, w), o.module + 0.5, Math.min(0.45, ww / 2 + half + px(10)))
        if (at) out.push({ label: String(i.pos), at, layer })
        break
      }
      case 'object': {
        const o = v.objects.find((x) => x.id === i.id)!
        out.push({ label: String(i.pos), at: [o.x, o.y], layer })
        break
      }
    }
  }
  for (const r of rows) {
    // The middle plate of the row (left of the middle when even), so the chip never sits on a post
    const mid = r.from + Math.floor((r.to - r.from - 1) / 2) + 0.5
    const at = faceAt(r.wallId, r.side, mid, r.off)
    if (at) out.push({ label: String(r.pos), at, layer: r.layer })
  }
  return out
}

/** The numbers, as small ink-edged squares like the chips in the quote's Pos. column. */
export function PosLayer({ v, res, dim, textileLabels = false }: { v: Variant; res: CalcResult; dim: (...layers: Layer[]) => number; textileLabels?: boolean }) {
  const sc = usePlanScale()
  const px = (n: number) => sizePx(sc, n)
  const all = chips(v, res, sc, textileLabels)
  const s = px(CHIP)
  // Wider for each character past the first (T12, 10)
  const w = (c: Chip) => s + px(5.5) * (c.label.length - 1)
  return (
    <g pointerEvents="none">
      {all.map((c, n) => (
        <g key={n} opacity={dim(c.layer)}>
          <rect x={c.at[0] - w(c) / 2} y={c.at[1] - s / 2} width={w(c)} height={s} rx={px(2)} fill={SURFACE} stroke={INK} strokeWidth={linePx(sc, 0.8)} />
          <text x={c.at[0]} y={c.at[1] + px(3.3)} textAnchor="middle" style={{ font: `500 ${px(9)}px var(--font-numeric)`, fill: INK }}>
            {c.label}
          </text>
        </g>
      ))}
    </g>
  )
}
