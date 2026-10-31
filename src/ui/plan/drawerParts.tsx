// Controls shared by the drawers (veggskuff) of both kinds of textile wall: on a system wall and free-standing.
import { Minus, Plus } from 'lucide-react'
import type { TextileFill } from '../../domain/types'
import type { Motif } from '../../persistence/file'
import { CommitInput, IconButton, Segmented } from '../controls'
import { fmt } from '../format'
import { findMotif } from '../motifs'

const EPS = 1e-6

/**
 * A motif filling a box, cropped like the 3D print. Drawn in its own viewport of the motif's shape: an SVG motif in a
 * plain <image> would letterbox itself inside the box instead of being cropped.
 */
export function Print({ m, x, y, width, height }: { m: Motif; x: number; y: number; width: number; height: number }) {
  return (
    <svg x={x} y={y} width={width} height={height} viewBox={`0 0 ${m.ratio} 1`} preserveAspectRatio="xMidYMid slice">
      <image href={m.src} width={m.ratio} height={1} />
    </svg>
  )
}

/** A length in metres with − / + and a field you can type in. */
export function Dim({ label, value, onChange, step = 0.1, min = 0.5, decimals = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; decimals?: number }) {
  const nudge = (d: number) => onChange(Math.round((value + d) * 1000) / 1000)
  return (
    <div className="opt flush">
      <span className="lbl">{label}</span>
      <span className="wd-dim">
        <IconButton icon={Minus} size={14} label={`${label} −${fmt(step, 2)} m`} disabled={value <= min + EPS} onClick={() => nudge(-step)} />
        <CommitInput
          className="field num"
          aria-label={`${label} i meter`}
          inputMode="decimal"
          value={fmt(value, decimals)}
          selectOnFocus
          onCommit={(text) => {
            const n = Number(text.replace(',', '.').replace(/[^\d.]/g, ''))
            if (!Number.isFinite(n) || text.trim() === '') return false
            onChange(n)
          }}
        />
        <IconButton icon={Plus} size={14} label={`${label} +${fmt(step, 2)} m`} onClick={() => nudge(step)} />
        <span className="num unit">m</span>
      </span>
    </div>
  )
}

const FILLS: { value: TextileFill; label: string }[] = [
  { value: 'print', label: 'Trykk' },
  { value: 'white', label: 'Hvit' },
  { value: 'reuse', label: 'Kundens' },
]

/** Printed, white without graphics, or the customer's own textile of the same size (only mounted). */
export function FillPicker({ value, onChange }: { value: TextileFill; onChange: (f: TextileFill) => void }) {
  return (
    <>
      <div className="eyebrow">Tekstil</div>
      <Segmented<TextileFill> inWell label="Tekstil" value={value} onChange={onChange} options={FILLS} />
      {value === 'reuse' && <p className="panel-note">Kunden har duken fra før, i samme størrelse. Bare montering.</p>}
    </>
  )
}

export function MotifPicker({ motifs, value, onChange }: { motifs: Motif[]; value?: string; onChange: (id: string | null) => void }) {
  const cur = findMotif(motifs, value)
  return (
    <div className="wd-motifs">
      <div className="eyebrow">Motiv · {cur ? cur.name : 'uten motiv'}</div>
      <div className="mot-grid">
        {[null, ...motifs].map((m) => {
          const on = (value ?? null) === (m?.id ?? null)
          return (
            <button key={m?.id ?? 'none'} type="button" className={on ? 'mot on' : 'mot'} title={m ? m.name : 'Uten motiv'} aria-label={m ? m.name : 'Uten motiv'} aria-pressed={on} onClick={() => onChange(m?.id ?? null)}>
              {m ? <img src={m.src} alt="" /> : <span className="none" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
