// Scale of the plan on screen, so line widths can be given in screen pixels (docs/arbeidstegning.md, A4). PlanView
// measures how many pixels a metre takes and hands the layers `u` (metres per pixel), `lw` (1.5 on the quote and the
// work order, so lines survive printing) and the detail level. Below DETAIL_MIN px per metre, and always in the 3D
// view's mini map, details fall away (cross dashes on textile, module chains, the takdrager body).
import { createContext, useContext, useEffect, useState, type RefObject } from 'react'

export type Detail = 'full' | 'compact'

export interface PlanScale {
  /** Metres per screen pixel. */
  u: number
  /** Line width factor: 1 while drawing, 1.5 on the documents. */
  lw: number
  detail: Detail
}

/** Pixels per metre below which the plan is drawn compact. */
export const DETAIL_MIN = 55

/** Before the first measurement: a plan of about this many pixels per metre. */
const FIRST_PX_PER_M = 80

export const DOC_LW = 1.5

export const PlanScaleContext = createContext<PlanScale>({ u: 1 / FIRST_PX_PER_M, lw: 1, detail: 'full' })

export const usePlanScale = () => useContext(PlanScaleContext)

/** A line `px` screen pixels wide (times `lw`), in metres. */
export const linePx = (s: PlanScale, px: number) => px * s.u * s.lw

/** A size of `px` screen pixels, in metres, not widened on the documents (gaps, offsets, text). */
export const sizePx = (s: PlanScale, px: number) => px * s.u

/**
 * Pixels per metre of an svg drawn with `preserveAspectRatio="xMidYMid meet"` over a viewBox `vbW` × `vbH` m.
 * Follows the svg's size as it changes.
 */
export function usePxPerMetre(svg: RefObject<SVGSVGElement | null>, vbW: number, vbH: number): number {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = svg.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSize((s) => (s && s.w === r.width && s.h === r.height ? s : { w: r.width, h: r.height }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [svg])
  if (!size || size.w <= 0 || size.h <= 0) return FIRST_PX_PER_M
  return Math.min(size.w / vbW, size.h / vbH)
}

/** The plan's scale from its pixels per metre. */
export function planScale(pxPerM: number, opts: { doc?: boolean; mini?: boolean }): PlanScale {
  return { u: 1 / pxPerM, lw: opts.doc ? DOC_LW : 1, detail: opts.mini || pxPerM < DETAIL_MIN ? 'compact' : 'full' }
}
