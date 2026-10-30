import { FileText } from 'lucide-react'
import type { CalcGroup, CalcResult } from '../../calc/calc'
import { LAYER_COLOR } from '../colors'
import { Button } from '../controls'
import { rules } from '../env'
import { fmt, kr } from '../format'
import type { Highlight } from '../tools'

/** Which plan layer a calc group belongs to. */
export function layerOf(g: CalcGroup): Highlight {
  if (g.id === 'walls' || g.id === 'frame') return 'walls'
  if (g.id === 'beams') return 'beams'
  if (g.id === 'openings') return 'openings'
  if (g.id === 'textile') return 'textile'
  if (g.id === 'floor') return 'floor'
  if (g.id.startsWith('cat:')) return 'objects'
  return null
}

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
          <section key={g.id} className="cg" onMouseEnter={() => onHover(layerOf(g))}>
            <div className="cg-head">
              <span className="sq" style={DOT[g.id] ? { background: DOT[g.id], borderRadius: '50%' } : undefined} />
              <span className="name">{g.name}</span>
              <span className="num">
                {kr(g.sum)}
              </span>
            </div>
            {g.lines.map((l, i) => (
              <div key={l.artnr + l.name + i} className="cl">
                <span className="n">{l.name}</span>
                <span className="s">{kr(l.sum)}</span>
                <span className="meta">
                  {fmt(l.qty)} {l.unit} × {kr(l.price)}
                  {l.meta ? ` · ${l.meta}` : ''}
                  {l.preliminary && <span className="ph"> · foreløpig sats</span>}
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
        <Button variant="primary" icon={FileText} onClick={onQuote}>
          Åpne tilbud
        </Button>
      </div>
    </aside>
  )
}
