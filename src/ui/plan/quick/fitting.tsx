// Hyller by product (Bjørn 14.11.2026): Pensel is Hylle, named from the product list; heng (hanging fittings) joins it
// here later as another pen, on the same pill.
import { shortName } from '../../../catalog/lookup'
import { catalog, productOf } from '../../env'
import { QBtn, Sep, ShelfIcon } from './parts'
import type { QuickCtx } from './types'

export function FittingPicks({ p, head, more }: QuickCtx) {
  const { brush, onPick } = p
  const shelf = productOf(catalog.system.shelf)
  const name = shelf ? shortName(shelf) : 'Hylle'
  return (
    <>
      {head}
      <QBtn on={brush?.kind === 'shelf'} title={`${shelf?.name ?? name} i et veggfelt · klikk en vegg, dra for flere`} label={name} onClick={() => onPick({ kind: 'shelf' })}>
        <ShelfIcon />
        {name}
      </QBtn>
      <Sep />
      {more}
    </>
  )
}
