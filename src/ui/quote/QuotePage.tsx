// Tilbud: an A4 document built from the calc. Printing from the browser gives the PDF.
import { useState } from 'react'
import { Printer } from 'lucide-react'
import type { CalcResult } from '../../calc/calc'
import type { Project, Room, Variant } from '../../domain/types'
import { isFixedField, projectField } from '../../domain/variant'
import { Button } from '../controls'
import { idx, plateName, productOf, rules } from '../env'
import { count, fmt, kr, mm } from '../format'
import { beamSummary, frameCount, TYPE_NAME } from '../names'
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
  const [date] = useState(() => new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }))
  const lines = res.groups.flatMap((g) => g.lines)
  const placeholders = lines.filter((l) => l.placeholder).length
  const preliminary = lines.some((l) => l.preliminary)
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
      `${fmt(k.wallLm)} lm standvegg`,
      [`veggplate ${plates.map((r) => `${plateName(r).toLowerCase()} RAL ${r}`).join(', ')}`, ...openingNames].join(' · '),
    ],
    k.beamLm
      ? [`${fmt(k.beamLm)} m takdrager`, beamSummary(k)]
      : ['Uten takdrager', 'ingen åpne sider å avstive'],
    k.floorTotal ? [floorNames.join(', '), `${fmt(k.floorTotal)} m² ferdig lagt${v.floor.protection ? ' med monteringsbeskyttelse' : ''}`] : ['Hallgulv uten belegg', ''],
  ]
  if (v.rooms.length) {
    const kind = (r: Room) => {
      const ps = v.openings.filter((o) => o.wallId.startsWith(`${r.id}.`)).map((o) => productOf(o.product)?.name.toLowerCase() ?? o.product)
      return ps.length ? `med ${ps.join(' og ')}` : 'uten åpning'
    }
    facts.splice(2, 0, [
      v.rooms.map((r) => `${r.label ?? 'Bakrom'} ${r.w} × ${r.d} m`).join(', '),
      v.rooms.map(kind).join(' · ') + (k.roomWallLm ? ` · ${fmt(k.roomWallLm)} lm av standveggen` : ''),
    ])
  }
  if (k.textileM2) facts.push([`${fmt(k.textileM2)} m² tekstilvegg`, `${frameCount(res.production.pieces.length)} InFrame`])

  const unpriced = v.loose.filter((l) => !l.price)

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
        </div>
        <article className="qdoc">
          <header className="qdoc-head">
            <div>
              <div className="eyebrow">Tilbud · standbygg · variant {v.name}</div>
              <h1 className={customer ? '' : 'missing'}>{customer || 'Kundenavn'}</h1>
              {sub && <div className="muted">{sub}</div>}
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
              <span className="muted num">{date}</span>
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
            {res.groups.map((g) => (
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
                      {l.preliminary && <span className="mark"> †</span>}
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
            {placeholders > 0 && (
              <p className="foot">
                * {count(placeholders, 'linje', 'linjer')} har plassholderpris og må bekreftes før tilbudet sendes.
              </p>
            )}
            {preliminary && <p className="foot">† Monteringstid er beregnet med foreløpige satser og bekreftes av produksjon.</p>}
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
                Montering og demontering er beregnet ut fra omfang{preliminary ? ' med foreløpige satser' : ''}. Strøm og lys bestilles via hallens leverandør der det kreves.
              </li>
              <li>Alle priser er eks. mva. Tilbudet er veiledende og bekreftes ved bestilling.</li>
            </ul>
          </section>
        </article>
      </div>
    </>
  )
}
