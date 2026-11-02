// Controls shared by the drawers (skuffer): wall, free-standing textile wall, door, roll carpet.
import { Minus, Plus, Upload } from 'lucide-react'
import { useRef, type PointerEvent as RPointerEvent } from 'react'
import type { TextileFill } from '../../domain/types'
import type { Motif } from '../../persistence/file'
import { CommitInput, IconButton, Segmented } from '../controls'
import { fmt } from '../format'
import { decorSource } from '../dnd'
import { INK } from '../colors'

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
            const n = parseLength(text)
            if (n === null) return false
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

/** Parse a typed length: comma or point, units and spaces ignored. Null when it is not a number. */
function parseLength(text: string): number | null {
  const n = Number(text.replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && text.trim() !== '' ? n : null
}

/** A length in metres as a small field with its label above, three to a row. The handles in the drawing do the rest. */
export function SmallDim({ label, value, onChange, decimals = 1 }: { label: string; value: number; onChange: (n: number) => void; decimals?: number }) {
  return (
    <label className="wd-sdim">
      <span className="eyebrow">{label}</span>
      <CommitInput
        className="field num"
        aria-label={`${label} i meter`}
        inputMode="decimal"
        value={fmt(value, decimals)}
        selectOnFocus
        onCommit={(text) => {
          const n = parseLength(text)
          if (n === null) return false
          onChange(n)
        }}
      />
    </label>
  )
}

/**
 * The drawer's graphics shelf: the motif library as tiles you click to put on what is selected, or drag onto the
 * wall drawing (or the plan and 3D). `value` is the selected item's motif: undefined when nothing that takes a motif is
 * selected, null for none. A textile-frame tile to drag comes first when `textile`, an upload tile last.
 */
export function Shelf({
  label,
  motifs,
  value,
  textile,
  onPick,
  onUpload,
}: {
  label: string
  motifs: Motif[]
  value?: string | null
  textile?: boolean
  onPick?: (id: string | null) => void
  onUpload: (f: File) => void
}) {
  const file = useRef<HTMLInputElement>(null)
  return (
    <div className="wd-shelf">
      <div className="eyebrow">{label}</div>
      <div className="wd-shelf-grid">
        {textile && (
          <button type="button" className="mot" title="Tekstilvegg · dra til veggen" aria-label="Tekstilvegg, dra til veggen" {...decorSource({ kind: 'textile' })}>
            <i className="tex-thumb" />
          </button>
        )}
        {onPick && (
          <button type="button" className={value === null ? 'mot on' : 'mot'} title="Uten motiv" aria-label="Uten motiv" aria-pressed={value === null} onClick={() => onPick(null)}>
            <span className="none" />
          </button>
        )}
        {motifs.map((m) => {
          const on = value === m.id
          return (
            <button
              key={m.id}
              type="button"
              className={on ? 'mot on' : 'mot'}
              title={onPick ? m.name : `${m.name} · dra til en plate eller tekstilvegg`}
              aria-label={m.name}
              aria-pressed={on}
              onClick={onPick && (() => onPick(m.id))}
              {...decorSource({ kind: 'motif', motif: m.id })}
            >
              <img src={m.src} alt="" draggable={false} />
            </button>
          )
        })}
        <button type="button" className="mot add" title="Last opp motiv" aria-label="Last opp motiv" onClick={() => file.current?.click()}>
          <Upload size={15} />
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUpload(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/** Which edge or corner of a box a handle drags. */
export type Edge = 'l' | 'r' | 't' | 'b' | 'tl' | 'tr' | 'bl' | 'br'

const SIDES: Edge[] = ['l', 'r', 't', 'b']
const CORNERS: Edge[] = ['tl', 'tr', 'bl', 'br']
const CURSOR: Record<Edge, string> = { l: 'ew', r: 'ew', t: 'ns', b: 'ns', tl: 'nwse', br: 'nwse', tr: 'nesw', bl: 'nesw' }

/** Handles on a box in a drawing (metres, y down): on every edge and corner, or on the corners only. */
export function Handles({ x, y, w, h, corners, onDown }: { x: number; y: number; w: number; h: number; corners?: boolean; onDown: (e: RPointerEvent, edge: Edge) => void }) {
  const t = 0.07
  const len = Math.min(0.2, w / 3, h / 3)
  const c = 0.08
  const at = (e: Edge) => {
    const hx = e.includes('l') ? x : e.includes('r') ? x + w : x + w / 2
    const hy = e.includes('t') ? y : e.includes('b') ? y + h : y + h / 2
    if (e.length === 2) return { x: hx - c / 2, y: hy - c / 2, width: c, height: c }
    return e === 'l' || e === 'r' ? { x: hx - t / 2, y: hy - len / 2, width: t, height: len } : { x: hx - len / 2, y: hy - t / 2, width: len, height: t }
  }
  return (
    <g>
      {(corners ? CORNERS : [...SIDES, ...CORNERS]).map((e) => (
        <rect key={e} {...at(e)} rx={0.015} fill={INK} style={{ cursor: `${CURSOR[e]}-resize` }} onPointerDown={(ev) => onDown(ev, e)} />
      ))}
    </g>
  )
}
