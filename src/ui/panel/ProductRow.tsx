import type { ReactNode } from 'react'
import { SURFACE } from '../colors'
import { fmt } from '../format'

export interface Chip {
  name: string
  color?: string
  /** Quantity in use, shown next to the chip. */
  count?: number
}

/** One row pattern for every product: thumb · name · action, then meta, result and variants full width. */
export function ProductRow({
  thumb,
  title,
  meta,
  result,
  chips,
  action,
  on,
  pen,
  children,
}: {
  thumb: ReactNode
  title: ReactNode
  meta?: ReactNode
  result?: ReactNode
  chips?: ReactNode
  action?: ReactNode
  /** In use: bold name. */
  on?: boolean
  /** Active brush: card marking. */
  pen?: boolean
  children?: ReactNode
}) {
  return (
    <div className={['pd-row', on && 'on', pen && 'pen'].filter(Boolean).join(' ')}>
      <span className="pd-thumb">{thumb}</span>
      <span className="pd-title">{title}</span>
      <span className="pd-action">{action}</span>
      {meta && <span className="pd-meta">{meta}</span>}
      {result && <span className="pd-result num">{result}</span>}
      {chips && <span className="pd-chips">{chips}</span>}
      {children && <div className="pd-extra">{children}</div>}
    </div>
  )
}

/**
 * Variant picker: colour dots in a recessed track (full name on hover, count per variant),
 * or text buttons when the variants are not colours. No outlines. The selection only shows when `selected` ≥ 0.
 */
export function VariantChips({ chips, selected, onSelect }: { chips: Chip[]; selected: number; onSelect: (i: number) => void }) {
  if (chips.length < 2) return null
  if (chips.every((c) => c.color)) {
    return (
      <span className="chips-dots">
        {chips.map((c, i) => (
          <button
            key={c.name + i}
            type="button"
            className={['vdot', c.count ? 'has-n' : ''].join(' ')}
            data-tip={c.name}
            aria-label={c.name}
            aria-pressed={selected === i}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(i)
            }}
          >
            <i style={{ background: c.color }} />
            {c.count ? <span className="num">{fmt(c.count)}</span> : null}
          </button>
        ))}
      </span>
    )
  }
  return (
    <span className="chips-text">
      {chips.map((c, i) => (
        <button key={c.name + i} type="button" aria-pressed={selected === i} onClick={() => onSelect(i)}>
          {c.name}
          {c.count ? <span className="num">{fmt(c.count)}</span> : null}
        </button>
      ))}
    </span>
  )
}

export function Swatch({ color, pattern }: { color?: string; pattern?: 'tiles' | 'planks' }) {
  const tex =
    pattern === 'tiles'
      ? 'repeating-linear-gradient(90deg,transparent 0 6px,rgb(0 0 0 / .14) 6px 7px),repeating-linear-gradient(0deg,transparent 0 6px,rgb(0 0 0 / .14) 6px 7px),'
      : pattern === 'planks'
        ? 'repeating-linear-gradient(0deg,transparent 0 4px,rgb(0 0 0 / .12) 4px 5px),'
        : ''
  return <span className="swatch" style={{ background: tex + (color ?? SURFACE) }} />
}
