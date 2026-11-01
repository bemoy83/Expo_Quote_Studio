// Tilbud: an A4 document built from the calc. Printing from the browser gives the PDF.
import { useState } from 'react'
import { Printer } from 'lucide-react'
import type { CalcResult } from '../../calc/calc'
import { quoteGroups } from '../../calc/quoteLines'
import type { Project, Room, Variant } from '../../domain/types'
import { roomName, roomOpenings, roomSize } from '../../domain/rooms'
import { dateText, DELIVERY_FIELDS, today, validUntil } from '../../domain/delivery'
import { isFixedField, projectField, standWallTerms } from '../../domain/variant'
import { Button } from '../controls'
import { idx, plateName, productOf, rules } from '../env'
import { count, fmt, kr, mm } from '../format'
import { beamSummary, capitalise, frameCount, fromOrganiser, TYPE_NAME } from '../names'
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

export function QuotePage({ project, variants, current, onSelect, calcOf }: Props) {
  const v = variants[current]
  const res = calcOf(v)
  const k = res.keyFigures
  const field = (id: string) => projectField(project, id)
  const customer = field('kunde')
  const sub = [field('prosjekt'), field('standnr') && `stand ${field('standnr')}`].filter(Boolean).join(' · ')
  const extra = project.fields.filter((f) => !isFixedField(f.id) && f.value.trim())
  // Sent today: the quote holds 30 days, but ends 14 days before montering when that comes first (rules.quote)
  const [sent] = useState(() => today())
  const valid = validUntil(sent, project.delivery, rules.quote)
  const delivery = DELIVERY_FIELDS.filter((d) => project.delivery?.[d.key]).map((d) => `${d.name} ${dateText(project.delivery?.[d.key])}`)
  const groups = quoteGroups(res.groups)
  const lines = groups.flatMap((g) => g.lines)
  const placeholders = lines.filter((l) => l.placeholder).length
  const labourLines = lines.some((l) => l.group === 'tjen.montering')
  const inFrame = rules.textile.inFrame

  // Summary next to the sketch
  const plates = [...new Set(v.walls.map((w) => w.plate ?? v.defaultPlate))]
  const openingNames = Object.entries(
    v.openings.reduce<Record<string, number>>((a, o) => {
      const n = productOf(o.product)?.name.toLowerCase() ?? o.product
      a[n] = (a[n] ?? 0) + 1
      return a
    }, {}),
  ).map(([n, q]) => `${q} ${n}`)
  const floorNames = Object.keys(k.floor).map((a) => {
    const r = idx.byArtnr.get(a)
    return r ? (r.product.variants.length > 1 ? `${r.product.name} ${r.variant.name.toLowerCase()}` : r.product.name) : a
  })
  const facts: [string, string][] = [
    [`${v.stand.width} × ${v.stand.depth} m`, `${fmt(k.area)} m² · ${TYPE_NAME[v.stand.type]} · ${k.openSides} åpne sider`],
    [
      `${fmt(k.wallLm - k.organiserWallLm)} lm vegg`,
      [
        `veggplate ${plates.map((r) => `${plateName(r).toLowerCase()} RAL ${r}`).join(', ')}`,
        ...openingNames,
        ...(k.organiserWallLm ? [`${fmt(k.organiserWallLm)} lm standvegg fra arrangøren`] : []),
      ].join(' · '),
    ],
    k.beamLm
      ? [
          `${fmt(k.beamLm)} m takdrager`,
          [
            k.organiserBeamLm ? `${fmt(k.organiserBeamLm)} m fra arrangøren` : beamSummary(k),
            ...(k.innerBeamLm ? [`${fmt(k.innerBeamLm)} m innvendig`] : []),
          ].join(' · '),
        ]
      : ['Uten takdrager', v.noBeams ? 'åpen stand etter ønske' : 'ingen åpne sider å avstive'],
    k.floorTotal ? [floorNames.join(', '), `${fmt(k.floorTotal)} m² ferdig lagt${v.floor.protection ? ' med monteringsbeskyttelse' : ''}`] : ['Hallgulv uten belegg', ''],
  ]
  if (v.rooms.length) {
    const kind = (r: Room) => {
      const ps = roomOpenings(v, r).map((o) => productOf(o.product)?.name.toLowerCase() ?? o.product)
      return ps.length ? `med ${ps.join(' og ')}` : 'uten åpning'
    }
    facts.splice(2, 0, [
      v.rooms.map((r) => `${roomName(r)} ${roomSize(r)}`).join(', '),
      v.rooms.map(kind).join(' · ') + (k.roomWallLm ? ` · ${fmt(k.roomWallLm)} lm romvegg` : ''),
    ])
  }
  const P = res.production
  if (P.pieces.length || P.free.length) {
    facts.push([
      `${fmt(k.textileM2)} m² tekstil`,
      [P.pieces.length ? `${frameCount(P.pieces.length)} på systemvegg` : '', P.free.length ? `${fmt(P.freeLm, 2)} lm frittstående` : ''].filter(Boolean).join(' · '),
    ])
  }

  const unpriced = v.loose.filter((l) => !l.price)
  // Stand walls and takdrager the organiser pays: not the exhibitor's lines, only named
  const organiser = fromOrganiser(k, plateName(standWallTerms(project).ral))

  return (
    <>
      <PageBand title="Tilbud" meta={`Variant ${v.name} · ${kr(res.sum)} kr eks. mva.`}>
        {variants.length > 1 && <VariantTabs variants={variants} current={current} onSelect={onSelect} />}
        <Button onBand icon={Printer} onClick={() => window.print()}>
          Skriv ut
        </Button>
      </PageBand>
      <div className="doc-scroll">
        <div className="doc-note no-print">
          Forhåndsvisning · utskrift gir PDF
          {!customer && <span className="warn"> · kundenavn mangler, legg det inn under kunde og prosjekt øverst</span>}
          {!project.delivery?.montering && <span className="warn"> · monteringsdato mangler, tilbudet gjelder da {rules.quote.validDays} dager</span>}
          {valid.late && <span className="warn"> · montering er nærmere enn {rules.quote.beforeMount} dager</span>}
        </div>
        <article className="qdoc">
          <header className="qdoc-head">
            <div>
              <div className="eyebrow">Tilbud · standbygg · variant {v.name}</div>
              <h1 className={customer ? '' : 'missing'}>{customer || 'Kundenavn'}</h1>
              {sub && <div className="muted">{sub}</div>}
              {delivery.length > 0 && <div className="muted num">{delivery.join(' · ')}</div>}
              {extra.length > 0 && (
                <div className="muted extra">
                  {extra.map((f) => (
                    <span key={f.id}>
                      <span className="faint">{f.name}</span> {f.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="qdoc-from">
              <strong>Expo Planner</strong>
              <span className="muted num">{dateText(sent)}</span>
              <span className={'num' + (valid.late ? ' warn' : ' muted')}>Gyldig til {dateText(valid.until)}</span>
              <span className="faint">Veiledende · ikke bindende</span>
            </div>
          </header>

          <section className="qdoc-summary">
            <div className="qdoc-plan" style={{ aspectRatio: `${v.stand.width + 2 * PLAN_MARGIN} / ${v.stand.depth + 2 * PLAN_MARGIN}` }}>
              <PlanPreview v={v} res={res} />
            </div>
            <dl>
              {facts.map(([a, b], i) => (
                <div key={i}>
                  <dt className="num">{a}</dt>
                  {b && <dd>{b}</dd>}
                </div>
              ))}
            </dl>
          </section>

          <section className="qdoc-lines">
            <div className="qgrid eyebrow">
              <span>Post</span>
              <span>Antall</span>
              <span>Á pris</span>
              <span>Sum</span>
            </div>
            {groups.map((g) => (
              <div key={g.id} className="qgroup">
                <div className="qgrid qgroup-head">
                  <span>{g.name}</span>
                  <span />
                  <span />
                  <span className="num">{kr(g.sum)}</span>
                </div>
                {g.lines.map((l, i) => (
                  <div key={l.artnr + l.name + i} className="qgrid qline">
                    <span>
                      {l.name}
                      {l.placeholder && <span className="mark"> *</span>}
                      {l.terms && <span className="muted"> · {l.terms}</span>}
                    </span>
                    <span className="num muted">
                      {fmt(l.qty)} {l.unit}
                    </span>
                    <span className="num muted">{kr(l.price)}</span>
                    <span className="num">{kr(l.sum)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="qdoc-total">
              <div className="row">
                <span>Sum eks. mva.</span>
                <span className="num">{kr(res.sum)} kr</span>
              </div>
              <div className="row">
                <span>Mva. {fmt(rules.vat * 100, 0)} %</span>
                <span className="num">{kr(res.sum * rules.vat)} kr</span>
              </div>
              <div className="row grand">
                <span>Sum inkl. mva.</span>
                <span className="num big">{kr(res.sum * (1 + rules.vat))}</span>
                <span className="num muted">kr</span>
              </div>
            </div>
            {organiser && <p className="foot">{capitalise(organiser)} leveres av arrangøren og inngår ikke i tilbudet.</p>}
            {placeholders > 0 && (
              <p className="foot">
                * {count(placeholders, 'linje', 'linjer')} har plassholderpris og må bekreftes før tilbudet sendes.
              </p>
            )}
          </section>

          <section className="qdoc-terms">
            <div className="eyebrow">Forutsetninger</div>
            <ul>
              <li>
                Standvegger i systemprofil {mm(rules.wall.post)} × {mm(rules.wall.post)} mm, cc {mm(rules.wall.cc)}, høyde {mm(rules.wall.height)} mm på justerbare føtter (
                {mm(rules.wall.feet)} mm). Plater {rules.wall.plate.width} × {rules.wall.plate.height} mm.
              </li>
              {k.beamLm > 0 && (
                <li>
                  Takdrager {mm(rules.beam.height)} × {mm(rules.beam.thickness)} mm langs åpne sider, lengder inntil {fmt(rules.beam.max)} m, skjøtt med stolpe og tverrdrager.
                  {k.innerBeamLm > 0 && ' Innvendige takdragere henger på krok i andre takdragere, ellers på stolpe med fotplate.'}
                </li>
              )}
              {res.production.pieces.length > 0 && (
                <li>
                  Tekstilvegger i InFrame montert utenpå standvegg: {res.production.pieces.map((p) => `${fmt(p.W, 0)} × ${fmt(p.H, 0)} mm`).join(', ')}. Trykkfil leveres i{' '}
                  {inFrame.scale} % med {inFrame.bleed} mm bleed i full størrelse.
                </li>
              )}
              {k.floorTotal > 0 && <li>Gulv ferdig lagt{v.floor.protection ? ' med monteringsbeskyttelse' : ''}.</li>}
              {unpriced.length > 0 && <li>Løse linjer uten pris avtales separat: {unpriced.map((l) => l.name).join(', ')}.</li>}
              <li>
                Montering og demontering inngår i prisene.{labourLines ? ' Arbeidstimer gjelder hjelp med eget utstyr.' : ''} Strøm og lys bestilles via hallens leverandør der det kreves.
              </li>
              <li>
                Alle priser er eks. mva. Tilbudet gjelder til {dateText(valid.until)}
                {valid.byMount ? `, ${rules.quote.beforeMount} dager før montering` : ''}. Det er veiledende og bekreftes ved bestilling.
              </li>
            </ul>
          </section>
        </article>
      </div>
    </>
  )
}
