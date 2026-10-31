// Produksjon: InFrame frame sizes, print-file sizes and file names per textile wall (fabric.js rules).
// The assumptions on the right are editable and feed the calc too.
import { Download } from 'lucide-react'
import { useMemo } from 'react'
import { fullHeight } from '../../calc/fabric'
import { production, type Production } from '../../calc/production'
import type { TextileFill, Variant } from '../../domain/types'
import type { InFrameParams } from '../../rules/rules'
import { toCsvText } from '../../persistence/csv'
import { Button, CommitInput } from '../controls'
import { download } from '../download'
import { DEFAULT_IN_FRAME, rules, setInFrame } from '../env'
import { count, fmt } from '../format'
import { PageBand } from '../shell/PageBand'
import { VariantTabs } from '../shell/VariantTabs'

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
  const nPieces = P.pieces.length
  const nFree = P.free.length
  const fillText = (fill: TextileFill, motif: string | null) =>
    fill === 'reuse' ? 'Kundens duk, bare montering' : fill === 'white' ? 'Hvit, uten grafikk' : (motif && motifName(motif)) || (motif ? `Motiv ${motif}` : 'Trykk, uten motiv')

  const exportCsv = () => download(productionCsv(P, s), 'text/csv;charset=utf-8', `produksjon-variant-${v.name}.csv`)

  return (
    <>
      <PageBand title="Produksjon" meta={`Variant ${v.name} · ${count(nPieces + nFree, 'tekstilvegg', 'tekstilvegger')}`}>
        {variants.length > 1 && <VariantTabs variants={variants} current={current} onSelect={onSelect} />}
        <Button onBand icon={Download} disabled={!nPieces && !nFree} onClick={exportCsv}>
          Eksporter
        </Button>
      </PageBand>
      <div className="page-scroll">
        <div className="page-cols">
          <div className="page-main">
            <p className="page-intro">
              Rammene på systemvegg monteres utenpå veggen. Frittstående vegger har tekstil på begge sider og står på fotplater. Rammemål som passer i standen, og trykkfilmålet kunden skal levere grafikken i. Trykkfilen er rammemålet pluss {s.bleed} mm bleed på
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
                <span>Tekstilvegger på systemvegg</span>
                <span className="num">{nPieces}</span>
              </div>
              {!nPieces && <div className="tbl-empty">Ingen tekstilvegger i variant {v.name}.</div>}
              {P.pieces.map((p) => (
                <div key={p.pos} className="prod-grid tbl-row">
                  <span className="num muted">{p.pos}</span>
                  <div className="cellstack">
                    <span className="title">
                      {p.wall} · spenn {n(p.span)} mm fra {n(p.at)}
                    </span>
                    <span className="sub">{fillText(p.fill, p.motif)}</span>
                    <span className="num meta">
                      {p.profiles.map((x) => `${x.qty} × ${n(x.length)}`).join(' · ')}
                      {p.braces ? ` · stag ${p.braces.qty} × ${n(p.braces.length)}` : ''} <span className="faint">mm, gjæret</span>
                    </span>
                    <span className="num meta">
                      {p.fileName ? `Fil ${s.scale} %: ${fmt(p.fw, 1)} × ${fmt(p.fh, 1)} mm inkl. ${fmt(p.fb, 1)} mm bleed · ${p.fileName}` : 'Ingen trykkfil'}
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
            <section className="tbl-sec">
              <div className="tbl-sec-head">
                <span>Frittstående tekstilvegger</span>
                <span className="num">{nFree}</span>
              </div>
              {!nFree && <div className="tbl-empty">Ingen frittstående tekstilvegger i variant {v.name}.</div>}
              {P.free.map((f) =>
                f.faces.map((x, i) => (
                  <div key={x.pos} className="prod-grid tbl-row">
                    <span className="num muted">{x.pos}</span>
                    <div className="cellstack">
                      <span className="title">
                        {f.pos} · side {x.face.toUpperCase()} · {n(f.length)} mm{f.nCorners ? ' · hjørne 92LTX' : ''}
                      </span>
                      <span className="sub">{fillText(x.fill, x.motif)}</span>
                      {i === 0 && (
                        <span className="num meta">
                          Skinner 2 × ({f.railCuts.map(n).join(' + ')}){f.uprights ? ` · stående ${f.uprights} × ${n(f.H)}` : ''} · stag {f.supports.length} × {n(f.braceLength)} · {count(f.supports.length, 'fotplate', 'fotplater')}
                        </span>
                      )}
                      <span className="num meta">{x.fileName ? `Fil ${s.scale} %: ${fmt(x.fw, 1)} × ${fmt(x.fh, 1)} mm inkl. ${fmt(s.bleed * (s.scale / 100), 1)} mm bleed · ${x.fileName}` : 'Ingen trykkfil'}</span>
                    </div>
                    <span className="num r">1</span>
                    <span className="num">
                      {n(x.W)} × {n(x.H)}
                    </span>
                    <span className="num">{x.fill === 'reuse' ? '–' : `${n(x.pw)} × ${n(x.ph)}`}</span>
                    <span className="num r">{x.fill === 'reuse' ? '–' : fmt(x.printArea, 2)}</span>
                  </div>
                )),
              )}
            </section>
            <div className="prod-grid tbl-sum">
              <span />
              <span className="title">Sum</span>
              <span className="num r">{nPieces + 2 * nFree}</span>
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
                  <CommitInput
                    className="num"
                    inputMode="numeric"
                    value={String(s[f.k])}
                    aria-label={f.name}
                    selectOnFocus
                    onCommit={(text) => {
                      const x = parseFloat(text.replace(',', '.'))
                      if (!Number.isFinite(x) || x < 0 || x === s[f.k] || (f.k === 'stag' && x === 0) || (f.k === 'scale' && x === 0)) return false
                      setInFrame({ ...s, [f.k]: x })
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
      p.fileName ?? '',
      c(p.fill === 'reuse' ? 0 : p.area),
      c(p.lm),
      p.braces ? `${p.braces.qty} × ${p.braces.length}` : '',
    ])
  for (const f of P.free)
    for (const x of f.faces)
      rows.push([
        x.pos,
        'Tekstilvegg frittstående',
        `${f.pos} side ${x.face.toUpperCase()}`,
        1,
        x.W,
        x.H,
        x.pw,
        x.ph,
        s.bleed,
        String(x.fw).replace('.', ','),
        String(x.fh).replace('.', ','),
        `${s.scale} %`,
        x.fileName ?? '',
        c(x.fill === 'reuse' ? 0 : x.printArea),
        '',
        x.face === 'a' ? `${f.supports.length} × ${f.braceLength}` : '',
      ])
  return toCsvText(rows)
}
