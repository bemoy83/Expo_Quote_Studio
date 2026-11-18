// The building blocks of every quick pill and selection pill (Bjørn 14.11.2026: one pattern for every tool): name
// first, then what the pen draws, its look, its sizes and «…». A setting that does not apply is grey where it always is.
import { Ellipsis, PaintBucket, Ruler } from 'lucide-react'
import type { ReactNode } from 'react'
import { useFine } from '../../fine'
import type { Motif } from '../../../domain/types'
import type { Swatch } from '../swatches'
import { MOTIFS } from './limits'

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

/**
 * The motifs on a pill, the same row on the dock's Profilering pens and on every selection pill (wall, frame, decal,
 * textile): the newest of the library (the customer's own come last), and the one chosen. Tapping the one chosen does
 * nothing (the same motif again does nothing, Bjørn 18.11.2026).
 */
export function MotifRow({ motifs, on, onPick }: { motifs: Motif[]; on: (id: string) => boolean; onPick: (id: string) => void }) {
  return (
    <>
      {motifs
        .filter((m, i) => i >= motifs.length - MOTIFS || on(m.id))
        .map((m) => (
          <button key={m.id} type="button" className="q-motif" aria-pressed={on(m.id)} title={`Motiv: ${m.name}`} onClick={() => !on(m.id) && onPick(m.id)}>
            <img src={m.src} alt={m.name} draggable={false} />
          </button>
        ))}
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
/** «Fin», the one switch for the whole app (ui/fine.tsx). `title`: what it does on and off here; `off`: why it does
 *  nothing here (greyed). */
export function FinBtn({ off, title, children }: { off?: string; title: { on: string; off: string }; children?: ReactNode }) {
  const { fine, setFine } = useFine()
  return (
    <QBtn on={fine && !off} setting disabled={!!off} title={off ?? (fine ? title.on : title.off)} label="Fin" onClick={() => setFine(!fine)}>
      {children ?? <Ruler size={15} />}
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
