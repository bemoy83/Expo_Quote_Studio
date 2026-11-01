import type { ReactNode } from 'react'
import { Box } from 'lucide-react'
import { mainGroupOf } from '../../catalog/groups'
import type { Product } from '../../catalog/types'
import { INK, SURFACE } from '../colors'
import { MENUS } from './menus'
import type { decorSource } from '../dnd'
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
  drag,
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
  /** Makes the row draggable onto a wall (see dnd.ts). */
  drag?: ReturnType<typeof decorSource>
  children?: ReactNode
}) {
  return (
    <div className={['pd-row', on && 'on', pen && 'pen'].filter(Boolean).join(' ')} {...drag}>
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

/** Drawn footprint of a placed object, or its group's icon. */
export function ObjectThumb({ product, color }: { product: Product; color?: string }) {
  const f = product.footprint
  if (!f) {
    const m = MENUS.find((x) => x.key === mainGroupOf(product.group))
    const I = m?.icon ?? Box
    return <I size={16} />
  }
  const s = 26 / Math.max(f.w, f.d, 0.5)
  const fill = color ?? (product.name.includes('hvit') ? 'oklch(0.96 0.003 90)' : 'oklch(0.24 0.004 250)')
  return (
    <svg width="30" height="30" viewBox="-15 -15 30 30" aria-hidden>
      {f.round ? <circle r={(f.w * s) / 2} fill={fill} stroke={INK} strokeWidth={0.6} /> : <rect x={(-f.w * s) / 2} y={(-f.d * s) / 2} width={f.w * s} height={f.d * s} rx={1.5} fill={fill} stroke={INK} strokeWidth={0.6} />}
    </svg>
  )
}
