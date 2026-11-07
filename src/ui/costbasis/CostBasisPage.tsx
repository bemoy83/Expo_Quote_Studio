// Kostgrunnlag: every number the cost engine runs on, by tab, with where it came from (status, kilde, dato) and whether
// it is the owner's or the app's example. A path from «Slik er det regnet» opens the page on the rows it names.
// Rules (byggeregler) and the formulas are shown beside them so the whole calculation can be read in one place.
// docs/kostmodell.md.
import { useEffect, useRef, useState } from 'react'
import { basisFields, fieldsAt, FIELD_TABS, type Field, type FieldTab } from '../../cost/fields'
import { ownedPerUse } from '../../cost/model'
import type { PartKind } from '../../foga/parts'
import { CostBasisCard } from '../catalog/CostBasisCard'
import { Segmented } from '../controls'
import { costBasis, pricing, rules } from '../env'
import { fmt } from '../format'
import { PageBand } from '../shell/PageBand'
import type { ToastMsg } from '../useToast'
import { FORMULAS, RULE_ROWS } from './rows'

type Tab = FieldTab | 'regler' | 'formler'

const TABS: { value: Tab; label: string }[] = [...FIELD_TABS.map((t) => ({ value: t.id as Tab, label: t.name })), { value: 'regler', label: 'Regler' }, { value: 'formler', label: 'Formler' }]

const INTRO: Record<Tab, string> = {
  innkjop: 'Innpriser fra prislistene motoren slår opp i, med valuta, frakt og materialindeksen som flytter dem til kostgrunnlagets år (regel 1).',
  avskrivning: 'Hva eid utstyr koster per bruk: levetid og bruk i året per artikkelgruppe, rente på bundet kapital og tap per jobb (regel 1).',
  arbeid: 'Montørens timekost, som er lik for gulv, Foga, tekstil og møbler, og personminutter per prisartikkel og steg (regel 4).',
  ordrekost: 'Kost som kommer én gang per tilbud. Den ligger i kosten, aldri i linjeprisene (regel 5).',
  paslag: 'Indirekte kost og DG-mål per gruppe. Gjelder bare det motoren priser; katalogvarer med fast pris (OMS) brukes som de er.',
  katalog: 'Katalogvarer uten oppskrift: kost som andel av salgsprisen og minutter per enhet, per gruppe, til OMS gir dem per produkt.',
  oppskrifter: 'Hvor mye av hver del en prisartikkel bruker, i leverandørens enhet. En del uten pris gir artikkelen ingen kost.',
  regler: 'Byggereglene kostgrunnlaget bygger på (docs/byggeregler.md). De styrer mengdene, ikke prisene. Tekstilrammen endres på Produksjon.',
  formler: 'Slik blir tallene til kost og pris. Regel 2 og 6 er med i kostgrunnlaget, men kalkylen bruker dem ikke ennå.',
}

const KIND_SHORT: Record<PartKind, string> = { profile: 'Profiler', frame: 'Tekstilrammer', plate: 'Plater', coupling: 'Koblinger', foot: 'Føtter og fotplater', accessory: 'Tilbehør' }

/** A number with its unit: shares as %, years without thousands space. */
function valueText(f: Pick<Field, 'value' | 'unit'>): string {
  if (f.unit === '%') return `${fmt(f.value * 100, 2)} %`
  if (f.unit === 'år' && f.value > 1900) return String(f.value)
  return `${fmt(f.value, 3)} ${f.unit}`
}

/** `focus` is a path from «Slik er det regnet»: the page opens on its tab with its rows lit. App gives each new path a
 *  new key, so the page starts again on it. */
export function CostBasisPage({ focus, onToast }: { focus: string | null; onToast: (t: ToastMsg | string) => void }) {
  const fields = basisFields(costBasis)
  const [start] = useState(() => (focus ? fieldsAt(fields, focus) : []))
  const [tab, setTab] = useState<Tab>(start[0]?.tab ?? 'innkjop')
  const [onlyExample, setOnlyExample] = useState(false)
  const [lit, setLit] = useState<Set<string>>(() => new Set(start.map((f) => f.path)))
  const scroll = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroll.current?.querySelector('.kg-row.lit')?.scrollIntoView({ block: 'center' })
  }, [])

  const examples = fields.filter((f) => !f.own).length
  const unused = fields.filter((f) => f.unused).length
  const shown = fields.filter((f) => f.tab === tab && (!onlyExample || !f.own))
  const groups = [...new Set(shown.map((f) => f.group))]
  const count = (t: Tab) => fields.filter((f) => f.tab === t && !f.own).length

  return (
    <>
      <PageBand title="Kostgrunnlag" meta={`${fields.length} tall · ${examples ? `${examples} eksempeltall` : 'ingen eksempeltall'}${unused ? ` · ${unused} ikke i bruk` : ''}`} />
      <div className="page-scroll" ref={scroll}>
        <div className="page-narrow">
          <CostBasisCard onToast={onToast} />
          <div className="kg-tabs">
            <Segmented
              label="Del av kostgrunnlaget"
              options={TABS.map((t) => ({ value: t.value, label: t.label, title: count(t.value) ? `${count(t.value)} eksempeltall` : undefined }))}
              value={tab}
              onChange={(t) => {
                setTab(t)
                setLit(new Set())
              }}
            />
          </div>
          <div className="cat-tools">
            <p className="page-intro">{INTRO[tab]}</p>
            {tab !== 'regler' && tab !== 'formler' && (
              <button type="button" className="chip-toggle" aria-pressed={onlyExample} onClick={() => setOnlyExample(!onlyExample)}>
                <i className="ph-dot" />
                Bare eksempeltall <span className="num">{count(tab)}</span>
              </button>
            )}
          </div>
          {tab === 'regler' ? (
            <Rules />
          ) : tab === 'formler' ? (
            <Formulas fields={fields} onRule={(r) => setTab(r)} />
          ) : (
            <>
              {tab === 'avskrivning' && <PerUse />}
              <div className="kg-grid tbl-head">
                <span>Tall</span>
                <span className="r">Verdi</span>
                <span>Status</span>
                <span>Kilde</span>
              </div>
              {groups.map((g) => (
                <section key={g} className="tbl-sec">
                  <div className="tbl-sec-head">{g}</div>
                  {shown
                    .filter((f) => f.group === g)
                    .map((f) => (
                      <FieldRow key={f.path} f={f} lit={lit.has(f.path)} />
                    ))}
                </section>
              ))}
              {!shown.length && <div className="tbl-empty">{onlyExample ? 'Ingen eksempeltall her: alle tallene er dine egne.' : 'Ingen tall her.'}</div>}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function StatusChip({ f }: { f: Pick<Field, 'own' | 'status'> }) {
  return (
    <span className={`kg-status s-${f.status}`}>
      {!f.own && <i className="ph-dot" />}
      {f.status}
    </span>
  )
}

function FieldRow({ f, lit }: { f: Field; lit: boolean }) {
  return (
    <div className={`kg-grid kg-row tbl-row${lit ? ' lit' : ''}`} title={f.path}>
      <span className="n">
        {f.label}
        {f.unused && <span className="kg-unused">ikke i bruk</span>}
      </span>
      <span className="r num">{valueText(f)}</span>
      <StatusChip f={f} />
      <span className="kg-src">
        {f.source} · {f.date}
      </span>
    </div>
  )
}

/** What 100 kr of purchase costs per use in each group: lifetime, uses, interest and loss together. */
function PerUse() {
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

function Rules() {
  const rows = RULE_ROWS(rules)
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

function Formulas({ fields, onRule }: { fields: readonly Field[]; onRule: (t: FieldTab) => void }) {
  return (
    <div className="kg-formulas">
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
