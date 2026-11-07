// Kostgrunnlag: every number the cost engine runs on, by tab, with where it came from (status, kilde, dato) and whether
// it is the owner's or the app's example. A path from «Slik er det regnet» opens the page on the rows it names.
// Rules (byggeregler) and the formulas are shown beside them so the whole calculation can be read in one place.
// docs/kostmodell.md.
import { ClipboardPaste, Download, History as HistoryIcon, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { basisLabel, serializeBasis } from '../../cost/basis'
import { basisFields, fieldsAt, FIELD_TABS, withValues, type Field, type FieldTab } from '../../cost/fields'
import { ownedPerUse } from '../../cost/model'
import type { PartKind } from '../../foga/parts'
import { CostBasisCard } from '../catalog/CostBasisCard'
import { entryFor, nextVersion, type HistoryEntry } from '../../cost/history'
import { Button, Segmented } from '../controls'
import { download } from '../download'
import { costBasis, costHistory, pricing, revertBasis, rules, saveBasisVersion } from '../env'
import { fmt } from '../format'
import { PageBand } from '../shell/PageBand'
import type { ToastMsg } from '../useToast'
import { FieldSheet, PasteSheet, PendingBar, type Pending } from './Edit'
import { today } from './link'
import { FORMULAS, RULE_ROWS } from './rows'

type Tab = FieldTab | 'regler' | 'formler' | 'historikk'

const TABS: { value: Tab; label: string }[] = [...FIELD_TABS.map((t) => ({ value: t.id as Tab, label: t.name })), { value: 'regler', label: 'Regler' }, { value: 'formler', label: 'Formler' }, { value: 'historikk', label: 'Historikk' }]

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
  historikk: 'Versjonene som er lagret her, med gammel og ny verdi for hvert tall. Historikken ligger bare i denne nettleseren, som kostgrunnlaget.',
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
  const [pending, setPending] = useState<Map<string, Pending>>(new Map())
  const [sheet, setSheet] = useState<{ kind: 'field'; path: string } | { kind: 'paste' } | null>(null)
  const scroll = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroll.current?.querySelector('.kg-row.lit')?.scrollIntoView({ block: 'center' })
  }, [])

  const examples = fields.filter((f) => !f.own).length
  const unused = fields.filter((f) => f.unused).length
  const shown = fields.filter((f) => f.tab === tab && (!onlyExample || !f.own))
  const groups = [...new Set(shown.map((f) => f.group))]
  const count = (t: Tab) => fields.filter((f) => f.tab === t && !f.own).length
  const editing = sheet?.kind === 'field' ? fields.find((f) => f.path === sheet.path) : undefined
  const suppliers = [...new Set(fields.flatMap((f) => (f.list ? [f.list.supplier] : [])))]

  const put = (changes: { path: string; p: Pending }[]) =>
    setPending((m) => {
      const n = new Map(m)
      for (const c of changes) {
        const f = fields.find((x) => x.path === c.path)
        if (f && c.p.value === f.value && !c.p.note) n.delete(c.path)
        else n.set(c.path, c.p)
      }
      return n
    })
  const drop = (path: string) =>
    setPending((m) => {
      const n = new Map(m)
      n.delete(path)
      return n
    })

  const save = (version: string, comment: string) => {
    const changes = [...pending].flatMap(([path, p]) => {
      const field = fields.find((f) => f.path === path)
      return field ? [{ field, value: p.value, note: p.note }] : []
    })
    const b = costBasis
    const r = withValues(b, changes, { version, date: today(), ...(b.version === 'eksempel' ? { source: 'Kostgrunnlag-siden' } : {}) })
    if (!r.ok) return onToast(r.error)
    const before = b.version === 'eksempel' ? null : serializeBasis(b)
    const kept = saveBasisVersion(r.basis, entryFor(b, before, version, comment, changes, new Date().toISOString()))
    setPending(new Map())
    setSheet(null)
    onToast({
      text: `Lagret som ${basisLabel(r.basis)} · ${changes.length} ${changes.length === 1 ? 'endring' : 'endringer'}${kept ? '' : ' · nettleseren lagret det ikke'}`,
      action: 'Angre',
      onAction: () => revertBasis(new Date().toISOString()),
    })
  }

  return (
    <>
      <PageBand title="Kostgrunnlag" meta={`${fields.length} tall · ${examples ? `${examples} eksempeltall` : 'ingen eksempeltall'}${unused ? ` · ${unused} ikke i bruk` : ''}`}>
        <Button onBand icon={ClipboardPaste} onClick={() => setSheet({ kind: 'paste' })}>
          Lim inn prisliste
        </Button>
      </PageBand>
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
            {tab !== 'regler' && tab !== 'formler' && tab !== 'historikk' && (
              <button type="button" className="chip-toggle" aria-pressed={onlyExample} onClick={() => setOnlyExample(!onlyExample)}>
                <i className="ph-dot" />
                Bare eksempeltall <span className="num">{count(tab)}</span>
              </button>
            )}
          </div>
          {tab === 'historikk' ? (
            <History entries={costHistory} onToast={onToast} />
          ) : tab === 'regler' ? (
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
                      <FieldRow key={f.path} f={f} lit={lit.has(f.path) || editing === f} pending={pending.get(f.path)} onOpen={() => setSheet({ kind: 'field', path: f.path })} />
                    ))}
                </section>
              ))}
              {!shown.length && <div className="tbl-empty">{onlyExample ? 'Ingen eksempeltall her: alle tallene er dine egne.' : 'Ingen tall her.'}</div>}
            </>
          )}
          {pending.size > 0 && (
            <PendingBar
              count={pending.size}
              version={nextVersion(costBasis.version, today(), costHistory.map((e) => e.version))}
              current={costBasis.version}
              onSave={save}
              onDiscard={() => {
                setPending(new Map())
                setSheet(null)
              }}
            />
          )}
        </div>
      </div>
      {editing && (
        <FieldSheet
          key={editing.path}
          f={editing}
          pending={pending.get(editing.path)}
          onApply={(p) => {
            put([{ path: editing.path, p }])
            setSheet(null)
          }}
          onUndo={() => {
            drop(editing.path)
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'paste' && (
        <PasteSheet
          fields={fields}
          suppliers={suppliers}
          onApply={(c) => {
            put(c.map((x) => ({ path: x.field.path, p: { value: x.value, note: { status: 'Bjørn', kilde: 'Innlimt prisliste', dato: today() } } })))
            setSheet(null)
            setTab('innkjop')
            setLit(new Set(c.map((x) => x.field.path)))
          }}
          onClose={() => setSheet(null)}
        />
      )}
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

function FieldRow({ f, lit, pending, onOpen }: { f: Field; lit: boolean; pending?: Pending; onOpen: () => void }) {
  return (
    <div
      className={`kg-grid kg-row tbl-row tap${lit ? ' lit' : ''}${pending ? ' changed' : ''}`}
      role="button"
      tabIndex={0}
      title={f.path}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        onOpen()
      }}
    >
      <span className="n">
        {f.label}
        {f.unused && <span className="kg-unused">ikke i bruk</span>}
      </span>
      <span className="r num">
        {pending ? (
          <>
            <s className="faint">{valueText(f)}</s> {valueText({ value: pending.value, unit: f.unit })}
          </>
        ) : (
          valueText(f)
        )}
      </span>
      <StatusChip f={pending?.note?.status ? { own: true, status: pending.note.status } : f} />
      <span className="kg-src">
        {pending ? `${pending.note?.kilde ?? 'Ny verdi'} · ikke lagret` : `${f.source} · ${f.date}`}
      </span>
    </div>
  )
}

/** The saved versions, newest first, with what changed in each; back to the one before the newest. */
function History({ entries, onToast }: { entries: readonly HistoryEntry[]; onToast: (t: ToastMsg | string) => void }) {
  const canRevert = entries.length > 0 && entries[0].version === costBasis.version
  return (
    <>
      <div className="cat-tools">
        <Button
          icon={RotateCcw}
          disabled={!canRevert}
          onClick={() => {
            const err = revertBasis(new Date().toISOString())
            onToast(err ?? `Tilbake til ${entries[0].from}`)
          }}
        >
          Tilbake til forrige versjon{canRevert ? ` (${entries[0].from})` : ''}
        </Button>
        <Button icon={Download} disabled={!entries.length} onClick={() => download(JSON.stringify(entries, null, 2), 'application/json', `kostgrunnlag-historikk-${today()}.json`)}>
          Last ned historikk
        </Button>
      </div>
      {!entries.length && (
        <div className="tbl-empty">
          <HistoryIcon size={14} /> Ingen versjoner lagret her ennå. Trykk på et tall for å endre det; endringene lagres samlet som en ny versjon.
        </div>
      )}
      {entries.map((e) => (
        <section key={e.at + e.version} className="tbl-sec">
          <div className="tbl-sec-head">
            {e.version}
            <span className="num">
              fra {e.from} · {e.at.slice(0, 10)} {e.at.slice(11, 16)}
            </span>
          </div>
          {e.comment && <p className="page-intro kg-comment-text">{e.comment}</p>}
          {e.changes.map((c) => (
            <div key={c.path} className="kg-grid kg-row tbl-row">
              <span className="n">{c.label}</span>
              <span className="r num">
                <s className="faint">{valueText({ value: c.old, unit: c.unit })}</s> {valueText({ value: c.new, unit: c.unit })}
              </span>
              <span className="kg-status">{c.note?.status ?? 'Bjørn'}</span>
              <span className="kg-src">{c.note?.kilde ?? c.path}</span>
            </div>
          ))}
        </section>
      ))}
    </>
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
