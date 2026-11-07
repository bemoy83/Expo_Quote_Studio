// Editing on the Kostgrunnlag page: one number in a sheet beside the list, a pasted price list, and the changes
// waiting to be saved as a new version. Nothing changes the calc until the version is saved. docs/kostmodell.md.
import { Check, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { FIELD_STATUSES, type FieldNote, type FieldStatus } from '../../cost/basis'
import type { Field } from '../../cost/fields'
import { parseNumber, readPastedList } from '../../cost/history'
import { Button, IconButton, Segmented } from '../controls'
import { today } from './link'
import { fmt } from '../format'

export interface Pending {
  value: number
  note?: FieldNote
}

/** The number as it is typed in the sheet: shares in %. */
const typed = (f: Pick<Field, 'unit'>, v: number) => fmt(f.unit === '%' ? v * 100 : v, 6).replace(/ /g, '')
const unitText = (u: string) => (u === '%' ? '%' : u)

/** One number: its new value, status and source. */
export function FieldSheet({ f, pending, onApply, onUndo, onClose }: { f: Field; pending?: Pending; onApply: (p: Pending) => void; onUndo: () => void; onClose: () => void }) {
  const [text, setText] = useState(typed(f, pending?.value ?? f.value))
  const [status, setStatus] = useState<FieldStatus>(pending?.note?.status ?? (f.own ? f.status : 'Bjørn'))
  const [source, setSource] = useState(pending?.note?.kilde ?? (f.own ? f.source : ''))
  const n = parseNumber(text)
  const value = n === null ? null : f.unit === '%' ? n / 100 : n
  const apply = () => {
    if (value === null) return
    onApply({ value, note: { status, ...(source.trim() ? { kilde: source.trim() } : {}), dato: today() } })
  }
  return (
    <aside className="popover kg-sheet" aria-label={`Endre ${f.label}`}>
      <div className="kg-sheet-head">
        <span className="t">{f.label}</span>
        <IconButton icon={X} label="Lukk" onClick={onClose} />
      </div>
      <p className="kg-path">{f.path}</p>
      <label className="kg-field">
        <span>Verdi</span>
        <span className="kg-input">
          <input
            className="cin num"
            inputMode="decimal"
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            aria-invalid={value === null}
          />
          <span className="muted">{unitText(f.unit)}</span>
        </span>
      </label>
      <p className="kg-was">
        Nå {typed(f, f.value)} {unitText(f.unit)} · {f.status} · {f.source} · {f.date}
        {f.unused ? ' · ikke i bruk i kalkylen ennå' : ''}
      </p>
      <div className="kg-field">
        <span>Status</span>
        <Segmented inWell label="Status" options={FIELD_STATUSES.filter((s) => s !== 'eksempel').map((s) => ({ value: s, label: s }))} value={status} onChange={setStatus} />
      </div>
      <label className="kg-field">
        <span>Kilde</span>
        <input className="cin kg-text" value={source} placeholder="Hvor tallet kommer fra" onChange={(e) => setSource(e.target.value)} />
      </label>
      <div className="kg-sheet-foot">
        {pending && (
          <Button icon={RotateCcw} onClick={onUndo}>
            Angre endringen
          </Button>
        )}
        <span className="spacer" />
        <Button variant="primary" icon={Check} disabled={value === null} onClick={apply}>
          Bruk
        </Button>
      </div>
    </aside>
  )
}

/** A price list pasted in: art.nr and price per line, read into changes for one supplier's list. */
export function PasteSheet({ fields, suppliers, onApply, onClose }: { fields: readonly Field[]; suppliers: readonly string[]; onApply: (c: { field: Field; value: number }[]) => void; onClose: () => void }) {
  const [supplier, setSupplier] = useState(suppliers[0] ?? '')
  const [text, setText] = useState('')
  const r = readPastedList(text, fields, supplier)
  return (
    <aside className="popover kg-sheet" aria-label="Lim inn prisliste">
      <div className="kg-sheet-head">
        <span className="t">Lim inn prisliste</span>
        <IconButton icon={X} label="Lukk" onClick={onClose} />
      </div>
      <p className="kg-was">Én vare per linje: varenr først og pris sist, slik det limes fra et regneark. Varenr med og uten mellomrom er like. Pris i listens valuta.</p>
      {suppliers.length > 1 && (
        <div className="kg-field">
          <span>Liste</span>
          <Segmented inWell label="Liste" options={suppliers.map((s) => ({ value: s, label: s.replace(/\s*\(.*\)$/, '') }))} value={supplier} onChange={setSupplier} />
        </div>
      )}
      <textarea className="kg-paste" value={text} placeholder={'873 062 22\tProfil 94\t104,50'} onChange={(e) => setText(e.target.value)} aria-label="Prisliste" />
      <p className="kg-was">
        {r.lines ? `${r.lines} linjer med pris · ${r.changes.length} nye priser` : 'Ingen linjer med pris ennå.'}
        {r.unknown.length ? ` · ukjente varenr hoppes over: ${r.unknown.slice(0, 6).join(', ')}${r.unknown.length > 6 ? ' …' : ''}` : ''}
      </p>
      <div className="kg-sheet-foot">
        <span className="spacer" />
        <Button variant="primary" icon={Check} disabled={!r.changes.length} onClick={() => onApply(r.changes)}>
          Bruk {r.changes.length || ''} priser
        </Button>
      </div>
    </aside>
  )
}

/** The changes not saved yet, and saving them as a new version. */
export function PendingBar({
  count,
  version,
  current,
  onSave,
  onDiscard,
}: {
  count: number
  version: string
  current: string
  onSave: (version: string, comment: string) => void
  onDiscard: () => void
}) {
  const [name, setName] = useState(version)
  const [comment, setComment] = useState('')
  const same = name.trim() === current || name.trim() === 'eksempel'
  return (
    <div className="popover kg-pending" role="region" aria-label="Endringer som ikke er lagret">
      <span className="t">
        {count} {count === 1 ? 'endring' : 'endringer'} ikke lagret
      </span>
      <label className="kg-pend-field">
        <span className="muted">Ny versjon</span>
        <input className="cin" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={same || !name.trim()} />
      </label>
      <input className="cin kg-comment" value={comment} placeholder="Kommentar: hva og hvorfor" onChange={(e) => setComment(e.target.value)} aria-label="Kommentar" />
      <Button onClick={onDiscard}>Forkast</Button>
      <Button variant="primary" icon={Check} disabled={same || !name.trim()} title={same ? 'En endring lagres som en ny versjon med nytt navn' : undefined} onClick={() => onSave(name.trim(), comment.trim())}>
        Lagre versjon
      </Button>
    </div>
  )
}
