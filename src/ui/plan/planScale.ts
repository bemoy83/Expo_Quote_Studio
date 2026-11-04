// Scale of the plan on screen, so line widths can be given in screen pixels (docs/arbeidstegning.md, A4). PlanView
// measures how many pixels a metre takes and hands the layers `u` (metres per pixel), `lw` (1.5 on the quote and the
// work order, so lines survive printing) and the detail level. Below DETAIL_MIN px per metre, and always in the 3D
// view's mini map, details fall away (cross dashes on textile, module chains, the takdrager body).
import { createContext, useContext, type RefObject } from 'react'
import { useElementSize } from '../useElementSize'

type Detail = 'full' | 'compact'

export interface PlanScale {
  /** Metres per screen pixel. */
  u: number
  /** Line width factor: 1 while drawing, 1.5 on the documents. */
  lw: number
  detail: Detail
}

/** Pixels per metre below which the plan is drawn compact. */
const DETAIL_MIN = 55

/** Before the first measurement: a plan of about this many pixels per metre. */
const FIRST_PX_PER_M = 80

const DOC_LW = 1.5

export const PlanScaleContext = createContext<PlanScale>({ u: 1 / FIRST_PX_PER_M, lw: 1, detail: 'full' })

export const usePlanScale = () => useContext(PlanScaleContext)

/** A line `px` screen pixels wide (times `lw`), in metres. */
export const linePx = (s: PlanScale, px: number) => px * s.u * s.lw

/** A size of `px` screen pixels, in metres, not widened on the documents (gaps, offsets, text). */
export const sizePx = (s: PlanScale, px: number) => px * s.u

/** Width per letter, in em: the numeric (mono) font, the UI font, its heading weight in the wall drawing, and small capitals with letter spacing. */
export const EM = { mono: 0.62, ui: 0.56, head: 0.55, caps: 0.75 } as const

/** Rough width of a one-line text in screen px, to see whether it fits before drawing it. */
export const textPx = (text: string, font: number, em: number = EM.mono) => text.length * font * em

/**
 * Pixels per metre of an svg drawn with `preserveAspectRatio="xMidYMid meet"` over a viewBox `vbW` × `vbH` m.
 * Follows the svg's size as it changes.
 */
export function usePxPerMetre(svg: RefObject<SVGSVGElement | null>, vbW: number, vbH: number): number {
  const size = useElementSize(svg)
  if (!size || size.w <= 0 || size.h <= 0) return FIRST_PX_PER_M
  return Math.min(size.w / vbW, size.h / vbH)
}

/** The plan's scale from its pixels per metre. */
export function planScale(pxPerM: number, opts: { doc?: boolean; mini?: boolean }): PlanScale {
  return { u: 1 / pxPerM, lw: opts.doc ? DOC_LW : 1, detail: opts.mini || pxPerM < DETAIL_MIN ? 'compact' : 'full' }
}
