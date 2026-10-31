import { ChevronDown, Download, FilePlus, FolderOpen, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DELIVERY_FIELDS } from '../../domain/delivery'
import type { Delivery, Payer, Project } from '../../domain/types'
import { customerName, isFixedField, projectField, standWallTerms } from '../../domain/variant'
import { Button, IconButton } from '../controls'
import { idx } from '../env'

export type Page = 'skisse' | 'tilbud' | 'produksjon' | 'plukkliste' | 'arbeidsordre' | 'produkter'

const PAGES: { key: Page; name: string }[] = [
  { key: 'skisse', name: 'Standskisse' },
  { key: 'tilbud', name: 'Tilbud' },
  { key: 'produksjon', name: 'Produksjon' },
  { key: 'plukkliste', name: 'Plukkliste' },
  { key: 'arbeidsordre', name: 'Arbeidsordre' },
  { key: 'produkter', name: 'Produktliste' },
]

export function TopNav({
  page,
  setPage,
  project,
  setProject,
  onNew,
  onOpen,
  onSave,
}: {
  page: Page
  setPage: (p: Page) => void
  project: Project
  setProject: (p: Project) => void
  onNew: () => void
  onOpen: () => void
  onSave: () => void
}) {
  const [open, setOpen] = useState(false)
  const customer = customerName(project)
  const proj = projectField(project, 'prosjekt')
  return (
    <header className="topnav no-print">
      <span className="brand">Expo Planner</span>
      {PAGES.map((p) => (
        <button key={p.key} type="button" className="navb" aria-current={page === p.key ? 'page' : undefined} onClick={() => setPage(p.key)}>
          {p.name}
        </button>
      ))}
      <button type="button" className="btn ghost proj-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {customer ? [customer, proj].filter(Boolean).join(' · ') : 'Legg inn kunde og prosjekt'}
        <ChevronDown size={14} />
      </button>
      {open && <ProjectPopover project={project} setProject={setProject} onClose={() => setOpen(false)} />}
      <span className="spacer" />
      <Button icon={FilePlus} onClick={onNew}>
        Ny
      </Button>
      <Button icon={FolderOpen} onClick={onOpen}>
        Åpne fil
      </Button>
      <Button icon={Download} onClick={onSave}>
        Lagre fil
      </Button>
      <span className="poc">Proof of concept · intern bruk</span>
    </header>
  )
}

function ProjectPopover({ project, setProject, onClose }: { project: Project; setProject: (p: Project) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('[aria-expanded]')) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', down)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('keydown', key)
    }
  }, [onClose])
  const update = (id: string, patch: { name?: string; value?: string }) =>
    setProject({ ...project, fields: project.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
  const setDate = (key: keyof Delivery, value: string) => setProject({ ...project, delivery: { ...project.delivery, [key]: value || undefined } })
  const terms = standWallTerms(project)
  const setTerms = (patch: { payer?: Payer; ral?: string }) => setProject({ ...project, standWalls: { ...terms, ...patch } })
  const add = () => {
    let n = 1
    while (project.fields.some((f) => f.id === `felt${n}`)) n++
    setProject({ ...project, fields: [...project.fields, { id: `felt${n}`, name: 'Nytt felt', value: '' }] })
  }
  return (
    <div ref={ref} className="popover proj-pop" role="dialog" aria-label="Kunde og prosjekt">
      <div className="pop-title">Kunde og prosjekt</div>
      <div className="pop-sub">Vises på tilbudet. Kundenavnet brukes i filnavn for produksjon.</div>
      {project.fields.map((f) => (
        <div key={f.id} className="row">
          {isFixedField(f.id) ? (
            <label htmlFor={`pf-${f.id}`}>{f.name}</label>
          ) : (
            <input className="field" aria-label="Feltnavn" value={f.name} onChange={(e) => update(f.id, { name: e.target.value })} />
          )}
          <input id={`pf-${f.id}`} className="field" value={f.value} onChange={(e) => update(f.id, { value: e.target.value })} />
          {isFixedField(f.id) ? <span /> : <IconButton icon={X} label="Fjern felt" size={14} onClick={() => setProject({ ...project, fields: project.fields.filter((x) => x.id !== f.id) })} />}
        </div>
      ))}
      <div className="pop-foot">
        <Button variant="ghost" icon={Plus} onClick={add}>
          Legg til felt
        </Button>
      </div>
      <div className="pop-title pop-sect">Leveranse</div>
      <div className="pop-sub">Plassholder: datoene hentes fra prosjektet i OMS senere. Montering styrer hvor lenge tilbudet gjelder.</div>
      {DELIVERY_FIELDS.map((d) => (
        <div key={d.key} className="row">
          <label htmlFor={`pd-${d.key}`}>{d.name}</label>
          <input id={`pd-${d.key}`} type="date" className="field" value={project.delivery?.[d.key] ?? ''} onChange={(e) => setDate(d.key, e.target.value)} />
          <span />
        </div>
      ))}
      <div className="pop-title pop-sect">Standvegger</div>
      <div className="pop-sub">
        Veggene standtypen gir, og takdragerne som følger dem. Betaler arrangøren, er de ikke på tilbudet, plukklisten eller arbeidsordren. Annen farge enn arrangørens blir platebytte for
        utstilleren.
      </div>
      <div className="row">
        <label htmlFor="ps-payer">Betales av</label>
        <select id="ps-payer" className="field" value={terms.payer} onChange={(e) => setTerms({ payer: e.target.value as Payer })}>
          <option value="arrangør">Arrangør</option>
          <option value="utstiller">Utstiller</option>
        </select>
        <span />
      </div>
      {terms.payer === 'arrangør' && (
        <div className="row">
          <label htmlFor="ps-ral">Arrangørens farge</label>
          <select id="ps-ral" className="field" value={terms.ral} onChange={(e) => setTerms({ ral: e.target.value })}>
            {[...idx.wallByRal.values()].map(({ variant }) => (
              <option key={variant.ral} value={variant.ral}>
                {variant.name} · RAL {variant.ral}
              </option>
            ))}
          </select>
          <span />
        </div>
      )}
    </div>
  )
}
