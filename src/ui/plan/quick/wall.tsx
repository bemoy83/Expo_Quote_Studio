// Vegg by function (Bjørn 14.11.2026): Pensel is Vegg, the opening behind the Dør button and Takdrager; Farge is the
// colour of the item in hand and its bucket: wall colours for a wall or door leaf, the fabrics for a curtain, none for
// Takdrager; Tilpasset chooses Dør or Forheng
// with an opening in hand; then a bakrom to add.
import { Blinds, BrickWall, Box, DoorClosed } from 'lucide-react'
import { shortName } from '../../../catalog/lookup'
import { catalog } from '../../env'
import type { Brush } from '../../tools'
import { openingLabel, openingPen, openingProducts, openingShown, penColour, withColour, withOpening, type WallPen } from '../../wallPen'
import { fabricSwatches, ralSwatches } from '../swatches'
import { BeamIcon, Palette, QBtn, Sep } from './parts'
import type { QuickCtx } from './types'

const isWallPen = (b: Brush | null): b is WallPen => b?.kind === 'wall' || b?.kind === 'opening' || b?.kind === 'beam'

export function WallPicks({ p, head, more }: QuickCtx) {
  const { onPick } = p
  const brush: WallPen = isWallPen(p.brush) ? p.brush : { kind: 'wall', ral: p.wallRal }
  const picks = p.picks.wall ?? {}
  const products = catalog.products
  const shown = openingShown(brush, picks, products)
  const doorName = openingLabel(brush, picks, products)
  const colour = penColour(brush, products, p.standRal)
  const opening = brush.kind === 'opening' ? brush : undefined
  const item = brush.kind === 'wall' ? 'Innervegg' : brush.kind === 'beam' ? 'Takdrager' : shortName(shown)
  return (
    <>
      {head}
      <QBtn on={brush.kind === 'wall'} title="Vegg · innervegg på rutenettet · dra langs linjene" label="Vegg" onClick={() => onPick({ kind: 'wall', ral: p.wallRal })}>
        <BrickWall size={15} />
        Vegg
      </QBtn>
      <QBtn
        on={!!opening}
        title={`${shown.name} · klikk en vegg eller tom kant · dør eller forheng velges under Tilpasset`}
        label={doorName}
        onClick={() => onPick(opening ?? openingPen(picks, products))}
      >
        {shown.opening === 'door' ? <DoorClosed size={15} /> : <Blinds size={15} />}
        {doorName}
      </QBtn>
      <QBtn on={brush.kind === 'beam'} title="Takdrager · innvendig, dra langs rutenettet" label="Takdrager" onClick={() => onPick({ kind: 'beam' })}>
        <BeamIcon />
        Takdrager
      </QBtn>
      {/* Farge: on the item in hand, never another pen. Takdrager has none, so none is shown */}
      {colour.kind === 'ral' && (
        <>
          <Sep />
          <Palette
            swatches={ralSwatches(colour.ral, (n) => `${item} ${n}`, (ral) => onPick(withColour(brush, { ral })))}
            fill={brush.kind === 'wall' ? 'Fyll alle vegger med denne fargen' : 'Fyll alle dører med denne fargen'}
            onFill={brush.kind === 'wall' ? p.onFillWalls : () => p.onFillDoors(colour.ral)}
          />
        </>
      )}
      {colour.kind === 'fabric' && (
        <>
          <Sep />
          <Palette
            swatches={fabricSwatches(colour.fabrics, colour.fabric, (n) => `${item} ${n}`, (fabric) => onPick(withColour(brush, { fabric })))}
            fill="Fyll alle forheng med denne fargen"
            onFill={() => p.onFillCurtains(colour.fabric)}
          />
        </>
      )}
      {/* Tilpasset: the variants of the opening in hand */}
      {opening && (
        <>
          <Sep />
          {openingProducts(products).map((x) => {
            const a = x.variants[0].artnr
            return (
              <QBtn key={x.id} on={opening.product === a} setting title={x.name} label={shortName(x)} onClick={() => onPick(withOpening(opening, a))}>
                {shortName(x)}
              </QBtn>
            )
          })}
        </>
      )}
      <Sep />
      <QBtn title="Bakrom 1 × 1 m med dør i et ledig hjørne" label="Legg til bakrom" onClick={p.onAddRoom}>
        <Box size={15} />
      </QBtn>
      {more}
    </>
  )
}
