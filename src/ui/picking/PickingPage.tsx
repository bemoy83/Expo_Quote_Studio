// Plukkliste: what goes on the truck, by product. Foga parts come from the Foga engine (src/foga); loose goods
// (floor, furniture, counted items, doors and curtains) from the calc. Rules behind it: docs/foga-system.md.
import { useMemo } from 'react'
import type { CalcResult } from '../../calc/calc'
import type { Variant } from '../../domain/types'
import { bom } from '../../foga/engine'
import { bomSizes, fromVariant } from '../../foga/fromVariant'
import { RECIPES } from '../../foga/recipes'
import { catalog, plateName, rules } from '../env'
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
  const B = useMemo(() => bom(fromVariant(v, rules), RECIPES, bomSizes(rules)), [v])
  // The header (overstykke) is built from Foga parts above, so it is not picked as a product
  const loose = calcOf(v)
    .groups.filter((g) => isLoose(g.id))
    .map((g) => ({ ...g, lines: g.lines.filter((l) => l.artnr !== catalog.system.header) }))
    .filter((g) => g.lines.length)
  const n = (x: number) => fmt(x, 0)
  const posts = B.units.reduce((a, u) => a + u.qty, 0)
  const pieces = B.profiles.reduce((a, p) => a + p.cuts.reduce((b, c) => b + c.qty, 0), 0)
  const lm = B.profiles.reduce((a, p) => a + p.lm, 0)
  const fittings = B.parts.reduce((a, p) => a + p.qty, 0)
  const plates = B.plates.reduce((a, p) => a + p.qty, 0)

  return (
    <>
      <PageBand title="Plukkliste" meta={`Variant ${v.name}`}>
        {variants.length > 1 && <VariantTabs variants={variants} current={current} onSelect={onSelect} />}
      </PageBand>
      <div className="page-scroll">
        <div className="page-cols">
          <div className="page-main">
            <p className="page-intro">Deleliste: hvor mange av hver profil, kobling og plate som skal med, og løsøre etter produkt. Profiler står som antall per kappelengde.</p>
            <div className="pick-grid tbl-head">
              <span>Art.nr</span>
              <span>Produkt</span>
              <span className="r">Antall</span>
            </div>

            <section className="tbl-sec">
              <div className="tbl-sec-head">
                <span>Foga · ferdigmontert</span>
                <span className="num">{B.units.length}</span>
              </div>
              {!B.units.length && <div className="tbl-empty">Ingen stolper.</div>}
              {B.units.map((u) => (
                <div key={u.name} className="pick-grid tbl-row">
                  <span className="num muted" />
                  <div className="cellstack">
                    <span className="title">{u.name}</span>
                    <span className="num meta">{u.contains}</span>
                  </div>
                  <span className="num r">{u.qty} stk</span>
                </div>
              ))}
            </section>

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
                      {p.cuts.map((c) => `${c.qty} × ${n(c.lengthMm)}`).join(' · ')} <span className="faint">mm · {fmt(p.lm, 2)} lm</span>
                    </span>
                  </div>
                  <span className="num r">{p.cuts.reduce((a, c) => a + c.qty, 0)} stk</span>
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

            <section className="tbl-sec">
              <div className="tbl-sec-head">
                <span>Veggplater</span>
                <span className="num">{B.plates.length}</span>
              </div>
              {!B.plates.length && <div className="tbl-empty">Ingen veggplater.</div>}
              {B.plates.map((p) => (
                <div key={`${p.ral}-${p.h}`} className="pick-grid tbl-row">
                  <span className="num muted">RAL {p.ral}</span>
                  <div className="cellstack">
                    <span className="title">
                      {p.part.name} · {plateName(p.ral)}
                    </span>
                    <span className="num meta">
                      {n(p.w)} × {n(p.h)} mm{p.h < RECIPES.wall.plate.h ? ' · overstykke' : ''}
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
              <span>Sum Foga</span>
            </div>
            <div className="formulas num">
              <div>{count(posts, 'stolpe', 'stolper')} med fot</div>
              <div>{count(pieces, 'profil', 'profiler')} · {fmt(lm, 1)} lm</div>
              <div>{count(fittings, 'kobling og beslag', 'koblinger og beslag')}</div>
              <div>{count(plates, 'plate', 'plater')}</div>
            </div>
            <p className="side-note">Byggesystemet og reglene bak listen står i docs/foga-system.md.</p>
          </aside>
        </div>
      </div>
    </>
  )
}
