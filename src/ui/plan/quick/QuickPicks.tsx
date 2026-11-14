// Quick picks over the active tool in the dock: everything the tool draws, in fixed places so the hand learns where the
// colours are, one file per tool built of the same parts (parts.tsx). The tool's own settings (floor type, tile size,
// drawing grid) sit here too, and the last button («…») opens the panel on the tool's tab for the rest.
import type { ReactNode } from 'react'
import type { Brush } from '../../tools'
import { FittingPicks } from './fitting'
import { FloorPicks } from './floor'
import { ObjectPicks } from './objects'
import { More, QName } from './parts'
import { PodiumPicks } from './podium'
import { ProfilePicks } from './profile'
import type { QuickCtx, QuickPicksProps } from './types'
import { WallPicks } from './wall'

export type { QuickPicksProps } from './types'

/** The quick pill over the active tool, or nothing when the tool has none (Velg and Tøm). */
export function QuickPicks(p: QuickPicksProps) {
  const content = quickContent(p)
  return content ? (
    <div key={p.tool} className="dock-pill dock-quick">
      {content}
    </div>
  ) : null
}

function quickContent(p: QuickPicksProps): ReactNode {
  const { tool, brush } = p
  if (tool === 'select' || tool === 'erase') return null
  const c: QuickCtx = {
    p,
    head: <QName name={p.name} meta={p.meta} />,
    more: <More onClick={p.onMore} />,
    is: (b: Brush) => JSON.stringify(b) === JSON.stringify(brush),
  }
  if (tool === 'wall') return <WallPicks {...c} />
  if (tool === 'floor') return <FloorPicks {...c} />
  if (tool === 'profile') return <ProfilePicks {...c} />
  if (tool === 'fitting') return <FittingPicks {...c} />
  if (tool === 'podium') return brush?.kind === 'podium' ? <PodiumPicks {...c} brush={brush} /> : null
  return <ObjectPicks {...c} />
}
