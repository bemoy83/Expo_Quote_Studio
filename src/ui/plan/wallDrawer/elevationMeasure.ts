// What the wall drawing measures (docs/arbeidstegning.md, «Veggrisset»), pure: the placement row over the wall, the
// height row to the right, the leader texts over it, and the room each of them takes round the wall, in screen px.
// The drawing is in metres with y down: the wall top is y = 0, the floor y = H.
import { chainPoints, DIM_NEAR as NEAR, DIM_TOTAL as TOTAL } from '../dims'
import { frameInset } from '../../../calc/textile/inFrame'
import { foilCenter } from '../../../domain/decor'
import { textileBox } from '../../../domain/textile/inFrame'
import type { Foil, TextileWall } from '../../../domain/types'
import type { Rules } from '../../../rules/rules'
import { textPx } from '../planScale'

/** A textile frame or a print on the face, as drawn: x from left to right, heights above the floor, m. */
export interface ElevationItem {
  kind: 'textile' | 'decal' | 'print'
  x0: number
  x1: number
  bottom: number
  top: number
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

/**
 * Textile frames (their physical width) and print on the face, for the placement and height rows and the leaders. `x` turns an along-wall offset
 * into x in the drawing (the face is seen from in front, so it may run backwards). A full-plate print on a door module
 * is part of the door and not measured.
 */
export function elevationItems(rules: Rules, tex: TextileWall[], foils: Foil[], doorModules: Set<number>, x: (t: number) => number): ElevationItem[] {
  const spanX = (a: number, b: number) => Math.min(x(a), x(b))
  return mergePrints([
    ...tex.map((t): ElevationItem => {
      const { bottom, height } = textileBox(t, rules)
      // The physical frame, as on the plan and in calc and production (970 in a 1 000 span), not the span it fills
      const inset = frameInset(rules.textile.inFrame) / 1000
      const x0 = spanX(t.from + inset, t.from + t.width - inset)
      return { kind: 'textile', x0, x1: x0 + t.width - 2 * inset, bottom, top: bottom + height }
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
      const text = LABEL[it.kind]
      const width = (textPx(text, LEADER_FONT) + 8) * u
      let level = 0
      while (ends[level] !== undefined && ends[level] > x) level++
      ends[level] = x + width
      return { text, x, y: H - it.top, level }
    })
}

/** Room round the wall for the chains, the leaders and the heading, px. */
export function margins(items: ElevationItem[], levels: number): { left: number; right: number; top: number; bottom: number } {
  const decor = items.length > 0
  return {
    left: TOTAL + NUMBERS + 4,
    right: decor ? NEAR + NUMBERS + 4 : 10,
    top: HEAD + (decor ? NEAR + NUMBERS + levels * LEADER_LINE + 6 : 10),
    bottom: TOTAL + NUMBERS + 2,
  }
}

/**
 * The drawing's view box and scale for an svg of `size` px: the wall L × H m with the margins round it. The leader
 * lines decide the top margin and depend on the scale, so it is worked out twice.
 */
export function frame(size: { w: number; h: number } | null, L: number, H: number, items: ElevationItem[]) {
  const fit = (levels: number) => {
    const m = margins(items, levels)
    const k = size ? Math.max(20, Math.min((size.w - m.left - m.right) / L, (size.h - m.top - m.bottom) / H)) : 60
    return { m, k }
  }
  let { m, k } = fit(1)
  const levels = Math.max(1, ...leaders(items, H, 1 / k).map((l) => l.level + 1))
  ;({ m, k } = fit(items.length ? levels : 0))
  const u = 1 / k
  const ls = leaders(items, H, u)
  // Centred in the svg like preserveAspectRatio meet would, with the margins kept
  const vbW = size ? size.w * u : L + (m.left + m.right) * u
  const vbH = size ? size.h * u : H + (m.top + m.bottom) * u
  const x0 = -m.left * u - (vbW - L - (m.left + m.right) * u) / 2
  const y0 = -m.top * u - (vbH - H - (m.top + m.bottom) * u) / 2
  return { viewBox: `${x0} ${y0} ${vbW} ${vbH}`, u, leaders: ls, top: y0, width: vbW }
}
