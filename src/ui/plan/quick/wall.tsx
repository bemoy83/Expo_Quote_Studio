// Vegg: the wall colours and their bucket, the openings and the takdrager the pen draws, and a bakrom to add.
import { Blinds, Box, DoorClosed } from 'lucide-react'
import { catalog } from '../../env'
import type { Brush } from '../../tools'
import { ralSwatches } from '../swatches'
import { BeamIcon, Palette, QBtn, Sep } from './parts'
import type { QuickCtx } from './types'

export function WallPicks({ p, head, more, is }: QuickCtx) {
  const { brush, onPick } = p
    const openings = catalog.products.filter((x) => x.opening)
    return (
      <>
        {head}
        <Palette
          swatches={ralSwatches(brush?.kind === 'wall' ? brush.ral : undefined, (n) => `Innervegg ${n}`, (ral) => onPick({ kind: 'wall', ral }))}
          fill="Fyll alle vegger med denne fargen"
          onFill={p.onFillWalls}
        />
        <Sep />
        {openings.map((x) => {
          const b: Brush = { kind: 'opening', product: x.variants[0].artnr }
          return (
            <QBtn key={x.id} on={is(b)} title={`${x.name} · klikk en vegg eller tom kant`} label={x.opening === 'door' ? 'Dør' : 'Forheng'} onClick={() => onPick(b)}>
              {x.opening === 'door' ? <DoorClosed size={15} /> : <Blinds size={15} />}
            </QBtn>
          )
        })}
        <QBtn on={is({ kind: 'beam' })} title="Innvendig takdrager · dra langs rutenettet" label="Takdrager" onClick={() => onPick({ kind: 'beam' })}>
          <BeamIcon />
        </QBtn>
        <Sep />
        <QBtn title="Bakrom 1 × 1 m med dør i et ledig hjørne" label="Legg til bakrom" onClick={p.onAddRoom}>
          <Box size={15} />
        </QBtn>
        {more}
      </>
    )
}
