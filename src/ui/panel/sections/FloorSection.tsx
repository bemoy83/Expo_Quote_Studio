// Panel tab Gulv: floor types with their colours, fill and pen, no floor, and floor protection.
import { Eraser, PaintBucket, Paintbrush, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { mainGroupOf } from '../../../catalog/groups'
import { fillFloor } from '../../../domain/variant'
import { IconButton, Segmented } from '../../controls'
import { catalog, pricing, productOf } from '../../env'
import { fmt, kr } from '../../format'
import { ProductRow, Swatch, VariantChips } from '../ProductRow'
import type { RailProps } from '../Rail'
import { variantTotals } from './variantTotals'

export function FloorSection({ v, res, brush, tool, pick, onEdit }: RailProps) {
  const [sel, setSel] = useState<Record<string, number>>({})
  const areas = res.keyFigures.floor
  const floors = catalog.products.filter((p) => mainGroupOf(p.group) === 'gulv' && p.kind === 'surface')
  const eraser = tool === 'erase' && brush?.kind === 'floor'
  const protection = productOf(catalog.system.floorProtection)
  return (
    <>
      {floors.map((p) => {
        const active = tool === 'brush' && brush?.kind === 'floor' && p.variants.some((x) => x.artnr === brush.product)
        const counts = p.variants.map((x) => areas[x.artnr] ?? 0)
        const { tot, sum, first } = variantTotals(p, counts)
        const vi = active ? p.variants.findIndex((x) => brush?.kind === 'floor' && x.artnr === brush.product) : (sel[p.id] ?? first)
        const cur = p.variants[vi] ?? p.variants[0]
        return (
          <ProductRow
            key={p.id}
            on={tot > 0 || active}
            pen={active}
            thumb={<Swatch color={cur.color} pattern={p.id === 'flis' ? 'tiles' : p.name.startsWith('Vinyl') ? 'planks' : undefined} />}
            title={p.name}
            meta={
              <>
                {p.variants.length > 1 && <>{cur.name} · </>}
                {p.dim && <>{p.dim} · </>}
                <span className="num">
                  {cur.artnr} · {kr(cur.price)} kr/m²
                </span>
              </>
            }
            result={tot ? `${fmt(tot)} m² · ${kr(sum)} kr` : null}
            chips={
              <VariantChips
                chips={p.variants.map((x, i) => ({ name: x.name, color: x.color, count: counts[i] }))}
                selected={tot > 0 || active ? vi : -1}
                onSelect={(i) => {
                  setSel({ ...sel, [p.id]: i })
                  pick({ kind: 'floor', product: p.variants[i].artnr })
                }}
              />
            }
            action={
              <>
                <IconButton icon={PaintBucket} label={`Fyll hele standen med ${cur.name.toLowerCase()}`} onClick={() => onEdit((x) => fillFloor(x, cur.artnr, p.roll, pricing.carpet))} />
                <IconButton icon={Paintbrush} label={`Tegn ${p.name.toLowerCase()} i plan`} pressed={active} onClick={() => pick({ kind: 'floor', product: cur.artnr })} />
              </>
            }
          />
        )
      })}
      <ProductRow
        pen={eraser}
        thumb={<Swatch />}
        title="Uten belegg"
        meta={`Hallgulv · ${fmt(res.keyFigures.area - res.keyFigures.floorTotal)} m² uten belegg`}
        action={
          <>
            <IconButton icon={Trash2} label="Fjern alt gulv" onClick={() => onEdit((x) => ({ ...x, floor: { ...x.floor, tiles: [] } }))} />
            <IconButton
              icon={Eraser}
              label="Visk ut gulv i plan"
              pressed={eraser}
              onClick={() => pick({ kind: 'floor', product: brush?.kind === 'floor' ? brush.product : floors[0].variants[0].artnr }, 'erase')}
            />
          </>
        }
      />
      {res.keyFigures.floorTotal > 0 && protection && (
        <div className="opt">
          <span className="lbl">
            Monteringsplast
            <small>
              <span className="num">{protection.variants[0].artnr}</span> · 0,1 mm · {fmt(res.keyFigures.floorTotal)} m² · ved snekring eller maling
            </small>
          </span>
          <Segmented<boolean>
            inWell
            label="Monteringsplast"
            value={v.floor.protection}
            onChange={(on) => onEdit((x) => ({ ...x, floor: { ...x.floor, protection: on } }))}
            options={[
              { value: false, label: 'Av' },
              { value: true, label: 'På' },
            ]}
          />
        </div>
      )}
      <p className="panel-note">Fyll legger hele standen med 1 × 1. Penselen legger fliser hvor som helst i 0,5-rutenettet: 1 × 1 som standard, Auto tar største flis som passer på ledig gulv, og under Andre ligger 1 × 0,5, 0,5 × 1 og 0,5 × 0,5. Engangsteppe: Fyll legger et område eller hele standen slik det koster minst internt (materiale, teip og arbeid), og Velg på teppet viser andre forslag. Bane legger én hel bane av gangen; R snur retningen. Kunden betaler alltid lagt m². Teppet går under bakrom og vegger. Flere gulvtyper kan stå på samme stand.</p>
    </>
  )
}
