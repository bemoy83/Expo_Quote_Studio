// Disker og podier by function (Bjørn 14.11.2026): «Fri», then one button per function with the outline of the item
// behind it; the plates in the wall colours and the bucket, as on Vegg (K6); Høyde (K12) and Fin.
import { Ruler } from 'lucide-react'
import { stockByArtnr } from '../../../domain/podiumStock'
import { artnrName, catalog, idx } from '../../env'
import { fineApplies, funcOf, penFuncs, penHeights, stockFor, withFunc, withHeight } from '../../podiumPen'
import type { Brush } from '../../tools'
import { ralSwatches } from '../swatches'
import { StockOutline } from './StockOutline'
import { Palette, QBtn, Sep } from './parts'
import type { QuickCtx } from './types'

export function PodiumPicks({ p, head, more, brush }: Omit<QuickCtx, 'is'> & { brush: Extract<Brush, { kind: 'podium' }> }) {
  const { onPick } = p
  const { ral, fine } = brush
  const func = funcOf(brush)
  const picks = p.picks.podium ?? {}
  const fineOn = fineApplies(brush)
  return (
    <>
      {head}
      <QBtn on={!func} setting title="Fri · tegn fasongen selv · et klikk setter en seksjon 500 × 500, dra tegner fritt" label="Fri" onClick={() => onPick(withFunc(brush, undefined, picks, catalog.products))}>
        Fri
      </QBtn>
      {penFuncs(catalog.products).map((f) => {
        // The item behind the function: the one in hand, else the one it would put in hand
        const s = (func === f.func && brush.stock ? stockByArtnr(brush.stock) : undefined) ?? stockFor(f.func, picks, brush.h)
        const name = s ? idx.byArtnr.get(s.artnr)?.product.name : undefined
        return (
          <QBtn
            key={f.func}
            on={func === f.func}
            setting
            title={`${f.one} · ${f.does.toLowerCase()} · et klikk setter ${name ?? f.one.toLowerCase()}, dra tegner fritt`}
            label={f.one}
            onClick={() => onPick(withFunc(brush, f.func, picks, catalog.products))}
          >
            {s && <StockOutline sections={s.sections} />}
            {f.one}
          </QBtn>
        )
      })}
      <Sep />
      <Palette
        swatches={ralSwatches(ral, (n) => `${artnrName(brush.product)} ${n}`, (r) => onPick({ ...brush, ral: r }))}
        fill="Fyll alle disker og podier med denne fargen"
        onFill={p.onFillPodiums}
      />
      <Sep />
      {/* Høyde, CC: what Fri draws (a påbygg takes its neighbour's, K12), or the item's height in hand */}
      {penHeights(brush).map(({ h, on, off }) => (
        <QBtn
          key={h}
          on={on}
          setting
          disabled={off}
          title={off ? `Høyde CC ${h} mm · finnes ikke for varen i hånden` : `Høyde CC ${h} mm (utvendig ${h + 40})`}
          label={`Høyde ${h}`}
          onClick={() => onPick(withHeight(brush, h))}
        >
          {h}
        </QBtn>
      ))}
      <Sep />
      {/* «Fin»: as Shift held, for touch; Fri only, a function places its item whole */}
      <QBtn
        on={fine && fineOn}
        setting
        disabled={!fineOn}
        title={!fineOn ? 'Fin · gjelder bare Fri' : fine ? 'Fin · 250-steg, dra fra en kant flytter den · trykk for 500-steg igjen' : 'Fin · 250-steg, og dra fra en kant for å flytte den · på desktop også Shift'}
        label="Fin"
        onClick={() => onPick({ ...brush, fine: !fine })}
      >
        <Ruler size={15} />
        Fin
      </QBtn>
      <Sep />
      {more}
    </>
  )
}
