import { ChevronDown, Download, FilePlus, FolderOpen, Monitor, Moon, Plus, Sun, X } from 'lucide-react'
import { useRef, useState, type RefObject } from 'react'
import { DELIVERY_FIELDS } from '../../domain/delivery'
import type { Delivery, Project } from '../../domain/types'
import { customerName, isFixedField, projectField } from '../../domain/variant'
import { Button, IconButton } from '../controls'
import { nextTheme, useTheme } from '../theme'
import { useDismiss } from '../useDismiss'

export type Page = 'skisse' | 'tilbud' | 'produksjon' | 'plukkliste' | 'arbeidsordre' | 'produkter'

const THEME = {
  system: { icon: Monitor, label: 'Tema: som systemet' },
  light: { icon: Sun, label: 'Tema: lyst' },
  dark: { icon: Moon, label: 'Tema: mørkt' },
} as const

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
  const [theme, setTheme] = useTheme()
  const button = useRef<HTMLButtonElement>(null)
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
      <button ref={button} type="button" className="btn ghost proj-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {customer ? [customer, proj].filter(Boolean).join(' · ') : 'Legg inn kunde og prosjekt'}
        <ChevronDown size={14} />
      </button>
      {open && <ProjectPopover project={project} setProject={setProject} button={button} onClose={() => setOpen(false)} />}
      <IconButton icon={THEME[theme].icon} label={`${THEME[theme].label} · klikk for å bytte`} onClick={() => setTheme(nextTheme(theme))} />
      <span className="spacer" />
      <Button icon={FilePlus} title="Ny skisse" onClick={onNew}>
        Ny
      </Button>
      <Button icon={FolderOpen} title="Åpne fil" onClick={onOpen}>
        Åpne fil
      </Button>
      <Button icon={Download} title="Lagre fil" onClick={onSave}>
        Lagre fil
      </Button>
      <span className="poc">Proof of concept · intern bruk</span>
    </header>
  )
}

function ProjectPopover({
  project,
  setProject,
  button,
  onClose,
}: {
  project: Project
  setProject: (p: Project) => void
  /** The button that opens it: a press there toggles, it does not close-and-reopen. */
  button: RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, button, onClose)
  const update = (id: string, patch: { name?: string; value?: string }) =>
    setProject({ ...project, fields: project.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
  const setDate = (key: keyof Delivery, value: string) => setProject({ ...project, delivery: { ...project.delivery, [key]: value || undefined } })
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
    </div>
  )
}
