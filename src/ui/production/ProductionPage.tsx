// Produksjon: InFrame frame sizes, print-file sizes and file names per textile wall (fabric.js rules).
// The assumptions on the right are editable and feed the calc too.
import { Download } from 'lucide-react'
import { useMemo } from 'react'
import { fullHeight } from '../../calc/fabric'
import { production, type Production } from '../../calc/production'
import type { Variant } from '../../domain/types'
import type { InFrameParams } from '../../rules/rules'
import { Button, Segmented } from '../controls'
import { DEFAULT_IN_FRAME, rules, setInFrame } from '../env'
import { fmt } from '../format'
import { PageBand } from '../shell/PageBand'

const FIELDS: { k: keyof InFrameParams; name: string; help: string; unit?: string }[] = [
  { k: 'side', name: 'Sidefradrag', help: 'Vegg eller takdrager på begge sider, 2 × 10 mm' },
  { k: 'air', name: 'Luft i bredden', help: 'Monteringsklaring' },
  { k: 'wallH', name: 'Systemvegg', help: 'Høyde på standveggen uten føtter' },
  { k: 'feet', name: 'Justerbare føtter', help: 'Typisk høyde for nivellering' },
  { k: 'bleed', name: 'Bleed per side', help: 'Full størrelse. WorkMan-spek 20 mm, internt ofte 14 mm' },
  { k: 'scale', name: 'Filskala', help: 'Kunden leverer filen i denne størrelsen', unit: '%' },
  { k: 'prof', name: 'Rammeprofil', help: 'Profilbredde, trekkes fra staglengden' },
  { k: 'stag', name: 'Maks stagavstand', help: 'Tverrstag når rammen er bredere' },
]

interface Props {
  variants: Variant[]
  current: number
  onSelect: (i: number) => void
  customer: string
  motifName: (id: string) => string | undefined
  onToast: (text: string) => void
}

export function ProductionPage({ variants, current, onSelect, customer, motifName, onToast }: Props) {
  const v = variants[current]
  const s = rules.textile.inFrame
  const P = useMemo(() => production(v, s, customer), [v, s, customer])
  const n = (x: number) => fmt(x, 0)
  const count = P.pieces.length

  const exportCsv = () => {
    const blob = new Blob([productionCsv(P, s)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `produksjon-variant-${v.name}.csv`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <>
      <PageBand title="Produksjon" meta={`Variant ${v.name} · ${count} ${count === 1 ? 'tekstilvegg' : 'tekstilvegger'}`}>
        {variants.length > 1 && (
          <Segmented<number> onBand label="Varianter" value={current} onChange={onSelect} options={variants.map((x, i) => ({ value: i, label: `Variant ${x.name}` }))} />
        )}
        <Button onBand icon={Download} disabled={!count} onClick={exportCsv}>
          Eksporter
        </Button>
      </PageBand>
      <div className="page-scroll">
        <div className="page-cols">
          <div className="page-main">
            <p className="page-intro">
              Rammene monteres utenpå standveggene. Rammemål som passer i standen, og trykkfilmålet kunden skal levere grafikken i. Trykkfilen er rammemålet pluss {s.bleed} mm bleed på
              hver side.
            </p>
            <div className="prod-grid tbl-head">
              <span>Pos</span>
              <span>Del · profiler</span>
              <span className="r">Stk</span>
              <span>Ramme</span>
              <span>Trykkfil inkl. bleed</span>
              <span className="r">m²</span>
            </div>
            <section className="tbl-sec">
              <div className="tbl-sec-head">
                <span>Tekstilvegger</span>
                <span className="num">{count}</span>
              </div>
              {!count && <div className="tbl-empty">Ingen tekstilvegger i variant {v.name}.</div>}
              {P.pieces.map((p) => (
                <div key={p.pos} className="prod-grid tbl-row">
                  <span className="num muted">{p.pos}</span>
                  <div className="cellstack">
                    <span className="title">
                      {p.wall} · spenn {n(p.span)} mm fra {n(p.at)}
                    </span>
                    <span className="sub">{(p.motif && motifName(p.motif)) || (p.motif ? `Motiv ${p.motif}` : 'Uten motiv')}</span>
                    <span className="num meta">
                      {p.profiles.map((x) => `${x.qty} × ${n(x.length)}`).join(' · ')}
                      {p.braces ? ` · stag ${p.braces.qty} × ${n(p.braces.length)}` : ''} <span className="faint">mm, gjæret</span>
                    </span>
                    <span className="num meta">
                      Fil {s.scale} %: {fmt(p.fw, 1)} × {fmt(p.fh, 1)} mm inkl. {fmt(p.fb, 1)} mm bleed · {p.fileName}
                    </span>
                  </div>
                  <span className="num r">1</span>
                  <span className="num">
                    {n(p.W)} × {n(p.H)}
                  </span>
                  <span className="num">
                    {n(p.pw)} × {n(p.ph)}
                  </span>
                  <span className="num r">{fmt(p.area, 2)}</span>
                </div>
              ))}
            </section>
            <div className="prod-grid tbl-sum">
              <span />
              <span className="title">Sum</span>
              <span className="num r">{count}</span>
              <span className="num">
                {fmt(P.lm, 2)} <span className="muted">lm profil</span>
              </span>
              <span />
              <span className="num r">{fmt(P.area, 2)}</span>
            </div>
          </div>
          <aside className="page-side">
            <div className="side-head">
              <span>Antakelser</span>
              <button
                type="button"
                className="link"
                onClick={() => {
                  setInFrame({ ...DEFAULT_IN_FRAME })
                  onToast('Antakelser tilbakestilt')
                }}
              >
                Tilbakestill
              </button>
            </div>
            {FIELDS.map((f) => (
              <label key={f.k} className="assume">
                <span>
                  <span className="name">{f.name}</span>
                  <span className="help">{f.help}</span>
                </span>
                <span className="unit-field">
                  <input
                    key={f.k + s[f.k]}
                    className="num"
                    inputMode="numeric"
                    defaultValue={s[f.k]}
                    aria-label={f.name}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    onBlur={(e) => {
                      const x = parseFloat(e.target.value.replace(',', '.'))
                      if (Number.isFinite(x) && x >= 0 && x !== s[f.k] && !(f.k === 'stag' && x === 0) && !(f.k === 'scale' && x === 0)) setInFrame({ ...s, [f.k]: x })
                      else e.target.value = String(s[f.k])
                    }}
                  />
                  <span>{f.unit ?? 'mm'}</span>
                </span>
              </label>
            ))}
            <div className="formulas num">
              <div>B = spenn − sidefradrag − luft</div>
              <div>H = systemvegg + føtter = {n(fullHeight(s))}</div>
              <div>trykkfil = ramme + 2 × bleed</div>
              <div>fil = trykkfil × {s.scale} %</div>
              <div>stag = H − 2 × profil</div>
            </div>
            <p className="side-note">Antakelsene gjelder også kalkylen: rammeprofil og trykk på tilbudet regnes med de samme målene.</p>
          </aside>
        </div>
      </div>
    </>
  )
}

function productionCsv(P: Production, s: InFrameParams): string {
  const c = (x: number) => x.toFixed(2).replace('.', ',')
  const rows: (string | number)[][] = [
    ['Pos', 'Del', 'Vegg', 'Stk', 'Ramme B', 'Ramme H', 'Trykkfil B', 'Trykkfil H', 'Bleed per side', 'Fil B', 'Fil H', 'Filskala', 'Filnavn', 'Trykk m²', 'Profil lm', 'Tverrstag'],
  ]
  for (const p of P.pieces)
    rows.push([
      p.pos,
      'Tekstilvegg',
      p.wall,
      1,
      p.W,
      p.H,
      p.pw,
      p.ph,
      s.bleed,
      String(p.fw).replace('.', ','),
      String(p.fh).replace('.', ','),
      `${s.scale} %`,
      p.fileName,
      c(p.area),
      c(p.lm),
      p.braces ? `${p.braces.qty} × ${p.braces.length}` : '',
    ])
  return '\ufeff' + rows.map((r) => r.map((x) => (/[;"\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(';')).join('\n')
}
