import { FileText } from 'lucide-react'
import type { CalcResult } from '../../calc/calc'
import { LAYER_COLOR } from '../colors'
import { Button } from '../controls'
import { rules } from '../env'
import { fmt, kr } from '../format'
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
  return (
    <aside className="calc" aria-label="Veiledende kalkyle">
      <div className="calc-head">
        <div className="spacer">
          <h2>Veiledende kalkyle</h2>
          <div className="sub">
            Eksempelpriser{placeholders ? <span className="ph"> · {placeholders} plassholderpriser</span> : null}
          </div>
        </div>
        <span className="band-tag">
          {name}
        </span>
      </div>
      <div className="calc-scroll" onMouseLeave={() => onHover(null)}>
        {res.groups.map((g) => (
          <section key={g.id} className="cg">
            <div className="cg-head" onMouseEnter={() => onHover(layerOf(g.id))}>
              <span className="sq" style={DOT[layerOf(g.id) ?? ''] ? { background: DOT[layerOf(g.id) ?? ''], borderRadius: '50%' } : undefined} />
              <span className="name">{g.name}</span>
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
              </div>
            ))}
          </section>
        ))}
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
        {res.keyFigures.hours > 0 && (
          <div className="inkl num">
            Montering ca. {fmt(res.keyFigures.hours)} t, inngår i prisene
            {res.keyFigures.hoursPreliminary && <span className="ph"> · foreløpig sats</span>}
          </div>
        )}
        <Button variant="primary" icon={FileText} onClick={onQuote}>
          Åpne tilbud
        </Button>
      </div>
    </aside>
  )
}
