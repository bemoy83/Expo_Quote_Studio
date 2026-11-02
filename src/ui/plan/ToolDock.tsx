// Floating tools on the drawing surface, one icon per tool: Velg · Vegg · Gulv · Profilering · Møbel · Tøm at the
// bottom, undo and redo on their own pill to the left. Over the active tool: its quick picks. A short stripe under
// Vegg and Gulv shows the colour they draw with. Over the quick picks: what an edit made outside the plan changed in the exhibitor's sum.
import type { LucideIcon } from 'lucide-react'
import { Armchair, BrickWall, Eraser, Grid2x2, Image, MousePointer2, Redo2, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { signed } from '../format'
import type { DockTool } from '../tools'
import type { PriceChange } from './usePriceChange'

interface ToolDef {
  id: DockTool
  name: string
  key: string
  icon: LucideIcon
}

const DOCK_TOOLS: ToolDef[] = [
  { id: 'select', name: 'Velg', key: 'V', icon: MousePointer2 },
  { id: 'wall', name: 'Vegg', key: 'S', icon: BrickWall },
  { id: 'floor', name: 'Gulv', key: 'G', icon: Grid2x2 },
  { id: 'profile', name: 'Profilering', key: 'T', icon: Image },
  { id: 'object', name: 'Møbel', key: 'M', icon: Armchair },
  { id: 'erase', name: 'Tøm', key: 'E', icon: Eraser },
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
        <button type="button" className="dock-btn" title="Angre (⌘Z)" aria-label="Angre" disabled={!canUndo} onClick={onUndo}>
          <Undo2 size={18} />
        </button>
        <button type="button" className="dock-btn" title="Gjør om (⇧⌘Z)" aria-label="Gjør om" disabled={!canRedo} onClick={onRedo}>
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
                  title={`${t.name} (${t.key})`}
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

/** What the last stroke changed in the exhibitor's sum, inverted like a toast. It fades in moving a little up, rests
 *  while you draw, then fades out moving on up. By the pointer when the change came from drawing in the plan (`at`, px inside
 *  the drawing surface), else in the dock over the quick picks. */
export function PriceChangePill({ change: { amount, at, leaving } }: { change: PriceChange }) {
  return (
    <div
      className={['price-pill', at && 'at', leaving && 'leaving'].filter(Boolean).join(' ')}
      style={at ? { left: at.x, top: at.y } : undefined}
      role="status"
      title="Endring i utstillers sum, eks. mva."
    >
      <span>{signed(amount)} kr</span>
    </div>
  )
}
