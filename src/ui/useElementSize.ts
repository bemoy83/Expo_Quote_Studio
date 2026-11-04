// The size of an element on screen in CSS pixels (`round`: whole pixels), following it as it changes: for drawings whose margins or
// pixel scale depend on how big they are shown (plan, wall drawing, the quote's 3D picture). Measure a box whose size
// does not follow what is drawn in it, or the two can chase each other.
import { useEffect, useState, type RefObject } from 'react'

export function useElementSize(ref: RefObject<Element | null>, round = false): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const w = round ? Math.round(r.width) : r.width
      const h = round ? Math.round(r.height) : r.height
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, round])
  return size
}
