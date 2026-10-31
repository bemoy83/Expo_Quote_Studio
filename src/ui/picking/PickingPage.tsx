// Plukkliste: what goes on the truck, by product. Foga parts come from the Foga engine (src/foga); loose goods
// (floor, furniture, counted items, doors and curtains) from the calc. Rules behind it: docs/foga-system.md.
import { useMemo } from 'react'
import type { CalcResult } from '../../calc/calc'
import type { Variant } from '../../domain/types'
import { bom } from '../../foga/engine'
import { bomSizes, fromVariant } from '../../foga/fromVariant'
import { RECIPES } from '../../foga/recipes'
import { catalog, plateName, rules } from '../env'
import { count, fmt } from '../format'
import { PageBand } from '../shell/PageBand'
import { VariantTabs } from '../shell/VariantTabs'

interface Props {
  variants: Variant[]
  current: number
  onSelect: (i: number) => void
  calcOf: (v: Variant) => CalcResult
}

/** Calc groups that are loose goods, not built from Foga. */
const isLoose = (id: string) => id === 'floor' || id === 'openings' || id.startsWith('cat:')

export function PickingPage({ variants, current, onSelect, calcOf }: Props) {
  const v = variants[current]
  const B = useMemo(() => bom(fromVariant(v, rules), RECIPES, bomSizes(rules)), [v])
  // The header (overstykke) is built from Foga parts above, so it is not picked as a product
  const loose = calcOf(v)
    .groups.filter((g) => isLoose(g.id))
    .map((g) => ({ ...g, lines: g.lines.filter((l) => l.artnr !== catalog.system.header) }))
    .filter((g) => g.lines.length)
  const all = B.groups.flatMap((g) => g.lines)
  const sum = (f: (l: (typeof all)[number]) => boolean) => all.filter(f).reduce((a, l) => a + l.qty, 0)
  const units = sum((l) => l.preassembled)
  const plates = sum((l) => !!l.ral)
  const loosePieces = sum((l) => !l.preassembled && !l.ral)

  return (
    <>
      <PageBand title="Plukkliste" meta={`Variant ${v.name}`}>
        {variants.length > 1 && <VariantTabs variants={variants} current={current} onSelect={onSelect} />}
      </PageBand>
      <div className="page-scroll">
        <div className="page-cols">
          <div className="page-main">
            <p className="page-intro">Deleliste etter produkttype. Ferdigmonterte enheter plukkes som stk; løse profiler står som antall per kappelengde. Løsøre til slutt.</p>
            <div className="pick-grid tbl-head">
              <span>Art.nr</span>
              <span>Produkt</span>
              <span className="r">Antall</span>
            </div>

            {!B.groups.length && <div className="tbl-empty">Ingen Foga-deler i variant {v.name}.</div>}
            {B.groups.map((g) => (
              <section key={g.id} className="tbl-sec">
                <div className="tbl-sec-head">
                  <span>{g.name}</span>
                  <span className="num">{g.lines.length}</span>
                </div>
                {g.lines.map((l) => (
                  <div key={l.name + l.detail} className="pick-grid tbl-row">
                    <span className="num muted">{l.ral ? `RAL ${l.ral}` : l.artnr}</span>
                    <div className="cellstack">
                      <span className="title">
                        {l.name}
                        {l.ral ? ` · ${plateName(l.ral)}` : ''}
                      </span>
                      {(l.detail || l.preassembled) && (
                        <span className="num meta">
                          {l.preassembled && <span className="faint">Ferdigmontert · </span>}
                          {l.detail}
                          {l.lm !== undefined && <span className="faint"> · {fmt(l.lm, 2)} lm</span>}
                        </span>
                      )}
                    </div>
                    <span className="num r">{l.qty} stk</span>
                  </div>
                ))}
              </section>
            ))}

            {loose.map((g) => (
              <section key={g.id} className="tbl-sec">
                <div className="tbl-sec-head">
                  <span>{g.name}</span>
                  <span className="num">{g.lines.length}</span>
                </div>
                {g.lines.map((l) => (
                  <div key={l.artnr + l.name} className="pick-grid tbl-row">
                    <span className="num muted">{l.artnr}</span>
                    <div className="cellstack">
                      <span className="title">{l.name}</span>
                    </div>
                    <span className="num r">
                      {fmt(l.qty, l.unit === 'stk' ? 0 : 1)} {l.unit}
                    </span>
                  </div>
                ))}
              </section>
            ))}
          </div>
          <aside className="page-side">
            <div className="side-head">
              <span>Sum Foga</span>
            </div>
            <div className="formulas num">
              {B.groups.map((g) => (
                <div key={g.id}>
                  {g.name}: {g.lines.reduce((a, l) => a + l.qty, 0)} stk
                </div>
              ))}
            </div>
            <div className="formulas num">
              <div>{count(units, 'ferdigmontert enhet', 'ferdigmonterte enheter')}</div>
              <div>{count(loosePieces, 'løs del', 'løse deler')}</div>
              <div>{count(plates, 'plate', 'plater')}</div>
            </div>
            <p className="side-note">Byggesystemet og reglene bak listen står i docs/foga-system.md.</p>
          </aside>
        </div>
      </div>
    </>
  )
}
