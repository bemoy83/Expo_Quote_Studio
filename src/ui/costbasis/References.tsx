// Referanser: the reference stands and textile walls (calc/referenceSet.ts) with the kostgrunnlag in use, and with the
// changes not saved yet, so a new number is seen in what it does before it is saved. docs/kostmodell.md.
import { REFERENCE_CASES, referenceFigures, type ReferenceFigures } from '../../calc/referenceSet'
import { withValues } from '../../cost/fields'
import { pricingFrom, type PricingData } from '../../pricing/data'
import { catalog, costBasis, pricing, rules } from '../env'
import { fmt, kr } from '../format'
import { today, type Change } from './text'

const pctText = (x: number) => `${fmt(x * 100, 1)} %`
const hoursText = (x: number) => fmt(x, 2)
/** Each figure, and its change: kroner, DG in percentage points, hours. */
const FIGURES: { key: keyof Omit<ReferenceFigures, 'unknown'>; name: string; text: (x: number) => string; diff: (d: number) => string }[] = [
  { key: 'price', name: 'Pris', text: kr, diff: kr },
  { key: 'cost', name: 'Kost', text: kr, diff: kr },
  { key: 'dg', name: 'DG', text: pctText, diff: (d) => `${fmt(d * 100, 1)} pp` },
  { key: 'hours', name: 'Timer', text: hoursText, diff: hoursText },
]
const delta = (f: (typeof FIGURES)[number], from: number, to: number) => `${to >= from ? '+' : '−'}${f.diff(Math.abs(to - from))}`

/** The reference cases with the basis in use, and with the changes not saved yet when there are any. */
export function References({ changes }: { changes: readonly Change[] }) {
  let after: PricingData | null = null
  let error = ''
  if (changes.length) {
    const r = withValues(costBasis, changes, { version: 'endring', date: today() })
    if (r.ok) after = pricingFrom(r.basis)
    else error = r.error
  }
  return (
    <>
      {error && <div className="tbl-empty ph">Endringene gir ikke et gyldig kostgrunnlag: {error}</div>}
      <div className="kg-ref tbl-head">
        <span>{after ? `Med ${changes.length} ${changes.length === 1 ? 'endring' : 'endringer'}, mot nå` : 'Referanse'}</span>
        {FIGURES.map((f) => (
          <span key={f.key} className="r">
            {f.name}
          </span>
        ))}
      </div>
      {REFERENCE_CASES.map((c) => {
        const now = referenceFigures(c, rules, catalog, pricing)
        const then = after && referenceFigures(c, rules, catalog, after)
        return (
          <div key={c.id} className="kg-ref kg-row tbl-row">
            <span className="n">
              {c.name}
              {c.target && <span className="kg-src"> · mål {c.target}</span>}
              {now.unknown > 0 && <span className="ph"> · {now.unknown} uten kost</span>}
            </span>
            {FIGURES.map((f) => (
              <span key={f.key} className="r num kg-fig">
                {then ? (
                  <>
                    <span>{f.text(then[f.key])}</span>
                    {Math.abs(then[f.key] - now[f.key]) < 1e-9 ? <span className="kg-delta same">uendret</span> : <span className="kg-delta">{delta(f, now[f.key], then[f.key])}</span>}
                  </>
                ) : (
                  f.text(now[f.key])
                )}
              </span>
            ))}
          </div>
        )
      })}
      <p className="page-intro kg-foot">
        Utstilleren betaler vegger og takdrager. Pris er summen eks. mva. (standardleveranser med fast pris fra katalogen, tekstil priset av motoren), kost er direkte kost med ordrekost, timer er
        personminutter over alle steg.
      </p>
    </>
  )
}
