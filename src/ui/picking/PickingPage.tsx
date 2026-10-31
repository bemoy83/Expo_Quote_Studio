// Plukkliste: what goes on the truck, by product. Foga parts come from the Foga engine (src/foga); loose goods
// (floor, furniture, counted items, doors and curtains) from the calc. Open Foga questions are shown, never guessed.
import { useMemo } from 'react'
import type { CalcResult } from '../../calc/calc'
import type { Variant } from '../../domain/types'
import { bom } from '../../foga/engine'
import { fromVariant } from '../../foga/fromVariant'
import { RECIPES } from '../../foga/recipes'
import { rules } from '../env'
import { count, fmt } from '../format'
import { PageBand } from '../shell/PageBand'
import { VariantTabs } from '../shell/VariantTabs'

interface Props {
  variants: Variant[]
  current: number
  onSelect: (i: number) => void
  calcOf: (v: Variant) => CalcResult
}

/** Calc groups that are loose goods, not built from Foga. */
const isLoose = (id: string) => id === 'floor' || id === 'openings' || id.startsWith('cat:')

export function PickingPage({ variants, current, onSelect, calcOf }: Props) {
  const v = variants[current]
  const B = useMemo(() => bom(fromVariant(v, rules), RECIPES), [v])
  const loose = calcOf(v).groups.filter((g) => isLoose(g.id))
  const n = (x: number) => fmt(x, 0)

  return (
    <>
      <PageBand title="Plukkliste" meta={`Variant ${v.name}`}>
        {variants.length > 1 && <VariantTabs variants={variants} current={current} onSelect={onSelect} />}
      </PageBand>
      <div className="page-scroll">
        <div className="page-cols">
          <div className="page-main">
            <p className="page-intro">Alt som skal plukkes til standen, delt etter produkt. Foga-delene regnes ut fra byggesystemet; det som ikke er avklart står som åpne spørsmål.</p>
            <div className="pick-grid tbl-head">
              <span>Art.nr</span>
              <span>Produkt</span>
              <span className="r">Antall</span>
            </div>

            <section className="tbl-sec">
              <div className="tbl-sec-head">
                <span>Foga · profiler</span>
                <span className="num">{B.profiles.length}</span>
              </div>
              {!B.profiles.length && <div className="tbl-empty">Ingen profiler som kan regnes ut ennå.</div>}
              {B.profiles.map((p) => (
                <div key={p.part.code} className="pick-grid tbl-row">
                  <span className="num muted">{p.part.artnr}</span>
                  <div className="cellstack">
                    <span className="title">
                      {p.part.code} · {p.part.name}
                    </span>
                    <span className="num meta">
                      {p.cuts.map((c) => `${c.qty} × ${n(c.lengthMm)}`).join(' · ')} <span className="faint">mm</span>
                    </span>
                  </div>
                  <span className="num r">{fmt(p.lm, 2)} lm</span>
                </div>
              ))}
            </section>

            <section className="tbl-sec">
              <div className="tbl-sec-head">
                <span>Foga · koblinger og beslag</span>
                <span className="num">{B.parts.length}</span>
              </div>
              {!B.parts.length && <div className="tbl-empty">Ingen koblinger som kan regnes ut ennå.</div>}
              {B.parts.map((p) => (
                <div key={p.part.code} className="pick-grid tbl-row">
                  <span className="num muted">{p.part.artnr}</span>
                  <div className="cellstack">
                    <span className="title">
                      {p.part.code} · {p.part.name}
                    </span>
                  </div>
                  <span className="num r">{p.qty} stk</span>
                </div>
              ))}
            </section>

            {loose.map((g) => (
              <section key={g.id} className="tbl-sec">
                <div className="tbl-sec-head">
                  <span>{g.name}</span>
                  <span className="num">{g.lines.length}</span>
                </div>
                {g.lines.map((l) => (
                  <div key={l.artnr + l.name} className="pick-grid tbl-row">
                    <span className="num muted">{l.artnr}</span>
                    <div className="cellstack">
                      <span className="title">{l.name}</span>
                    </div>
                    <span className="num r">
                      {fmt(l.qty, l.unit === 'stk' ? 0 : 1)} {l.unit}
                    </span>
                  </div>
                ))}
              </section>
            ))}
          </div>
          <aside className="page-side">
            <div className="side-head">
              <span>Åpne spørsmål om Foga</span>
            </div>
            {!B.open.length && <p className="side-note">Ingen. Alt i denne varianten kan regnes ut.</p>}
            {B.open.map((o) => (
              <div key={o.question} className="assume">
                <span>
                  <span className="name">
                    {o.no}. {o.text}
                  </span>
                  <span className="help">Gjelder {o.affects}</span>
                </span>
              </div>
            ))}
            <p className="side-note">
              Spørsmålene står også i docs/foga-system.md. {count(B.open.length, 'punkt', 'punkter')} venter på svar før plukklisten er komplett.
            </p>
          </aside>
        </div>
      </div>
    </>
  )
}
