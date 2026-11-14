// Hyller: the shelf pen for now; heng (hanging fittings) joins it here later.
import { QBtn, Sep, ShelfIcon } from './parts'
import type { QuickCtx } from './types'

export function FittingPicks({ p, head, more }: QuickCtx) {
  const { brush, onPick } = p
    // Hyller: the shelf pen for now; heng (hanging fittings) joins it here later.
    return (
      <>
        {head}
        <QBtn on={brush?.kind === 'shelf'} title="Hylle 30 cm i et veggfelt · klikk en vegg, dra for flere" label="Hylle" onClick={() => onPick({ kind: 'shelf' })}>
          <ShelfIcon />
          Hylle
        </QBtn>
        <Sep />
        {more}
      </>
    )
}
