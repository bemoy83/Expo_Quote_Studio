// The building blocks of every quick pill and selection pill (Bjørn 14.11.2026: one pattern for every tool): name
// first, then what the pen draws, its look, its sizes and «…». A setting that does not apply is grey where it always is.
import { Ellipsis, PaintBucket, Ruler } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Swatch } from '../swatches'

export function QName({ name, meta }: { name: string; meta?: string }) {
  return (
    <span className="q-name">
      <span className="q-name-main">{name}</span>
      {meta && <span className="q-name-meta num">{meta}</span>}
    </span>
  )
}

/**
 * The colours of a pen and its paint bucket right after them (Bjørn 11.11.2026): the same row on the wall, floor and
 * counter pill, the bucket filling the whole stand with the chosen colour.
 */
export function Palette({ swatches, fill, onFill }: { swatches: Swatch[]; fill: string; onFill: () => void }) {
  return (
    <>
      {swatches.map(({ key, ...x }) => (
        <Sw key={key} {...x} />
      ))}
      <QBtn title={fill} label="Fyll" onClick={onFill}>
        <PaintBucket size={15} />
      </QBtn>
    </>
  )
}

/** A colour as a square swatch, chosen = an ink ring inside it (dock quick picks, stand popover). */
export function Sw({ color, title, on, onClick }: { color?: string; title: string; on: boolean; onClick: () => void }) {
  return <button type="button" className="q-sw" aria-pressed={on} title={title} aria-label={title} style={{ background: color }} onClick={onClick} />
}

/** A pill button. `on` marks the tool in hand (ink, like the dock); with `setting` it marks a chosen setting instead
 *  (`--chosen`, like every other choice on a surface). Bjørn 8.11.2026 and 10.11.2026: only drawing tools get ink. */
export function QBtn({
  on,
  setting,
  disabled,
  title,
  label,
  onClick,
  children,
}: {
  on?: boolean
  setting?: boolean
  /** Does not apply to what is in hand: grey, where it always is (Bjørn 14.11.2026). */
  disabled?: boolean
  title: string
  label?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className={setting ? 'q-btn q-set' : 'q-btn'} aria-pressed={on} disabled={disabled} title={title} aria-label={label} onClick={onClick}>
      {children}
    </button>
  )
}

/** «Fin»: Shift held, for touch (Bjørn 14.11.2026). `off`: what is in hand has no finer step, the button stays grey. */
export function FinBtn({ on, off, title, onClick }: { on: boolean; off?: string; title: string; onClick: () => void }) {
  return (
    <QBtn on={on && !off} setting disabled={!!off} title={off ?? title} label="Fin" onClick={onClick}>
      <Ruler size={15} />
      Fin
    </QBtn>
  )
}

export const Sep = () => <span className="q-sep" aria-hidden />

/** A shelf on its two brackets, seen from the front. */
export function ShelfIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="-1 -1 2 2" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth=".14" strokeLinecap="round">
      <path d="M-.85 -.1 H.85 M-.7 -.1 V.45 M.7 -.1 V.45" />
    </svg>
  )
}

export function BeamIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="-1 -1 2 2" width={size} height={size} aria-hidden>
      <path d="M-.9 0 H.9" stroke="currentColor" strokeWidth=".16" strokeDasharray=".3 .15" />
    </svg>
  )
}

/** «…»: opens the catalog in the left rail on the tool's tab, never a menu by the pill (Bjørn 14.11.2026). */
export function More({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="q-btn q-more" title="Alle valg i panelet" aria-label="Alle valg i panelet" onClick={onClick}>
      <Ellipsis size={15} />
    </button>
  )
}
