// The drawer for what is selected in Velg: a free-standing textile wall, engangsteppe (plan only), or a wall with its
// doors, frames and decals. They open under the plan or the 3D view.
import type { CalcResult } from '../../calc/calc'
import type { Motif, Variant } from '../../domain/types'
import { CarpetDrawer } from './CarpetDrawer'
import { FreeTextileDrawer } from './FreeTextileDrawer'
import type { PlanSelection } from './selection'
import { WallDrawer } from './WallDrawer'

interface Props {
  v: Variant
  res: CalcResult
  view: 'plan' | '3d'
  selection: PlanSelection
  onSelect: (s: PlanSelection) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onCheckpoint: () => void
  onToast: (text: string) => void
  motifs: Motif[]
  /** Add the customer's own motif to the library. */
  onUpload: (f: File) => void
}

export function Drawers({ v, res, view, selection, onSelect, onEdit, onCheckpoint, onToast, motifs, onUpload }: Props) {
  const onClose = () => onSelect({})
  const freeFrame = selection.freeTextileId ? res.production.free.find((f) => f.textileId === selection.freeTextileId) : undefined
  return (
    <>
      {freeFrame && (
        <FreeTextileDrawer v={v} frame={freeFrame} selection={selection} motifs={motifs} onUpload={onUpload} onSelect={onSelect} onEdit={onEdit} onToast={onToast} onClose={onClose} />
      )}
      {(selection.lane || selection.fill) && view === 'plan' && (
        <CarpetDrawer v={v} selection={selection} onSelect={onSelect} onEdit={(fn) => onEdit(fn)} onClose={onClose} />
      )}
      {(selection.wallId || selection.openingId) && (
        <WallDrawer
          v={v}
          selection={selection}
          motifs={motifs}
          onUpload={onUpload}
          onSelect={onSelect}
          onEdit={onEdit}
          onCheckpoint={onCheckpoint}
          onToast={onToast}
          onClose={onClose}
        />
      )}
    </>
  )
}
