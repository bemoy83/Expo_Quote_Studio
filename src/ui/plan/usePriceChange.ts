import { useEffect, useRef, useState } from 'react'

/** How long the change stays after the last edit, ms. A drag keeps it open, so one stroke shows as one change. */
const HOLD = 2600

/** The change in the exhibitor's sum since the drawing went quiet: shown while you draw, gone a moment after the last
 *  edit. `scope` starts over without a change (another variant, a sketch opened or started). */
export function usePriceChange(sum: number, scope: string): number | null {
  const base = useRef({ sum, scope })
  const [change, setChange] = useState<number | null>(null)
  useEffect(() => {
    if (base.current.scope !== scope) {
      base.current = { sum, scope }
      setChange(null)
      return
    }
    const d = Math.round(sum - base.current.sum)
    setChange(d === 0 ? null : d)
    const t = window.setTimeout(() => {
      base.current = { sum, scope }
      setChange(null)
    }, HOLD)
    return () => window.clearTimeout(t)
  }, [sum, scope])
  return change
}
