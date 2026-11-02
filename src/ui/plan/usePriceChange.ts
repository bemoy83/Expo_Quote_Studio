import { useEffect, useRef, useState } from 'react'

/** How long the change stays after the last edit, ms. A drag keeps it open, so one stroke shows as one change. */
const HOLD = 2600
/** A change this soon after the pointer moved in the plan came from drawing there, ms. */
const FROM_PLAN = 400
/** Room the pill needs beside the pointer, px. */
const PILL = { w: 130, h: 44 }

export interface PriceChange {
  /** Kr, signed. */
  amount: number
  /** Where the stroke was, px inside the drawing surface (.plan-wrap); null when the change came from elsewhere
   *  (undo, a drawer, 3D), and the dock shows it. */
  at: { x: number; y: number } | null
}

/** The change in the exhibitor's sum since the drawing went quiet: shown while you draw, gone a moment after the last
 *  edit. `scope` starts over without a change (another variant, a sketch opened or started). */
export function usePriceChange(sum: number, scope: string): PriceChange | null {
  const base = useRef({ sum, scope })
  const pointer = useRef<{ x: number; y: number; t: number } | null>(null)
  const [change, setChange] = useState<PriceChange | null>(null)

  useEffect(() => {
    const track = (e: PointerEvent) => {
      const t = e.target as Element | null
      const wrap = t?.closest?.('.plan-svg') ? t.closest('.plan-wrap') : null
      if (!wrap) return
      const r = wrap.getBoundingClientRect()
      // Room for the pill up and right of the pointer (.price-pill.at), so it stays on the surface near the edges
      const x = Math.min(e.clientX - r.left, r.width - PILL.w)
      const y = Math.max(e.clientY - r.top, PILL.h)
      pointer.current = { x, y, t: performance.now() }
    }
    window.addEventListener('pointermove', track)
    window.addEventListener('pointerdown', track)
    return () => {
      window.removeEventListener('pointermove', track)
      window.removeEventListener('pointerdown', track)
    }
  }, [])

  useEffect(() => {
    if (base.current.scope !== scope) {
      base.current = { sum, scope }
      setChange(null)
      return
    }
    const d = Math.round(sum - base.current.sum)
    const p = pointer.current
    const at = p && performance.now() - p.t < FROM_PLAN ? { x: p.x, y: p.y } : null
    setChange(d === 0 ? null : { amount: d, at })
    const t = window.setTimeout(() => {
      base.current = { sum, scope }
      setChange(null)
    }, HOLD)
    return () => window.clearTimeout(t)
  }, [sum, scope])
  return change
}
