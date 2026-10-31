// Arbeidsordre: a prototype of what the OMS will issue once the quote is confirmed. Delivery, expected time per
// product group and handling step, the picking list, the stand sketch and the print list. It shows the requirement to
// the OMS in practice: everything here comes from the drawing and the price list. Background: docs/prismodell.md.
import { Printer } from 'lucide-react'
import { useState } from 'react'
import type { CalcResult } from '../../calc/calc'
import { production } from '../../calc/production'
import { groupItems } from '../../catalog/groups'
import { dateText, DELIVERY_FIELDS, today } from '../../domain/delivery'
import type { Project, Variant } from '../../domain/types'
import { customerName, projectField } from '../../domain/variant'
import { addTime, HANDLING_STEPS, minutesOf, type HandlingStep, type Time } from '../../pricing/model'
import { Button } from '../controls'
import { rules } from '../env'
import { fmt } from '../format'
import { TYPE_NAME } from '../names'
import { pickRows } from '../picking/rows'
import { PLAN_MARGIN, PlanPreview } from '../plan/PlanView'
import { PageBand } from '../shell/PageBand'
import { VariantTabs } from '../shell/VariantTabs'

interface Props {
  project: Project
  variants: Variant[]
  current: number
  onSelect: (i: number) => void
  calcOf: (v: Variant) => CalcResult
}

const STEP_NAME: Record<HandlingStep, string> = {
  plukk: 'Plukk',
  vask: 'Vask',
  transport: 'Transport',
  forhåndsmontering: 'Forh.mont.',
  montering: 'Montering',
  demontering: 'Demontering',
}

/** Hours with one decimal, '–' for none. */
const h = (min: number | undefined) => (min ? fmt(min / 60, 1) : '–')

export function WorkOrderPage({ project, variants, current, onSelect, calcOf }: Props) {
  const v = variants[current]
  const res = calcOf(v)
  const k = res.keyFigures
  const customer = customerName(project)
  const sub = [projectField(project, 'prosjekt'), projectField(project, 'standnr') && `stand ${projectField(project, 'standnr')}`].filter(Boolean).join(' · ')
  const [issued] = useState(() => today())

  // Expected time per main group, from the lines (sum products from their items, the rest from the product)
  const timeRows = res.groups
    .map((g) => ({ id: g.id, name: g.name, time: g.lines.reduce<Time>((a, l) => addTime(a, l.time), {}) }))
    .filter((r) => minutesOf(r.time) > 0)
  const steps = HANDLING_STEPS.filter((s) => k.time[s])
  const tree = groupItems(pickRows(res), (r) => r.group)
  const prints = production(v, rules.textile.inFrame, customer).pieces
  const missingDates = !DELIVERY_FIELDS.some((d) => project.delivery?.[d.key])

  return (
    <>
      <PageBand title="Arbeidsordre" meta={`Variant ${v.name} · prototype`}>
        {variants.length > 1 && <VariantTabs variants={variants} current={current} onSelect={onSelect} />}
        <Button onBand icon={Printer} onClick={() => window.print()}>
          Skriv ut
        </Button>
      </PageBand>
      <div className="doc-scroll">
        <div className="doc-note no-print">
          Prototype av arbeidsordren OMS skal lage når tilbudet er bekreftet · tider og priser er eksempeltall
          {missingDates && <span className="warn"> · leveransedatoer mangler, legg dem inn under kunde og prosjekt øverst</span>}
        </div>
        <article className="qdoc wo">
          <header className="qdoc-head">
            <div>
              <div className="eyebrow">Arbeidsordre · standbygg · variant {v.name}</div>
              <h1 className={customer ? '' : 'missing'}>{customer || 'Kundenavn'}</h1>
              {sub && <div className="muted">{sub}</div>}
            </div>
            <div className="qdoc-from">
              <strong>Expo Planner</strong>
              <span className="muted num">{dateText(issued)}</span>
              <span className="faint">Ikke bekreftet ordre</span>
            </div>
          </header>

          <section className="qdoc-summary">
            <div className="qdoc-plan" style={{ aspectRatio: `${v.stand.width + 2 * PLAN_MARGIN} / ${v.stand.depth + 2 * PLAN_MARGIN}` }}>
              <PlanPreview v={v} res={res} />
            </div>
            <dl>
              {DELIVERY_FIELDS.map((d) => (
                <div key={d.key}>
                  <dt className="num">{d.name}</dt>
                  <dd>{dateText(project.delivery?.[d.key]) || 'dato mangler'}</dd>
                </div>
              ))}
              <div>
                <dt className="num">
                  {v.stand.width} × {v.stand.depth} m
                </dt>
                <dd>
                  {TYPE_NAME[v.stand.type]} · {fmt(k.wallLm)} lm vegg · {fmt(k.beamLm)} m takdrager · {k.posts} stolper
                </dd>
              </div>
              <div>
                <dt className="num">Ca. {fmt(k.hours, 1)} timer</dt>
                <dd>
                  montering {h(k.time.montering)} t · demontering {h(k.time.demontering)} t
                </dd>
              </div>
            </dl>
          </section>

          {timeRows.length > 0 && (
            <section className="wo-sec">
              <div className="eyebrow">Forventet tid, timer</div>
              <div className="wo-time" style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${steps.length + 1}, 72px)` }}>
                <span className="wo-th">Produktgruppe</span>
                {steps.map((s) => (
                  <span key={s} className="wo-th r">
                    {STEP_NAME[s]}
                  </span>
                ))}
                <span className="wo-th r">Sum</span>
                {timeRows.map((r) => (
                  <Row key={r.id} name={r.name} time={r.time} steps={steps} />
                ))}
                <Row name="Sum" time={k.time} steps={steps} total />
              </div>
              <p className="foot">Mannskap og tidspunkt settes i OMS. Montørene melder faktisk tid per produktgruppe, så etterkalkylen kan rette tidene.</p>
            </section>
          )}

          <section className="wo-sec">
            <div className="eyebrow">Plukkliste</div>
            {!tree.length && <p className="foot">Ingenting å plukke.</p>}
            {tree.map(({ group, subgroups }) => (
              <div key={group.id} className="qgroup">
                <div className="wo-pick qgroup-head">
                  <span />
                  <span>{group.name}</span>
                  <span />
                </div>
                {subgroups.flatMap(({ items }) =>
                  items.map((l) => (
                    <div key={l.key} className="wo-pick qline">
                      <span className="wo-box" aria-hidden />
                      <span>
                        {l.title}
                        {l.code && <span className="faint num"> · {l.code}</span>}
                        {l.detail && <span className="muted num"> · {l.detail}</span>}
                      </span>
                      <span className="num">{l.qty}</span>
                    </div>
                  )),
                )}
              </div>
            ))}
          </section>

          {prints.length > 0 && (
            <section className="wo-sec">
              <div className="eyebrow">Trykkliste</div>
              <div className="wo-print qline eyebrow">
                <span>Pos</span>
                <span>Vegg</span>
                <span className="r">Ramme B × H</span>
                <span className="r">Trykk m/bleed</span>
                <span>Fil</span>
              </div>
              {prints.map((p) => (
                <div key={p.pos} className="wo-print qline">
                  <span className="num">{p.pos}</span>
                  <span>{p.wall}</span>
                  <span className="num r">
                    {p.W} × {p.H}
                  </span>
                  <span className="num r">
                    {p.pw} × {p.ph}
                  </span>
                  <span className="num muted wo-file">{p.fileName}</span>
                </div>
              ))}
            </section>
          )}
        </article>
      </div>
    </>
  )
}

function Row({ name, time, steps, total }: { name: string; time: Time; steps: HandlingStep[]; total?: boolean }) {
  return (
    <>
      <span className={total ? 'wo-total' : ''}>{name}</span>
      {steps.map((s) => (
        <span key={s} className={'num r' + (total ? ' wo-total' : '')}>
          {h(time[s])}
        </span>
      ))}
      <span className={'num r wo-sum' + (total ? ' wo-total' : '')}>{h(minutesOf(time))}</span>
    </>
  )
}
