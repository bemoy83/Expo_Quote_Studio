// Controls shared by the drawers (skuffer): wall, free-standing textile wall, door, roll carpet.
import { Trash2, Upload, X } from 'lucide-react'
import type { PointerEvent as RPointerEvent, ReactNode } from 'react'
import type { Crop } from '../../domain/print'
import type { Motif, TextileFill } from '../../domain/types'
import { FlatChoice, IconButton, ImageInput, Section } from '../controls'
import { wallPlates } from '../env'
import { decorSource } from '../dnd'
import { INK } from '../colors'
import { Sw } from './QuickPicks'

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

/** «Print» as the last choice of the palette: the motif chosen in Profilering, foil over whole plates. */
export const PRINT = 'print'

/**
 * The wall plate colours as dots, for a wall, a plate or a door leaf. With `print`, a last dot shows the motif chosen
 * in Profilering and picks `PRINT` (the wall drawer's paint bucket and brush lay it on whole plates).
 */
export function PlatePalette({ value, onPick, print }: { value: string; onPick: (ral: string) => void; print?: { motif?: Motif } }) {
  // Square swatches as in the stand settings and the dock, no track (flat drawer, Bjørn 8.11.2026)
  const m = print?.motif
  return (
    <div className="stand-swatches">
      {wallPlates().map((x) => (
        <Sw key={x.ral} color={x.color} title={`${x.name} · RAL ${x.ral}`} on={value === x.ral} onClick={() => onPick(x.ral!)} />
      ))}
      {print && (
        <Sw
          color={m ? `center / cover no-repeat url("${m.src}")` : 'repeating-linear-gradient(45deg, #d9d6cf 0 3px, #f3f1ec 3px 6px)'}
          title={m ? `Print · ${m.name}` : 'Print · velg motiv i grafikken'}
          on={value === PRINT}
          onClick={() => onPick(PRINT)}
        />
      )}
    </div>
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

/**
 * A textile's fabric and its motif in one section (Bjørn 8.11.2026): the title names the motif («DUK · HOVEDMOTIV»,
 * «DUK · MOTIV IKKE VALGT»), upload sits fixed in the title row, then print, white or the customer's own, then the
 * motifs, only for print. `note`: a line under the choice.
 */
export function FabricSection(p: {
  value: TextileFill
  onChange: (f: TextileFill) => void
  note?: ReactNode
  motifs: Motif[]
  motif?: string | null
  onPick: (id: string) => void
  onUpload: (f: File) => void
}) {
  const print = p.value === 'print'
  const name = p.motifs.find((m) => m.id === p.motif)?.name
  return (
    <Section title="Duk" aside={print ? (name ?? 'motiv ikke valgt') : undefined} className="wd-sec" tools={<UploadButton onUpload={p.onUpload} />}>
      <FlatChoice<TextileFill> label="Duk" value={p.value} onChange={p.onChange} options={FILLS} />
      {p.value === 'reuse' ? <p className="set-note">Kunden har duken fra før, i samme størrelse. Bare montering.</p> : p.note && <p className="set-note">{p.note}</p>}
      {print && <MotifGrid motifs={p.motifs} value={p.motif} onPick={p.onPick} onUpload={p.onUpload} />}
    </Section>
  )
}

/** Upload a print file: an icon fixed in a section's title row, so it never scrolls away with the motifs. */
function UploadButton({ onUpload }: { onUpload: (f: File) => void }) {
  return (
    <label className="icon-btn" title="Last opp trykkfil" aria-label="Last opp trykkfil">
      <Upload size={15} />
      <ImageInput onFile={onUpload} />
    </label>
  )
}

/**
 * The motif library as small tiles: click to put one on what is selected, or drag onto the wall drawing (or the plan and
 * 3D). Print files only: no «Uten motiv» tile, as no motif is not a print (Bjørn 8.11.2026); «Kun ramme» may come later
 * as its own switch. An empty library offers one wide upload button, as it is empty while the seller draws.
 */
function MotifGrid({ motifs, value, onPick, onUpload }: { motifs: Motif[]; value?: string | null; onPick?: (id: string) => void; onUpload: (f: File) => void }) {
  if (!motifs.length)
    return (
      <label className="btn ghost wd-upload">
        <Upload size={15} />
        Last opp trykkfil
        <ImageInput onFile={onUpload} />
      </label>
    )
  return (
    <div className="wd-shelf-grid">
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
    </div>
  )
}

/**
 * The drawer's motif library, under the settings (detail height only): print files only, upload fixed in the title row.
 * Buttons above the motifs come in as children (the wall drawer's Profilering: «Dekal», «Tekstilvegg»).
 */
export function Shelf({ title, aside, motifs, value, onPick, onUpload, children }: {
  title: string
  aside?: string
  motifs: Motif[]
  value?: string | null
  onPick?: (id: string) => void
  onUpload: (f: File) => void
  /** Buttons over the motifs (Profilering: add a decal or a textile wall). */
  children?: ReactNode
}) {
  return (
    <Section title={title} aside={aside} className="wd-sec" tools={motifs.length > 0 && <UploadButton onUpload={onUpload} />}>
      {children && <div className="wd-actions">{children}</div>}
      <MotifGrid motifs={motifs} value={value} onPick={onPick} onUpload={onUpload} />
    </Section>
  )
}

/** Which edge or corner of a box a handle drags. */
export type Edge = 'l' | 'r' | 't' | 'b' | 'tl' | 'tr' | 'bl' | 'br'

const SIDES: Edge[] = ['l', 'r', 't', 'b']
const CORNERS: Edge[] = ['tl', 'tr', 'bl', 'br']
const CURSOR: Record<Edge, string> = { l: 'ew', r: 'ew', t: 'ns', b: 'ns', tl: 'nwse', br: 'nwse', tr: 'nesw', bl: 'nesw' }

/** Handles on a box in a drawing (metres, y down): on every edge and corner, or on the corners only. `k`: smaller for a
 *  smaller drawing (a counter's side). */
export function Handles({ x, y, w, h, corners, k = 1, onDown }: { x: number; y: number; w: number; h: number; corners?: boolean; k?: number; onDown: (e: RPointerEvent, edge: Edge) => void }) {
  const t = 0.07 * k
  const len = Math.min(0.2 * k, w / 3, h / 3)
  const c = 0.08 * k
  const at = (e: Edge) => {
    const hx = e.includes('l') ? x : e.includes('r') ? x + w : x + w / 2
    const hy = e.includes('t') ? y : e.includes('b') ? y + h : y + h / 2
    if (e.length === 2) return { x: hx - c / 2, y: hy - c / 2, width: c, height: c }
    return e === 'l' || e === 'r' ? { x: hx - t / 2, y: hy - len / 2, width: t, height: len } : { x: hx - len / 2, y: hy - t / 2, width: len, height: t }
  }
  return (
    <g>
      {(corners ? CORNERS : [...SIDES, ...CORNERS]).map((e) => (
        <rect key={e} {...at(e)} rx={0.015 * k} fill={INK} style={{ cursor: `${CURSOR[e]}-resize` }} onPointerDown={(ev) => onDown(ev, e)} />
      ))}
    </g>
  )
}
