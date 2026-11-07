// The key figures under the band. On a wide screen each shows its detail line next to it; when the whole row with
// details doesn't fit on one line (iPad, or a busy sketch on a laptop) only label, value and unit show, and a press on
// the row opens a card with every detail, for the seller's questions and the customer's.
import { ChevronDown } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useDismiss } from '../useDismiss'

export interface Figure {
  label: string
  value: string
  unit?: string
  /** The detail line: shown next to the figure when there is room, otherwise in the card. */
  sub?: string
  /** What stays next to the figure in the short row (e.g. «eks. mva.» on the sum). */
  short?: string
  /** Pushed to the right end of the row. */
  end?: boolean
}

export function KeyFigures({ figures }: { figures: Figure[] }) {
  const row = useRef<HTMLDivElement>(null)
  const probe = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [short, setShort] = useState(false)
  const [opened, setOpen] = useState(false)
  // The card belongs to the short row: gone when the full row fits again
  const open = opened && short
  const close = useCallback(() => setOpen(false), [])
  useDismiss(pop, row, close)

  // The probe is the full row on one line, out of sight; the short row is used when it is wider than the band
  useLayoutEffect(() => {
    const r = row.current
    const p = probe.current
    if (!r || !p) return
    const check = () => setShort(p.scrollWidth > r.clientWidth + 0.5)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(r)
    ro.observe(p)
    return () => ro.disconnect()
  }, [])

  const items = (full: boolean) =>
    figures.map((f) => <Kpi key={f.label} f={f} sub={full ? f.sub : f.short} />)

  return (
    <div className="kpis-wrap">
      <div className="kpis kpis-probe" ref={probe} aria-hidden>
        {items(true)}
      </div>
      {short ? (
        <div
          ref={row}
          className="kpis short"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Vis detaljer"
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(!open)
            }
          }}
        >
          {items(false)}
          <ChevronDown size={15} className={`kpis-more${open ? ' up' : ''}`} aria-hidden />
        </div>
      ) : (
        <div ref={row} className="kpis">
          {items(true)}
        </div>
      )}
      {open && (
        <div ref={pop} className="popover kpi-pop" role="dialog" aria-label="Nøkkeltall">
          {figures.map((f) => (
            <div key={f.label} className="kpi-pop-row">
              <span className="label">{f.label}</span>
              <span className="fig">
                <span className="value num">{f.value}</span>
                {f.unit && <span className="unit">{f.unit}</span>}
              </span>
              <span className="sub">{f.sub}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Kpi({ f, sub }: { f: Figure; sub?: string }) {
  return (
    <>
      {f.end && <span className="spacer" />}
      <span className="kpi">
        <span className="label">{f.label}</span>
        <span className="value num">{f.value}</span>
        {f.unit && <span className="unit">{f.unit}</span>}
        {sub && <span className="sub">{sub}</span>}
      </span>
    </>
  )
}
