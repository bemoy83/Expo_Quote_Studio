// Position numbers in the small plan on the quote and the work order (docs/arbeidstegning.md, «Posisjonsnummer»;
// Bjørn 04.11.2026: never on the drawing surface). One chip per drawn thing, the number of the quote line it is priced
// on (calc/positions.ts): beside its wall face, in front of a door, on a piece of furniture. Plates in a row that share
// an article (a plate swap, full-plate print) get one chip for the row.
import type { CalcResult } from '../../../calc/calc'
import { positionsOf, type Positioned } from '../../../calc/positions'
import { foilCenter, foilSpan } from '../../../domain/decor'
import { defaultFace, faceNormal, sideOf } from '../../../domain/faces'
import { moduleStart, pointAlong } from '../../../domain/grid'
import { runNormal, type FaceKey } from '../../../domain/textile/free'
import type { Point, Variant } from '../../../domain/types'
import { builtModules } from '../../../domain/walls'
import { INK, SURFACE } from '../../colors'
import { catalog, rules } from '../../env'
import type { Layer } from '../../tools'
import { linePx, sizePx, usePlanScale, type PlanScale } from '../planScale'
import { printBand, printOffset, textileOffset, textileWidth, wallWidth } from '../planStyle'
import { freeTextiles, wallTextiles } from '../../../domain/textile/mounts'

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
  /** Along what it marks (the wall or run), unit: a chip that would cover another moves this way (Bjørn 27.11.2026). */
  along?: Point
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
  const tangent = (wallId: string): Point | undefined => {
    const w = wallOf(wallId)
    if (!w) return undefined
    const [dx, dy] = [w.to[0] - w.from[0], w.to[1] - w.from[1]]
    const l = Math.hypot(dx, dy) || 1
    return [dx / l, dy / l]
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
        const t = wallTextiles(v).find((x) => x.id === i.id)!
        const at = faceAt(t.wallId, sideOf(v, t), t.from + t.width / 2, textOff + tw / 2 + half)
        const label = textileLabels ? frameLabel.get(t.id) : String(i.pos)
        if (at && label) out.push({ label, at, layer, along: tangent(t.wallId) })
        break
      }
      case 'freeTextile': {
        const t = freeTextiles(v).find((x) => x.id === i.id)!
        // At the middle of a face, like a textile wall's chip beside its wall face
        const l = Math.hypot(t.to[0] - t.from[0], t.to[1] - t.from[1]) || 1
        const along: Point = [(t.to[0] - t.from[0]) / l, (t.to[1] - t.from[1]) / l]
        const beside = (face: FaceKey): Point => {
          const [nx, ny] = runNormal(t, face)
          const o = tw / 2 + half
          return [(t.from[0] + t.to[0]) / 2 + nx * o, (t.from[1] + t.to[1]) / 2 + ny * o]
        }
        // The work order: each face's textile label (F1A, F1B), as the textiles are marked; the quote: the number on A
        if (textileLabels) for (const f of freeFaces.get(t.id) ?? []) out.push({ label: f.pos, at: beside(f.face), layer, along })
        else out.push({ label: String(i.pos), at: beside('a'), layer, along })
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
          if (at) out.push({ label: String(i.pos), at, layer, along: tangent(f.wallId) })
        }
        break
      }
      case 'door': {
        // In front of the door, on the side its leaf swings to, a little into the module
        const o = v.openings.find((x) => x.id === i.id)!
        const w = wallOf(o.wallId)
        if (!w) break
        const at = faceAt(o.wallId, o.swing ?? defaultFace(v, w), moduleStart(w, o.module) + 0.5, Math.min(0.45, ww / 2 + half + px(10)))
        if (at) out.push({ label: String(i.pos), at, layer, along: tangent(o.wallId) })
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
    if (at) out.push({ label: String(r.pos), at, layer: r.layer, along: tangent(r.wallId) })
  }
  return apart(out, sc)
}

/** A chip's width, plan units: wider for each character past the first (T12, 10). */
const chipWidth = (c: Chip, sc: PlanScale) => sizePx(sc, CHIP) + sizePx(sc, 5.5) * (c.label.length - 1)

/**
 * No chip covers another (Bjørn 27.11.2026: a plate swap and a decal on the same wall): in order, a chip that would
 * cover one already placed slides along what it marks, a chip's width and a gap at a time, first one way then the
 * other, to the nearest free place. It keeps its distance from the wall, so it still reads as that wall's.
 */
export function apart(chips: readonly Chip[], sc: PlanScale): Chip[] {
  const gap = sizePx(sc, GAP)
  const h = sizePx(sc, CHIP)
  const placed: Chip[] = []
  const hits = (c: Chip) => placed.some((p) => Math.abs(p.at[0] - c.at[0]) < (chipWidth(p, sc) + chipWidth(c, sc)) / 2 + gap / 2 && Math.abs(p.at[1] - c.at[1]) < h + gap / 2)
  for (const c of chips) {
    const [ax, ay] = c.along ?? [1, 0]
    const step = chipWidth(c, sc) + gap
    let best = c
    for (let k = 1; hits(best) && k <= 8; k++) {
      const d = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step
      best = { ...c, at: [c.at[0] + ax * d, c.at[1] + ay * d] }
    }
    placed.push(best)
  }
  return placed
}

/** The numbers, as small ink-edged squares like the chips in the quote's Pos. column. */
export function PosLayer({ v, res, dim, textileLabels = false }: { v: Variant; res: CalcResult; dim: (...layers: Layer[]) => number; textileLabels?: boolean }) {
  const sc = usePlanScale()
  const px = (n: number) => sizePx(sc, n)
  const all = chips(v, res, sc, textileLabels)
  const s = px(CHIP)
  const w = (c: Chip) => chipWidth(c, sc)
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
