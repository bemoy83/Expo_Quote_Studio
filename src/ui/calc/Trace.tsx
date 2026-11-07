// «Slik er det regnet»: a kalkyle line opened up. Every number comes from what the cost engine returned with the cost
// (PriceItem.trace, src/cost/items.ts), never from a text that describes it, so the explanation cannot drift from the
// sum. Where a number lives in the kostgrunnlag is named after it. docs/kostmodell.md.
import type { CalcLine } from '../../calc/types'
import type { TraceHow, TraceRow } from '../../cost/items'
import { catalogOwn } from '../../pricing/data'
import { fmt, kr } from '../format'
import { idx, pricing } from '../env'

const pct = (x: number) => `${fmt(x * 100, 1)} %`
const k2 = (x: number) => fmt(x, 2)
const DG_NAME = { utleie: 'utleie', arbeid: 'arbeid', salg: 'salg' } as const

function howText(h: TraceHow): string {
  if (h.kind === 'owned')
    return `innkjøp i dag ${k2(h.buy)} kr × ((1 / ${fmt(h.lifetimeYears)} år + rente ${pct(h.interest)} / 2) / ${fmt(h.usesPerYear)} bruk i året + tap ${pct(h.lossPerUse)})`
  if (h.kind === 'bought') return `innkjøp i dag ${k2(h.buy)} kr × (1 + svinn ${pct(h.waste)})`
  return `timekost ${k2(h.hourly)} kr/t (${k2(h.baseRate)} i ${h.baseYear}, lønnsindeks til ${h.year}) / 60`
}

function Row({ r }: { r: TraceRow }) {
  return (
    <div className="tr-row">
      <span className="n">{r.label}</span>
      <span className="s">{k2(r.sum)}</span>
      <span className="meta">
        {fmt(r.qty, 3)} {r.unit} × {k2(r.each)} kr · {howText(r.how)}
      </span>
      <span className="from">{r.from.join(' · ')}</span>
    </div>
  )
}

/** The explanation under a kalkyle line. */
export function LineTrace({ l }: { l: CalcLine }) {
  const uses = l.uses ?? []
  const hit = idx.byArtnr.get(l.artnr)
  const own = hit ? catalogOwn(pricing, hit.product, hit.variant) : {}
  const share = hit && own.cost !== undefined && hit.variant.cost === undefined && hit.variant.price ? own.cost / hit.variant.price : null
  return (
    <div className="trace">
      <div className="tr-head">Slik er det regnet</div>
      {uses.map((u) => {
        const it = pricing.items.get(u.id)
        const m = pricing.missing.find((x) => x.id === u.id)
        if (!it)
          return (
            <div key={u.id} className="tr-item">
              <span className="n">{m?.name ?? u.id}</span>
              <span className="meta ph">
                {fmt(u.qty, 2)} · uten kost: {m?.parts.length ? `mangler pris på ${m.parts.join(', ')}` : 'ingen oppskrift i kostgrunnlaget'}
              </span>
            </div>
          )
        const t = it.trace
        return (
          <div key={u.id} className="tr-item">
            <span className="n">{it.name}</span>
            <span className="s">{kr(it.cost * u.qty)}</span>
            <span className="meta">
              {fmt(u.qty, 2)} {it.unit} × kost {k2(it.cost)} kr
              {l.strategy === 'sum' ? ` · pris ${k2(it.price)} kr` : ''}
            </span>
            {t && (
              <>
                {t.rows.map((r) => (
                  <Row key={r.label + r.unit} r={r} />
                ))}
                {l.strategy === 'sum' && (
                  <span className="meta formula">
                    pris = {k2(t.direct)} × (1 + indirekte {pct(t.indirect)}) / (1 − DG-mål {DG_NAME[t.dgGroup]} {pct(t.dg)}) = {k2(t.price)} ·
                    parametere.indirect · parametere.dg.
                    {t.dgGroup}
                  </span>
                )}
              </>
            )}
          </div>
        )
      })}
      {!uses.length && l.cost !== null && (
        <div className="tr-item">
          <span className="meta">
            {share !== null
              ? `Kost = salgspris ${kr(hit!.variant.price)} × ${pct(share)} × ${fmt(l.qty, 2)} (katalog.kost, gruppe ${hit!.product.group})`
              : 'Kost fra produktet selv (OMS)'}
          </span>
        </div>
      )}
      <div className="tr-item">
        <span className="meta formula">
          {l.strategy === 'sum'
            ? `Pris = sum av artiklenes pris / ${fmt(l.qty, 2)} ${l.unit}, avrundet til hele kroner`
            : 'Pris = fast pris fra katalogen (OMS). Motoren gir bare kost, DG og tid.'}
          {l.cost !== null ? ` · DG = (${kr(l.sum)} − ${kr(l.cost)}) / ${kr(l.sum)}` : ''}
        </span>
      </div>
    </div>
  )
}
