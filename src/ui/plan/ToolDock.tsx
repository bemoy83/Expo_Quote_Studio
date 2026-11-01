// Floating tools on the drawing surface as one surface: undo and redo, then one icon per tool (Velg · Vegg · Gulv ·
// Profilering · Møbel · Tøm) in the bar; the active tool's quick picks, and «Alle valg» when it is clicked again, on a
// shelf on top. The active tool shows its name and takes the shelf's tone. A short stripe under Vegg and Gulv shows the
// colour they draw with; a mark on Vegg shows when it draws a door, curtain or beam instead of wall.
import type { LucideIcon } from 'lucide-react'
import { Armchair, Blinds, BrickWall, DoorClosed, Eraser, Grid2x2, Image, MousePointer2, Redo2, Undo2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { BeamIcon } from './QuickPicks'
import type { DockTool } from '../tools'

interface ToolDef {
  id: DockTool
  name: string
  key: string
  icon: LucideIcon
  /** Has quick picks and «Alle valg». */
  options?: true
}

const DOCK_TOOLS: ToolDef[] = [
  { id: 'select', name: 'Velg', key: 'V', icon: MousePointer2 },
  { id: 'wall', name: 'Vegg', key: 'S', icon: BrickWall, options: true },
  { id: 'floor', name: 'Gulv', key: 'G', icon: Grid2x2, options: true },
  { id: 'profile', name: 'Profilering', key: 'T', icon: Image, options: true },
  { id: 'object', name: 'Møbel', key: 'M', icon: Armchair, options: true },
  { id: 'erase', name: 'Tøm', key: 'E', icon: Eraser },
]

export type WallMark = 'door' | 'curtain' | 'beam' | null

export function ToolDock({
  tools,
  active,
  onTool,
  stripes,
  wallMark,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  picker,
  children,
}: {
  /** False in 3D: the tools draw in the plan only, so 3D gets undo and redo alone. */
  tools: boolean
  active: DockTool
  onTool: (t: DockTool) => void
  /** Colour each tool draws with (wall RAL, floor colour). */
  stripes: Partial<Record<DockTool, string | undefined>>
  wallMark: WallMark
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  /** «Alle valg» for the active tool, over everything else. */
  picker?: ReactNode
  /** The active tool's quick picks (QuickPicks). */
  children?: ReactNode
}) {
  // While a stroke is drawn in the plan, the shelf steps back so the stand shows through
  const [drawing, setDrawing] = useState(false)
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if ((e.target as Element).closest('.plan-wrap > .plan-svg')) setDrawing(true)
    }
    const up = () => setDrawing(false)
    document.addEventListener('pointerdown', down)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', up)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
    }
  }, [])
  const shelf = tools && (picker || children)
  return (
    <div className="dock">
      <div className={['dock-surface', shelf && 'has-shelf', drawing && 'drawing'].filter(Boolean).join(' ')}>
        {shelf && (
          <div className="dock-shelf">
            {picker}
            {children}
          </div>
        )}
        <div className="dock-bar">
          <div className="dock-undo">
            <button type="button" className="dock-btn" title="Angre (⌘Z)" aria-label="Angre" disabled={!canUndo} onClick={onUndo}>
              <Undo2 size={18} />
            </button>
            <button type="button" className="dock-btn" title="Gjør om (⇧⌘Z)" aria-label="Gjør om" disabled={!canRedo} onClick={onRedo}>
              <Redo2 size={18} />
            </button>
          </div>
          {tools && (
            <div className="dock-tools" role="toolbar" aria-label="Verktøy">
              {DOCK_TOOLS.map((t) => {
                const on = active === t.id
                const stripe = stripes[t.id]
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="dock-btn"
                    aria-pressed={on}
                    aria-label={t.name}
                    title={`${t.name} (${t.key})${t.options ? ' · klikk igjen for alle valg' : ''}`}
                    onClick={() => onTool(t.id)}
                  >
                    <t.icon size={on ? 18 : 19} />
                    {on && <span className="dock-name">{t.name === 'Profilering' ? 'Profil' : t.name}</span>}
                    {stripe && <i className="dock-stripe" style={{ background: stripe }} />}
                    {t.id === 'wall' && wallMark && (
                      <span className="dock-mark">{wallMark === 'door' ? <DoorClosed size={10} /> : wallMark === 'curtain' ? <Blinds size={10} /> : <BeamIcon size={10} />}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
