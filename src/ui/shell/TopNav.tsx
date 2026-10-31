import { ChevronDown, Download, FolderOpen, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Project } from '../../domain/types'
import { customerName, isFixedField, projectField } from '../../domain/variant'
import { Button, IconButton } from '../controls'

export type Page = 'skisse' | 'tilbud' | 'produksjon' | 'plukkliste' | 'produkter'

const PAGES: { key: Page; name: string }[] = [
  { key: 'skisse', name: 'Standskisse' },
  { key: 'tilbud', name: 'Tilbud' },
  { key: 'produksjon', name: 'Produksjon' },
  { key: 'plukkliste', name: 'Plukkliste' },
  { key: 'produkter', name: 'Produktliste' },
]

export function TopNav({
  page,
  setPage,
  project,
  setProject,
  onOpen,
  onSave,
}: {
  page: Page
  setPage: (p: Page) => void
  project: Project
  setProject: (p: Project) => void
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
    setProject({ fields: project.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
  const add = () => {
    let n = 1
    while (project.fields.some((f) => f.id === `felt${n}`)) n++
    setProject({ fields: [...project.fields, { id: `felt${n}`, name: 'Nytt felt', value: '' }] })
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
          {isFixedField(f.id) ? <span /> : <IconButton icon={X} label="Fjern felt" size={14} onClick={() => setProject({ fields: project.fields.filter((x) => x.id !== f.id) })} />}
        </div>
      ))}
      <div className="pop-foot">
        <Button variant="ghost" icon={Plus} onClick={add}>
          Legg til felt
        </Button>
      </div>
    </div>
  )
}
