// The stand on the drawing surface, top left: one floating pill like the dock. The stand switch names its type and size
// and opens its settings (StandSettings) in a popover; after a thin line, Plan and 3D choose the view. Open = ink fill,
// the chosen view = muted fill. Under it, a short line on what a click or drag does now (hints.ts).
import { ChevronDown, Ruler, X } from 'lucide-react'
import { FlatChoice, IconButton } from '../controls'
import { useLayoutEffect, useRef, useState } from 'react'
import { useDismiss } from '../useDismiss'
import { fmt } from '../format'
import { TYPE_NAME } from '../names'
import { StandSettings, type StandSettingsProps } from '../panel/StandSettings'
import type { Hint } from '../hints'

type View = 'plan' | '3d'
const VIEWS: { value: View; label: string }[] = [
  { value: 'plan', label: 'Plan' },
  { value: '3d', label: '3D' },
]

export function StandChip({ view, onView, hint, ...p }: StandSettingsProps & { view: View; onView: (v: View) => void; hint: Hint }) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)
  useDismiss(pop, button, close)
  const chip = useRef<HTMLDivElement>(null)
  // The popover is as wide as the chip over it, which grows and shrinks with the size it names
  useLayoutEffect(() => {
    if (pop.current && chip.current) pop.current.style.width = `${chip.current.offsetWidth}px`
  })
  const s = p.v.stand
  const k = p.res.keyFigures
  return (
    <>
      <div className="stand-top">
        <div ref={chip} className="dock-pill stand-chip">
          <button
            ref={button}
            type="button"
            className="dock-btn"
            aria-pressed={open}
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen(!open)}
          >
            <Ruler size={15} />
            <span className="type">{TYPE_NAME[s.type]}</span>
            <span className="size">
              {s.width} × {s.depth} m
            </span>
            <ChevronDown size={14} />
          </button>
          <span className="q-sep" />
          <FlatChoice<View> className="chip-views" label="Visning" value={view} onChange={onView} options={VIEWS} />
        </div>
        {/* What a click or drag does now; the whole help on hover */}
        <p className="chip-hint" title={hint.more}>
          {hint.text}
        </p>
      </div>
      {open && (
        <div ref={pop} className="popover stand-pop" role="dialog" aria-label="Stand">
          <div className="stand-pop-head">
            <span className="icon-tile">
              <Ruler size={16} />
            </span>
            <span className="txt">
              <span className="title">Stand</span>
              <span className="num">
                {fmt(k.area)} m² · {k.openSides} åpne {k.openSides === 1 ? 'side' : 'sider'}
              </span>
            </span>
            <IconButton icon={X} label="Lukk" size={16} onClick={close} />
          </div>
          <StandSettings {...p} />
        </div>
      )}
    </>
  )
}
