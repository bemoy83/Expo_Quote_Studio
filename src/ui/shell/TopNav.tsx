import { ChevronDown, Download, FolderOpen, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Project } from '../../domain/types'
import { FIXED_PROJECT_FIELDS } from '../../domain/variant'
import { Button, IconButton } from '../controls'

export type Page = 'skisse' | 'tilbud' | 'produksjon' | 'produkter'

const PAGES: { key: Page; name: string }[] = [
  { key: 'skisse', name: 'Standskisse' },
  { key: 'tilbud', name: 'Tilbud' },
  { key: 'produksjon', name: 'Produksjon' },
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
  const customer = project.fields.find((f) => f.id === 'kunde')?.value.trim()
  const proj = project.fields.find((f) => f.id === 'prosjekt')?.value.trim()
  return (
    <header className="topnav no-print" style={{ position: 'relative' }}>
      <span className="brand">Expo Planner</span>
      {PAGES.map((p) => (
        <button key={p.key} type="button" className="navb" aria-current={page === p.key ? 'page' : undefined} onClick={() => setPage(p.key)}>
          {p.name}
        </button>
      ))}
      <button type="button" className="btn ghost" style={{ marginLeft: 16 }} aria-expanded={open} onClick={() => setOpen(!open)}>
        {customer ? [customer, proj].filter(Boolean).join(' · ') : 'Legg inn kunde og prosjekt'}
        <ChevronDown size={14} />
      </button>
      {open && <ProjectPopover project={project} setProject={setProject} onClose={() => setOpen(false)} />}
      <span style={{ flex: 1 }} />
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
  const fixed = new Set<string>(FIXED_PROJECT_FIELDS.map((f) => f.id))
  const update = (id: string, patch: { name?: string; value?: string }) =>
    setProject({ fields: project.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
  const add = () => {
    let n = 1
    while (project.fields.some((f) => f.id === `felt${n}`)) n++
    setProject({ fields: [...project.fields, { id: `felt${n}`, name: 'Nytt felt', value: '' }] })
  }
  return (
    <div ref={ref} className="popover proj-pop" style={{ left: 420 }} role="dialog" aria-label="Kunde og prosjekt">
      <div style={{ font: '600 14px var(--font-ui)' }}>Kunde og prosjekt</div>
      <div style={{ font: '400 12.5px var(--font-ui)', color: 'rgb(var(--ink-muted))', marginTop: 2 }}>Vises på tilbudet. Kundenavnet brukes i filnavn for produksjon.</div>
      {project.fields.map((f) => (
        <div key={f.id} className="row">
          {fixed.has(f.id) ? (
            <label htmlFor={`pf-${f.id}`}>{f.name}</label>
          ) : (
            <input className="field" aria-label="Feltnavn" value={f.name} onChange={(e) => update(f.id, { name: e.target.value })} />
          )}
          <input id={`pf-${f.id}`} className="field" value={f.value} onChange={(e) => update(f.id, { value: e.target.value })} />
          {fixed.has(f.id) ? <span /> : <IconButton icon={X} label="Fjern felt" size={14} onClick={() => setProject({ fields: project.fields.filter((x) => x.id !== f.id) })} />}
        </div>
      ))}
      <div style={{ marginTop: 10 }}>
        <Button variant="ghost" icon={Plus} onClick={add}>
          Legg til felt
        </Button>
      </div>
    </div>
  )
}
