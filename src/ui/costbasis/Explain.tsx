// The tabs that explain rather than hold numbers: cost per use in Avskrivning, the build rules the quantities come
// from (Regler) and the formulas (Formler). Read only. docs/kostmodell.md, docs/byggeregler.md.
import { FIELD_TABS, type Field, type FieldTab } from '../../cost/fields'
import { ownedPerUse } from '../../cost/model'
import type { PartKind } from '../../foga/parts'
import { costBasis, pricing, rules } from '../env'
import { fmt } from '../format'
import { FORMULAS, ruleRows } from './rows'

const KIND_SHORT: Record<PartKind, string> = { profile: 'Profiler', frame: 'Tekstilrammer', plate: 'Plater', coupling: 'Koblinger', foot: 'Føtter og fotplater', accessory: 'Tilbehør' }

/** What 100 kr of purchase costs per use in each group: lifetime, uses, interest and loss together. */
export function PerUse() {
  const p = costBasis.params
  return (
    <section className="kg-peruse" aria-label="Kost per bruk">
      <div className="tbl-sec-head">Kost per bruk av 100 kr innkjøp</div>
      <div className="kg-peruse-grid">
        {(Object.keys(p.owned.groups) as PartKind[]).map((k) => (
          <div key={k} className="kg-peruse-cell">
            <span className="muted">{KIND_SHORT[k]}</span>
            <span className="num">{fmt(ownedPerUse(100, k, p), 2)} kr</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Rules() {
  const rows = ruleRows(rules)
  return (
    <>
      <div className="kg-grid tbl-head">
        <span>Regel</span>
        <span className="r">Verdi</span>
        <span>Byggeregel</span>
        <span>Brukes til</span>
      </div>
      {[...new Set(rows.map((r) => r.group))].map((g) => (
        <section key={g} className="tbl-sec">
          <div className="tbl-sec-head">{g}</div>
          {rows
            .filter((r) => r.group === g)
            .map((r) => (
              <div key={r.label} className="kg-grid kg-row tbl-row">
                <span className="n">{r.label}</span>
                <span className="r num">{r.value}</span>
                <span className="kg-status">{r.id}</span>
                <span className="kg-src">{r.use}</span>
              </div>
            ))}
        </section>
      ))}
      <p className="page-intro kg-foot">Regler godkjent {rules.approved}. Kostgrunnlagets kode {pricing.code} er regnet over tallene, ikke over reglene.</p>
    </>
  )
}

export function Formulas({ fields, onRule }: { fields: readonly Field[]; onRule: (t: FieldTab) => void }) {
  return (
    <div>
      {FORMULAS.map((x) => {
        const n = x.rule === undefined ? 0 : fields.filter((f) => f.rule === x.rule).length
        return (
          <section key={x.title} className="kg-formula">
            <div className="tbl-sec-head">
              {x.rule !== undefined && <span className="num">{x.rule}</span>}
              {x.title}
              {x.unused && <span className="kg-unused">ikke i bruk</span>}
            </div>
            <code>{x.formula}</code>
            <p className="page-intro">
              {x.text}
              {n > 0 && x.tab && (
                <>
                  {' '}
                  <button type="button" className="kg-link" onClick={() => onRule(x.tab!)}>
                    {n} tall i {FIELD_TABS.find((t) => t.id === x.tab)?.name}
                  </button>
                </>
              )}
            </p>
          </section>
        )
      })}
    </div>
  )
}
