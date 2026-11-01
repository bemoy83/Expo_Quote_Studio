// Floating tools on the drawing surface: Velg · Pensel · Tøm as a pill at the bottom, undo and redo on their own pill
// to the left, and the brush's own options (floor size, roll direction, grid) as a quick pill above the tools.
// Same tools and state as before; only where they sit has changed.
import type { ReactNode } from 'react'
import { Eraser, MousePointer2, Paintbrush, Redo2, Undo2 } from 'lucide-react'
import type { Tool } from '../tools'

export function ToolDock({
  tools,
  tool,
  onTool,
  brush,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  children,
}: {
  /** False in 3D: the brushes draw in the plan only, so 3D gets undo and redo alone. */
  tools: boolean
  tool: Tool
  onTool: (t: Tool) => void
  /** What the brush draws: the product chosen in the panel. */
  brush: { name: string; color?: string }
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  /** The brush's options, shown above the tools. */
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
      {tools && (
        <div className="dock-stack">
          {children && <div className="dock-pill dock-quick">{children}</div>}
          <div className="dock-pill dock-tools" role="toolbar" aria-label="Verktøy">
            <button type="button" className="dock-btn" aria-pressed={tool === 'select'} title="Velg (V)" aria-label="Velg" onClick={() => onTool('select')}>
              <MousePointer2 size={19} />
            </button>
            <button
              type="button"
              className="dock-btn dock-brush"
              aria-pressed={tool === 'brush'}
              title={`Pensel: ${brush.name} (P) · velg hva penselen tegner i panelet`}
              aria-label={`Pensel: ${brush.name}`}
              onClick={() => onTool('brush')}
            >
              {brush.color ? <i className="dock-dot" style={{ background: brush.color }} /> : <Paintbrush size={19} />}
              <span className="dock-brush-name">{brush.name}</span>
            </button>
            <button type="button" className="dock-btn" aria-pressed={tool === 'erase'} title="Tøm (E)" aria-label="Tøm" onClick={() => onTool('erase')}>
              <Eraser size={19} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
