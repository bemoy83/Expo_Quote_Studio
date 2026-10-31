import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { useState } from 'react'
import type { CalcLine, CalcResult } from '../../calc/calc'
import { groupItems, mainGroupOf } from '../../catalog/groups'
import type { BomLine } from '../../foga/engine'
import { LAYER_COLOR } from '../colors'
import { Button } from '../controls'
import { rules } from '../env'
import { fmt, hours, kr } from '../format'
import type { Highlight } from '../tools'

/** Plan layer of a subgroup or main group id (catalog/groups.ts). */
const LAYER: Record<string, Highlight> = {
  'vegg.takdrager': 'beams',
  'vegg.dorer': 'openings',
  'prof.tekstil': 'textile',
  'prof.folie': 'foil',
  vegg: 'walls',
  gulv: 'floor',
  prof: 'textile',
  tjen: null,
}
export const layerOf = (id: string): Highlight => (id in LAYER ? LAYER[id] : id.includes('.') ? layerOf(id.split('.')[0]) : 'objects')

const DOT: Partial<Record<string, string>> = LAYER_COLOR

export function CalcPanel({ res, name, onHover, onQuote }: { res: CalcResult; name: string; onHover: (h: Highlight) => void; onQuote: () => void }) {
  const lines = res.groups.flatMap((g) => g.lines)
  const placeholders = lines.filter((l) => l.placeholder).length
  const t = res.keyFigures.time
  // Level 2: the Foga articles behind each main group, the same as on the picking list. Quantities only.
  const articles = res.bom.lines
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setOpen((o) => new Set(o.has(id) ? [...o].filter((x) => x !== id) : [...o, id]))
  return (
    <aside className="calc" aria-label="Veiledende kalkyle">
      <div className="calc-head">
        <div className="spacer">
          <h2>Veiledende kalkyle</h2>
          <div className="sub">
            Eksempelpriser fra OMS{placeholders ? <span className="ph"> · {placeholders} plassholderpriser</span> : null}
          </div>
        </div>
        <span className="band-tag">
          {name}
        </span>
      </div>
      <div className="calc-scroll" onMouseLeave={() => onHover(null)}>
        {res.groups.map((g) => {
          const layer = layerOf(g.id)
          const dot = layer ? DOT[layer] : undefined
          return (
            <section key={g.id} className="cg">
              <div className="cg-head" onMouseEnter={() => onHover(layer)}>
                <span className="sq" style={dot ? { background: dot, borderRadius: '50%' } : undefined} />
                <span className="name">{g.name}</span>
                <span className="dg">{dgText(g.lines)}</span>
                <span className="num">
                  {kr(g.sum)}
                </span>
              </div>
              {g.lines.map((l, i) => (
                <div key={l.artnr + l.name + i} className="cl" onMouseEnter={() => onHover(layerOf(l.group))}>
                  <span className="n">{l.name}</span>
                  <span className="s">{kr(l.sum)}</span>
                  <span className="meta">
                    {fmt(l.qty)} {l.unit} × {kr(l.price)}
                    {l.meta ? ` · ${l.meta}` : ''}
                    {l.placeholder && <span className="ph"> · plassholder</span>}
                  </span>
                  <span className="meta cost">
                    {l.strategy === 'sum' ? 'sum av artikler' : 'fast pris'}
                    {l.cost === null ? <span className="ph"> · kost mangler</span> : ` · kost ${kr(l.cost)} · DG ${pct(l.dg ?? 0)}`}
                    {l.terms ? ` · ${l.terms}` : ''}
                  </span>
                </div>
              ))}
              <Articles lines={articles.filter((x) => mainGroupOf(x.group) === g.id)} open={open.has(g.id)} onToggle={() => toggle(g.id)} />
            </section>
          )
        })}
      </div>
      <div className="calc-foot">
        <div className="sum">
          <span className="lbl">Sum eks. mva.</span>
          <span className="v num">{kr(res.sum)}</span>
          <span className="u">kr</span>
        </div>
        <div className="inkl num">
          inkl. mva. {kr(res.sum * (1 + rules.vat))} · {kr(res.keyFigures.area ? res.sum / res.keyFigures.area : 0)} per m²
        </div>
        <div className="inkl num margin">
          Internt: kost {kr(res.margin.cost)} · DB {kr(res.margin.db)} · DG {pct(res.margin.dg)}
          {res.margin.unknown > 0 && <span className="ph"> · {res.margin.unknown} {res.margin.unknown === 1 ? 'linje' : 'linjer'} uten kost</span>}
        </div>
        {!!(t.montering || t.demontering) && (
          <div className="inkl num">
            Montering ca. {hours(t.montering ?? 0)} t · demontering ca. {hours(t.demontering ?? 0)} t, inngår i prisene
          </div>
        )}
        <Button variant="primary" icon={FileText} onClick={onQuote}>
          Åpne tilbud
        </Button>
      </div>
    </aside>
  )
}

const pct = (x: number) => `${Math.round(x * 100)} %`

/** DG of a group over its lines with known cost. */
function dgText(lines: CalcLine[]) {
  const known = lines.filter((l) => l.cost !== null)
  const sum = known.reduce((a, l) => a + l.sum, 0)
  const cost = known.reduce((a, l) => a + (l.cost ?? 0), 0)
  return sum > 0 ? `DG ${pct((sum - cost) / sum)}` : ''
}

/** Level 2 under a main group: the articles the montør picks, by subgroup, quantities only. */
function Articles({ lines, open, onToggle }: { lines: BomLine[]; open: boolean; onToggle: () => void }) {
  if (!lines.length) return null
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <>
      <button type="button" className="cg-arts" aria-expanded={open} onClick={onToggle}>
        <Icon size={12} /> {lines.length} artikler
      </button>
      {open &&
        groupItems(lines, (x) => x.group).flatMap(({ subgroups }) =>
          subgroups.map(({ subgroup, items }) => (
            <div key={subgroup.id}>
              <div className="cl art sub">{subgroup.name}</div>
              {items.map((x) => (
                <div key={x.name + x.detail} className="cl art">
                  <span className="n">
                    {x.name}
                    {x.ral ? ` · RAL ${x.ral}` : ''}
                  </span>
                  <span className="s">{x.qty} stk</span>
                </div>
              ))}
            </div>
          )),
        )}
    </>
  )
}
