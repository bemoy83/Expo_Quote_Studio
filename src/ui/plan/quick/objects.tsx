// Møbel by use (Bjørn 14.11.2026): Pensel is one button per furniture set (Møte, Lounge, Mingle) with the set seen from
// above, and «Enkelt» with the piece behind it; Tilpasset with a single piece in hand picks which piece.
import { shortName } from '../../../catalog/lookup'
import { catalog } from '../../env'
import { setContents, setInHand, singlePen, singles, penSets } from '../../furniturePen'
import { ObjectThumb } from '../../panel/ProductRow'
import type { Brush } from '../../tools'
import { MAX } from './limits'
import { QBtn, Sep } from './parts'
import type { QuickCtx } from './types'

export function ObjectPicks({ p, head, more, is }: QuickCtx) {
  const { onPick, brush } = p
  const products = catalog.products
  const picks = p.picks.object ?? {}
  const set = setInHand(brush, products)
  const single = brush?.kind === 'object' && !set ? brush : singlePen(picks, products)
  const singleProduct = products.find((x) => x.variants.some((v) => v.artnr === single.product))
  return (
    <>
      {head}
      {penSets(products).map((x) => {
        const b: Brush = { kind: 'object', product: x.variants[0].artnr }
        return (
          <QBtn key={x.id} on={is(b)} title={`${x.name} · ${setContents(x, products)} · flyttes samlet`} label={shortName(x)} onClick={() => onPick(b)}>
            <ObjectThumb product={x} />
            {shortName(x)}
          </QBtn>
        )
      })}
      <QBtn on={!set && brush?.kind === 'object'} title={`Enkelt · ${singleProduct?.name ?? 'ett møbel'} · velg hvilket under Tilpasset`} label="Enkelt" onClick={() => onPick(single)}>
        {singleProduct && <ObjectThumb product={singleProduct} color={singleProduct.variants.find((v) => v.artnr === single.product)?.color} />}
        Enkelt
      </QBtn>
      {/* Tilpasset: which piece «Enkelt» places */}
      {!set && (
        <>
          <Sep />
          {singles(products)
            .flatMap((x) => x.variants.map((vr) => ({ x, vr })))
            .slice(0, MAX)
            .map(({ x, vr }) => {
              const b: Brush = { kind: 'object', product: vr.artnr }
              return (
                <button key={vr.artnr} type="button" className="q-obj q-set" aria-pressed={is(b)} title={x.variants.length > 1 ? `${x.name} ${vr.name.toLowerCase()}` : x.name} onClick={() => onPick(b)}>
                  <ObjectThumb product={x} color={vr.color} />
                </button>
              )
            })}
        </>
      )}
      <Sep />
      {more}
    </>
  )
}
