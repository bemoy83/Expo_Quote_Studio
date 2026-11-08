// What the wall drawing measures (docs/arbeidstegning.md, «Veggrisset»), pure: the placement row over the wall, the
// height row to the right, the brace chain under it, the leader texts over it, and the room each of them takes round the wall, in screen px.
// The drawing is in metres with y down: the wall top is y = 0, the floor y = H.
import { chainPoints, DIM_NEAR as NEAR, DIM_TOTAL as TOTAL, mm } from '../dims'
import type { ProductionPiece } from '../../../calc/production'
import { frameInset } from '../../../calc/textile/inFrame'
import { foilCenter } from '../../../domain/decor'
import { textileBox } from '../../../domain/textile/inFrame'
import type { Foil, Shelf, TextileWall } from '../../../domain/types'
import type { Rules } from '../../../rules/rules'
import { textPx } from '../planScale'

/** A textile frame or a print on the face, as drawn: x from left to right, heights above the floor, m. */
export interface ElevationItem {
  kind: 'textile' | 'decal' | 'print'
  x0: number
  x1: number
  bottom: number
  top: number
  /** A textile frame: x of its uprights left to right (the frame sides and the braces between), for the brace chain. */
  uprights?: number[]
  /** The leader text, when it says more than the product type. */
  label?: string
}

/**
 * Lysmål (Bjørn 6.11.2026): what shows of each plate, between the posts' lips and the rails, for plate fields starting
 * at `fields` (x, m). `along`: the edges of each field (960 apart, 40 between); `heights`: the visible top, the
 * visible bottom and the floor, y down in a drawing H high.
 */
export function lysmal(rules: Rules, fields: number[], H: number): { along: number[]; heights: number[] } {
  const { cc, feet, height, profile } = rules.wall
  const lip = (cc - profile.length) / 2
  const along = [...new Set(fields.flatMap((x) => [x + lip, x + cc - lip]))].sort((a, b) => a - b)
  return { along, heights: [H - (feet + height - profile.top), H - (feet + profile.bottom), H] }
}

/** A leader text: its dot on the item's top, and the line of text it stands on (0 = lowest). */
export interface Leader {
  text: string
  x: number
  y: number
  level: number
}

/** Px: a leader line of text, the numbers of a chain, the heading. Chains stand as in the plan (DIM_NEAR, DIM_TOTAL). */
export const LEADER_FONT = 10.5
export const LEADER_LINE = 13
const NUMBERS = 14
const HEAD = 22

/** The leader text of each kind: the product type. */
const LABEL: Record<ElevationItem['kind'], string> = { textile: 'Tekstil', decal: 'Dekal', print: 'Print' }

/** What the drawing takes from production for a frame on a wall: its size, rails, braces, print and its move in an inner
 *  corner (byggeregel X10). */
export type FrameFacts = Pick<ProductionPiece, 'W' | 'H' | 'railCuts' | 'braceAt' | 'shift'>

/** A frame on a wall as built, x in the drawing: the physical frame (970 in a 1 000 span, moved where X10 moves it), the
 *  braces and the rail splices. Without production facts, the frame as the span gives it, with no braces. */
export function textileDrawing(rules: Rules, t: TextileWall, p: FrameFacts | undefined, x: (t: number) => number): { x0: number; x1: number; braces: number[]; splices: number[] } {
  const inset = frameInset(rules.textile.inFrame) / 1000
  const a = t.from + inset + (p?.shift ?? 0) / 1000
  const W = p ? p.W / 1000 : t.width - 2 * inset
  const at = (d: number) => x(a + d / 1000)
  const cuts = p?.railCuts ?? []
  return {
    x0: Math.min(x(a), x(a + W)),
    x1: Math.max(x(a), x(a + W)),
    braces: (p?.braceAt ?? []).map(at),
    splices: cuts.slice(0, -1).map((_, j) => at(cuts.slice(0, j + 1).reduce((s, c) => s + c, 0))),
  }
}

/** «Tekstil 5 970 × 2 540»: the frame as built. The print file, braces and splice are in the drawer's text (text.ts). */
export const textileLabel = (p: Pick<FrameFacts, 'W' | 'H'>): string => `Tekstil ${mm(p.W / 1000)} × ${mm(p.H / 1000)}`

/**
 * Textile frames (as built, textileDrawing) and print on the face, for the placement and height rows, the brace chain
 * and the leaders. `x` turns an along-wall offset into x in the drawing (the face is seen from in front, so it may run
 * backwards). A full-plate print on a door module is part of the door and not measured.
 */
export function elevationItems(rules: Rules, tex: TextileWall[], foils: Foil[], doorModules: Set<number>, x: (t: number) => number, facts: (id: string) => FrameFacts | undefined = () => undefined): ElevationItem[] {
  const spanX = (a: number, b: number) => Math.min(x(a), x(b))
  return mergePrints([
    ...tex.map((t): ElevationItem => {
      const { bottom, height } = textileBox(t, rules)
      const p = facts(t.id)
      const d = textileDrawing(rules, t, p, x)
      return {
        kind: 'textile',
        x0: d.x0,
        x1: d.x1,
        bottom,
        top: bottom + height,
        ...(p ? { uprights: [d.x0, ...d.braces, d.x1].sort((a, b) => a - b), label: textileLabel(p) } : {}),
      }
    }),
    ...foils
      .filter((f) => !(f.full && doorModules.has(f.module)))
      .map((f): ElevationItem => {
        const c = foilCenter(rules, f)
        const x0 = spanX(c - f.width / 2, c + f.width / 2)
        return { kind: f.full ? 'print' : 'decal', x0, x1: x0 + f.width, bottom: f.y - f.height / 2, top: f.y + f.height / 2 }
      }),
  ])
}

/** Prints on plates side by side are one print to measure and name: merged into one item across the posts. */
export function mergePrints(items: ElevationItem[], gap = 0.1): ElevationItem[] {
  const out: ElevationItem[] = []
  for (const it of [...items].sort((a, b) => a.x0 - b.x0)) {
    const last = out[out.length - 1]
    if (it.kind === 'print' && last?.kind === 'print' && it.x0 - last.x1 < gap && it.bottom === last.bottom && it.top === last.top) last.x1 = Math.max(last.x1, it.x1)
    else out.push({ ...it })
  }
  return out
}

/** Positions along a row: both ends and every edge, sorted, without repeats. */
export const row = (ends: [number, number], edges: number[]): number[] => chainPoints([...ends, ...edges])

/**
 * The leader texts, left to right: one per item, from the middle of its top. A text that would run into the one
 * before it goes one line up (`u` metres per px, for the text widths).
 */
export function leaders(items: ElevationItem[], H: number, u: number): Leader[] {
  const ends: number[] = []
  return [...items]
    .sort((a, b) => a.x0 + a.x1 - (b.x0 + b.x1))
    .map((it) => {
      const x = (it.x0 + it.x1) / 2
      // Text from just right of the line, about 0,6 em a letter
      const text = it.label ?? LABEL[it.kind]
      const width = (textPx(text, LEADER_FONT) + 8) * u
      let level = 0
      while (ends[level] !== undefined && ends[level] > x) level++
      ends[level] = x + width
      return { text, x, y: H - it.top, level }
    })
}

/** Room round the wall for the chains, the leaders and the heading, px. */
export function margins(items: ElevationItem[], levels: number, opts: FrameOpts = {}): { left: number; right: number; top: number; bottom: number } {
  const decor = items.length > 0
  const named = (opts.labels ?? []).length > 0
  // A frame's brace chain under it pushes the whole length one row down; a chain over a free-standing frame needs a row
  const under = items.some((i) => i.uprights)
  const over = opts.chainOver ? NEAR + NUMBERS : 0
  return {
    // With a frame, decal or print measured, the wall heights and the module chain are left out
    left: decor ? 10 : TOTAL + NUMBERS + 4,
    right: decor ? NEAR + NUMBERS + 4 : 10,
    top: HEAD + over + (decor ? NEAR + NUMBERS + 6 : named ? NEAR + 6 : 10) + (named ? levels * LEADER_LINE : 0),
    bottom: (decor && !under ? NEAR : TOTAL) + NUMBERS + 2,
  }
}

/**
 * `chainOver`: a chain stands over the drawing (the braces of a free-standing frame). `labels`: what gets a leader with
 * its name. Not what the drawer is open for, whose title names it (Bjørn 8.11.2026), but the textile frames on a wall
 * when the wall is chosen.
 */
export interface FrameOpts {
  chainOver?: boolean
  labels?: ElevationItem[]
}

/**
 * The drawing's view box and scale for an svg of `size` px: the wall L × H m with the margins round it. The leader
 * lines decide the top margin and depend on the scale, so it is worked out twice.
 */
export function frame(size: { w: number; h: number } | null, L: number, H: number, items: ElevationItem[], opts: FrameOpts = {}) {
  const fit = (levels: number) => {
    const m = margins(items, levels, opts)
    const k = size ? Math.max(20, Math.min((size.w - m.left - m.right) / L, (size.h - m.top - m.bottom) / H)) : 60
    return { m, k }
  }
  let { m, k } = fit(1)
  const labels = opts.labels ?? []
  const levels = Math.max(1, ...leaders(labels, H, 1 / k).map((l) => l.level + 1))
  ;({ m, k } = fit(labels.length ? levels : 0))
  const u = 1 / k
  const ls = leaders(labels, H, u)
  // Centred in the svg like preserveAspectRatio meet would, with the margins kept
  const vbW = size ? size.w * u : L + (m.left + m.right) * u
  const vbH = size ? size.h * u : H + (m.top + m.bottom) * u
  const x0 = -m.left * u - (vbW - L - (m.left + m.right) * u) / 2
  const y0 = -m.top * u - (vbH - H - (m.top + m.bottom) * u) / 2
  return { viewBox: `${x0} ${y0} ${vbW} ${vbH}`, u, leaders: ls, top: y0, width: vbW, right: x0 + vbW }
}

/** The shelves in one felt, for its height chain: x of the felt's right edge in the drawing and the heights. */
export interface ShelfChain {
  /** The felt's edges in the drawing, left to right. */
  x0: number
  x1: number
  /** Heights above the floor, m, the floor first: the lowest board's top, then for each shelf over it the underside of
   *  its board and its top, so the chain reads from the floor and the lysmål between them (Byggeregler H4, H5). */
  ts: number[]
}

/** The height chains of the shelves on a face, one per felt (Byggeregler H5, H8). `x` turns an along-wall offset into x in the drawing. */
export function shelfChains(rules: Rules, stacks: Shelf[][], x: (t: number) => number): ShelfChain[] {
  const t = rules.shelf.board.thickness
  return stacks.map((st) => {
    const a = x(st[0].module)
    const b = x(st[0].module + 1)
    const ts = [0, ...st.flatMap((f, i) => (i === 0 ? [f.y] : [f.y - t, f.y]))]
    return { x0: Math.min(a, b), x1: Math.max(a, b), ts }
  })
}
