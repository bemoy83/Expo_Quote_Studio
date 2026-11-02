// The stand on the drawing surface: a chip in the top left corner, a switch on a floating pill like the dock's tools, naming its size and type; it opens the stand's
// settings (StandSettings) in a popover, so the drawing does not need the panel for them.
import { ChevronDown } from 'lucide-react'
import { useRef, useState } from 'react'
import { useDismiss } from '../useDismiss'
import { TYPE_NAME } from '../names'
import { StandSettings, type StandSettingsProps } from '../panel/StandSettings'

export function StandChip(p: StandSettingsProps) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)
  useDismiss(pop, button, close)
  const s = p.v.stand
  return (
    <>
      <div className="dock-pill stand-chip">
        <button ref={button} type="button" className="dock-btn" aria-pressed={open} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
          <span className="num">
            {s.width} × {s.depth} m
          </span>
          <span className="type">{TYPE_NAME[s.type]}</span>
          <ChevronDown size={14} />
        </button>
      </div>
      {open && (
        <div ref={pop} className="popover stand-pop" role="dialog" aria-label="Stand">
          <StandSettings {...p} />
        </div>
      )}
    </>
  )
}
