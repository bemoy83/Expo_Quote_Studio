// Plukkliste: what goes on the truck, by main group and subgroup of the shared product grouping. Foga parts come
// from the Foga engine (src/foga), counted from the same structure as the quote; everything else from the calc
// lines that are not built from Foga parts. Services and loose quote lines are not picked. Rules: docs/foga-system.md.
import type { CalcResult } from '../../calc/calc'
import { groupItems } from '../../catalog/groups'
import type { Variant } from '../../domain/types'
import { count, fmt } from '../format'
import { PageBand } from '../shell/PageBand'
import { VariantTabs } from '../shell/VariantTabs'
import { pickRows } from './rows'

interface Props {
  variants: Variant[]
  current: number
  onSelect: (i: number) => void
  calcOf: (v: Variant) => CalcResult
}

export function PickingPage({ variants, current, onSelect, calcOf }: Props) {
  const v = variants[current]
  const res = calcOf(v)
  const B = res.bom
  const rows = pickRows(res)
  const tree = groupItems(rows, (r) => r.group)
  const sum = (f: (l: (typeof B.lines)[number]) => boolean) => B.lines.filter(f).reduce((a, l) => a + l.qty, 0)
  const units = sum((l) => l.preassembled)
  const plates = sum((l) => !!l.ral)
  const loosePieces = sum((l) => !l.preassembled && !l.ral)
  const fogaBySub = groupItems(B.lines, (l) => l.group).flatMap((g) => g.subgroups)

  return (
    <>
      <PageBand title="Plukkliste" meta={`Variant ${v.name}`}>
        {variants.length > 1 && <VariantTabs variants={variants} current={current} onSelect={onSelect} />}
      </PageBand>
      <div className="page-scroll">
        <div className="page-cols">
          <div className="page-main">
            <p className="page-intro">
              Deleliste etter gruppe og undergruppe. Ferdigmonterte enheter plukkes som stk; løse profiler står som antall per kappelengde.
              {res.keyFigures.organiserWallLm > 0 && ` Standvegger fra arrangøren (${fmt(res.keyFigures.organiserWallLm)} lm)${res.keyFigures.organiserBeamLm ? ` og takdrager (${fmt(res.keyFigures.organiserBeamLm)} m)` : ''} bestilles for seg og er ikke med.`}
            </p>
            <div className="pick-grid tbl-head">
              <span>Art.nr</span>
              <span>Produkt</span>
              <span className="r">Antall</span>
            </div>

            {!tree.length && <div className="tbl-empty">Ingenting å plukke i variant {v.name}.</div>}
            {tree.map(({ group, subgroups }) => (
              <section key={group.id} className="tbl-sec">
                <div className="tbl-sec-head">
                  <span>{group.name}</span>
                </div>
                {subgroups.map(({ subgroup, items }) => (
                  <div key={subgroup.id}>
                    <div className="tbl-sub-head">{subgroup.name}</div>
                    {items.map((l) => (
                      <div key={l.key} className="pick-grid tbl-row">
                        <span className="num muted">{l.code}</span>
                        <div className="cellstack">
                          <span className="title">{l.title}</span>
                          {(l.detail || l.preassembled) && (
                            <span className="num meta">
                              {l.preassembled && <span className="faint">Ferdigmontert · </span>}
                              {l.detail}
                              {l.lm !== undefined && <span className="faint"> · {fmt(l.lm, 2)} lm</span>}
                            </span>
                          )}
                        </div>
                        <span className="num r">{l.qty}</span>
                      </div>
                    ))}
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
              {fogaBySub.map(({ subgroup, items }) => (
                <div key={subgroup.id}>
                  {subgroup.name}: {items.reduce((a, l) => a + l.qty, 0)} stk
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
