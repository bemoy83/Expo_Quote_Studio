// Controls shared by the drawers (skuffer): wall, free-standing textile wall, door, roll carpet.
import { Trash2, Upload, X } from 'lucide-react'
import type { PointerEvent as RPointerEvent, ReactNode } from 'react'
import type { Crop } from '../../domain/print'
import type { TextileFill } from '../../domain/types'
import type { Motif } from '../../persistence/file'
import { IconButton, ImageInput, Segmented } from '../controls'
import { wallPlates } from '../env'
import { decorSource } from '../dnd'
import { INK } from '../colors'
import { VariantChips } from '../panel/ProductRow'

/**
 * The top of every drawer: a dot in the colour of what is chosen, its name, the drawer's own icon buttons (`children`),
 * then delete when it can be removed and close.
 */
export function DrawerHead({ dot, title, remove, onClose, children }: { dot?: string; title: string; remove?: { label: string; onClick: () => void }; onClose: () => void; children?: ReactNode }) {
  return (
    <div className="wd-head">
      <i className="dot" style={{ background: dot }} />
      <h3>{title}</h3>
      {children}
      {remove && <IconButton icon={Trash2} label={remove.label} size={14} onClick={remove.onClick} />}
      <IconButton icon={X} label="Lukk" title="Lukk skuffen" size={14} onClick={onClose} />
    </div>
  )
}

/** A setting as one line: what it is now, and the icon buttons that change it. */
export function DrawerRow({ label, children }: { label: ReactNode; children?: ReactNode }) {
  return (
    <div className="wd-row">
      <span className="eyebrow">{label}</span>
      {children}
    </div>
  )
}

/** «Print» as the last choice of the palette: the motif chosen in the graphics shelf, foil over whole plates. */
export const PRINT = 'print'

/**
 * The wall plate colours as dots, for a wall, a plate or a door leaf. With `print`, a last dot shows the motif chosen
 * in the graphics shelf and picks `PRINT` (the wall drawer's paint bucket and brush lay it on whole plates).
 */
export function PlatePalette({ value, onPick, print }: { value: string; onPick: (ral: string) => void; print?: { motif?: Motif } }) {
  const plates = wallPlates()
  const chips = plates.map((x) => ({ name: `${x.name} · RAL ${x.ral}`, color: x.color! }))
  if (print) {
    const m = print.motif
    chips.push({
      name: m ? `Print · ${m.name}` : 'Print · velg motiv i grafikken',
      color: m ? `center / cover no-repeat url("${m.src}")` : 'repeating-linear-gradient(45deg, #d9d6cf 0 3px, #f3f1ec 3px 6px)',
    })
  }
  return (
    <VariantChips
      chips={chips}
      selected={value === PRINT ? plates.length : plates.findIndex((x) => x.ral === value)}
      onSelect={(i) => onPick(i === plates.length ? PRINT : plates[i].ral!)}
    />
  )
}

/**
 * A motif filling a box, cropped like the 3D print, or the part `crop` of it (a plate of a stretched print). Drawn in
 * its own viewport of the motif's shape: an SVG motif in a plain <image> would letterbox itself inside the box instead
 * of being cropped. The viewport is 100 units high: Chrome leaves out an image under one unit wide (a tall motif,
 * 0.4 × 1, went missing).
 */
export function Print({ m, x, y, width, height, crop }: { m: Motif; x: number; y: number; width: number; height: number; crop?: Crop }) {
  const box = crop ? `${crop[0] * m.ratio * 100} ${crop[1] * 100} ${(crop[2] - crop[0]) * m.ratio * 100} ${(crop[3] - crop[1]) * 100}` : `0 0 ${m.ratio * 100} 100`
  return (
    <svg x={x} y={y} width={width} height={height} viewBox={box} preserveAspectRatio={crop ? 'none' : 'xMidYMid slice'}>
      <image href={m.src} width={m.ratio * 100} height={100} />
    </svg>
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
  required,
  onPick,
  onUpload,
}: {
  label: string
  motifs: Motif[]
  value?: string | null
  textile?: boolean
  /** A motif must be chosen (print on plates): no «Uten motiv» tile. */
  required?: boolean
  onPick?: (id: string | null) => void
  onUpload: (f: File) => void
}) {
  return (
    <div className="wd-sec wd-shelf">
      <div className="eyebrow">{label}</div>
      <div className="wd-shelf-grid">
        {textile && (
          <button type="button" className="mot" title="Tekstilvegg · dra til veggen" aria-label="Tekstilvegg, dra til veggen" {...decorSource({ kind: 'textile' })}>
            <i className="tex-thumb" />
          </button>
        )}
        {onPick && !required && (
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
        <label className="mot add" title="Last opp motiv" aria-label="Last opp motiv">
          <Upload size={15} />
          <ImageInput onFile={onUpload} />
        </label>
      </div>
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
