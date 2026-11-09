// Floating tools on the drawing surface, one icon per tool: Velg · Vegg · Gulv · Profilering · Hyller · Møbel · Tøm
// at the bottom, undo and redo on their own pill to the left. Over the active tool: its quick picks. A short stripe under
// Vegg and Gulv shows the colour they draw with. Over the quick picks: the price change of an edit made outside the
// plan (PriceChangePill).
import type { LucideIcon } from 'lucide-react'
import { Armchair, BrickWall, Eraser, Grid2x2, Image, Library, MousePointer2, Redo2, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DockTool } from '../tools'
import { PriceChangePill } from './PriceChangePill'
import type { PriceChange } from './usePriceChange'

interface ToolDef {
  id: DockTool
  name: string
  /** What it does, under the name in the name pill. */
  more: string
  key: string
  icon: LucideIcon
}

const DOCK_TOOLS: ToolDef[] = [
  { id: 'select', name: 'Velg', more: 'velg, flytt og endre det som står i planen', key: 'V', icon: MousePointer2 },
  { id: 'wall', name: 'Vegg', more: 'innervegger, dører, takdragere og bakrom', key: 'S', icon: BrickWall },
  { id: 'floor', name: 'Gulv', more: 'teppefliser og engangsteppe', key: 'G', icon: Grid2x2 },
  { id: 'profile', name: 'Profilering', more: 'tekstilvegger, print og motiver', key: 'T', icon: Image },
  { id: 'fitting', name: 'Hyller', more: 'hyller i veggfeltene', key: 'H', icon: Library },
  { id: 'object', name: 'Møbel', more: 'plasser møbler på standen', key: 'M', icon: Armchair },
  { id: 'erase', name: 'Tøm', more: 'fjern det du peker på', key: 'E', icon: Eraser },
]

export function ToolDock({
  tools,
  active,
  onTool,
  stripes,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  change,
  children,
}: {
  /** False in 3D: the tools draw in the plan only, so 3D gets undo and redo alone. */
  tools: boolean
  active: DockTool
  onTool: (t: DockTool) => void
  /** Colour each tool draws with (wall RAL, floor colour). */
  stripes: Partial<Record<DockTool, string | undefined>>
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  /** Change in the exhibitor's sum (usePriceChange) when it did not come from drawing in the plan; null hides it. */
  change: PriceChange | null
  /** The active tool's quick picks (QuickPicks). */
  children?: ReactNode
}) {
  return (
    <div className="dock">
      <div className="dock-pill dock-undo">
        <button type="button" className="dock-btn" title="Angre · siste endring (⌘Z)" aria-label="Angre" disabled={!canUndo} onClick={onUndo}>
          <Undo2 size={18} />
        </button>
        <button type="button" className="dock-btn" title="Gjør om · det du angret (⇧⌘Z)" aria-label="Gjør om" disabled={!canRedo} onClick={onRedo}>
          <Redo2 size={18} />
        </button>
      </div>
      <div className="dock-stack">
        {change && <PriceChangePill key={change.id} change={change} />}
        {tools && children}
        {tools && (
          <div className="dock-pill dock-tools" role="toolbar" aria-label="Verktøy">
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
                  title={`${t.name} · ${t.more} (${t.key})`}
                  onClick={() => onTool(t.id)}
                >
                  <t.icon size={19} />
                  {stripe && <i className="dock-stripe" style={{ background: stripe }} />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

