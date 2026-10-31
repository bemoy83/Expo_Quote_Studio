// Produktliste: every product and variant with art.nr, name, unit and price. The calc takes prices and names
// from here. Built-in products take a new name, price and status; added products can be edited fully.
import { Check, Download, Plus, RotateCcw, Search, Trash2, Upload } from 'lucide-react'
import { Fragment, useRef, useState } from 'react'
import { addProduct, artnrFree, catalogRows, editRow, importTable, NO_EDITS, parsePrice, parseTable, removeProduct, toCSV, UNITS, type CatalogRow } from '../../catalog/edits'
import { groupItems, PRODUCT_GROUPS, resolveGroup } from '../../catalog/groups'
import type { Unit } from '../../catalog/types'
import { Button, CommitInput, IconButton, type ToastMsg } from '../controls'
import { download } from '../download'
import { catalog, edits, setCatalogEdits } from '../env'
import { fmt } from '../format'
import { PageBand } from '../shell/PageBand'

type Toast = (t: ToastMsg | string) => void

const priceText = (n: number) => fmt(n, 2)
const groupText = (id: string) => {
  const g = resolveGroup(id)
  return `${g.group.name} ${g.subgroup.name}`
}

export function CatalogPage({ onToast }: { onToast: Toast }) {
  const [q, setQ] = useState('')
  const [only, setOnly] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const rows = catalogRows(catalog, edits)
  const placeholders = rows.filter((r) => r.placeholder).length
  const shown = rows.filter((r) => {
    const s = q.trim().toLowerCase()
    return (!only || r.placeholder) && (!s || `${r.artnr} ${r.product} ${r.variant ?? ''} ${groupText(r.group)}`.toLowerCase().includes(s))
  })
  const groups = groupItems(shown, (r) => r.group)

  const update = (r: CatalogRow, patch: Parameters<typeof editRow>[2]) => setCatalogEdits(editRow(edits, r, patch))
  /** Apply new edits and offer Angre in the toast. */
  const withUndo = (next: typeof edits, text: string) => {
    const before = edits
    setCatalogEdits(next)
    onToast({ text, action: 'Angre', onAction: () => setCatalogEdits(before) })
  }

  const add = () => {
    const { edits: e, artnr } = addProduct(catalog, edits)
    setCatalogEdits(e)
    setQ('')
    setOnly(false)
    window.setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(`[data-row="${artnr}"] input[aria-label="Navn"]`)
      el?.focus()
      el?.select()
    }, 30)
  }

  const exportCsv = () => download(toCSV(rows), 'text/csv;charset=utf-8', 'produktliste.csv')

  const importFile = async (f: File) => {
    if (/\.xlsx?$/i.test(f.name)) return onToast('Lagre arket som CSV først (Fil → Lagre som → CSV)')
    const r = importTable(catalog, edits, parseTable(await f.text()))
    if ('error' in r) return onToast(r.error)
    const parts = [`${r.updated} oppdatert`, `${r.added} nye`, r.skipped ? `${r.skipped} hoppet over` : ''].filter(Boolean)
    withUndo(r.edits, `${f.name} · ${parts.join(' · ')}`)
  }

  const reset = () => withUndo(NO_EDITS, 'Produktlisten er tilbakestilt til eksempelprisene')

  return (
    <>
      <PageBand title="Produktliste" meta={`${rows.length} varer · ${placeholders ? `${placeholders} plassholderpriser` : 'alle priser bekreftet'}`}>
        <span className="band-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk varenr eller navn" aria-label="Søk i produktlisten" />
        </span>
        <Button onBand icon={Upload} onClick={() => file.current?.click()}>
          Importer
        </Button>
        <Button onBand icon={Download} onClick={exportCsv}>
          Eksporter
        </Button>
        <IconButton onBand icon={RotateCcw} label="Tilbakestill til eksempelpriser" onClick={reset} />
        <input
          ref={file}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void importFile(f)
          }}
        />
      </PageBand>
      <div className="page-scroll">
        <div className="page-narrow">
          <div className="cat-tools">
            <p className="page-intro">
              Kalkylen henter pris og navn herfra. Import leser CSV med kolonnene varenr og pris; navn, enhet og gruppe er valgfrie. Kjente varenr får ny pris, nye varenr legges til.
            </p>
            <button type="button" className="chip-toggle" aria-pressed={only} onClick={() => setOnly(!only)}>
              <i className="ph-dot" />
              Kun plassholdere <span className="num">{placeholders}</span>
            </button>
            <Button variant="primary" icon={Plus} onClick={add}>
              Legg til vare
            </Button>
          </div>
          <div className="cat-grid tbl-head">
            <span>Varenr</span>
            <span>Navn</span>
            <span>Enhet</span>
            <span className="r">Pris eks. mva.</span>
            <span>Status</span>
            <span />
          </div>
          {!groups.length && <div className="tbl-empty">Ingen varer matcher søket.</div>}
          {groups.map(({ group, subgroups }) => (
            <section key={group.id} className="tbl-sec">
              <div className="tbl-sec-head">
                <span>{group.name}</span>
                <span className="num">{subgroups.reduce((a, x) => a + x.items.length, 0)}</span>
              </div>
              {subgroups.map(({ subgroup, items: list }) => (
                <Fragment key={subgroup.id}>
                  {group.subgroups.length > 1 && <div className="tbl-sub-head">{subgroup.name}</div>}
                  {list.map((r) => (
                    <div key={r.artnr} data-row={r.artnr} className="cat-grid tbl-row cat-row">
                      {r.added ? (
                        <CommitInput
                          className="cin num"
                          value={r.artnr}
                          aria-label="Varenr"
                          onCommit={(text) => {
                            const x = text.trim()
                            if (x === r.artnr) return
                            if (artnrFree(catalog, x, r.artnr)) return update(r, { artnr: x })
                            onToast(x ? `Varenr ${x} finnes allerede` : 'Varenr kan ikke være tomt')
                            return false
                          }}
                        />
                      ) : (
                        <span className="num cell-ro">{r.artnr}</span>
                      )}
                      <div className="cellstack">
                        <span className="name-line">
                          {r.variant !== null && <span className="prefix">{r.product} ·</span>}
                          <CommitInput
                            className="cin"
                            value={r.variant ?? r.product}
                            aria-label="Navn"
                            onCommit={(text) => {
                              const x = text.trim()
                              if (!x) return false
                              if (x !== (r.variant ?? r.product)) update(r, r.variant !== null ? { variant: x } : { product: x })
                            }}
                          />
                        </span>
                        {r.added && (
                          <span className="row-opts">
                            <label>
                              Gruppe
                              <select value={r.group} aria-label="Gruppe" onChange={(e) => update(r, { group: e.target.value })}>
                                {PRODUCT_GROUPS.map((g) => (
                                  <optgroup key={g.id} label={g.name}>
                                    {g.subgroups.map((sg) => (
                                      <option key={sg.id} value={sg.id}>
                                        {sg.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </label>
                            <span className="faint">telles i panelet under {resolveGroup(r.group).group.name}</span>
                          </span>
                        )}
                      </div>
                      {r.added ? (
                        <select className="cin" value={r.unit} aria-label="Enhet" onChange={(e) => update(r, { unit: e.target.value as Unit })}>
                          {UNITS.map((u) => (
                            <option key={u}>{u}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="num cell-ro">{r.unit}</span>
                      )}
                      <span className="price-cell" title={r.sum ? 'Sum av artikler. Prisen her brukes bare hvis en artikkelpris mangler.' : undefined}>
                        {r.sum && <span className="faint">sum ·</span>}
                        <CommitInput
                          className="cin num"
                          inputMode="decimal"
                          value={priceText(r.price)}
                          aria-label="Pris"
                          selectOnFocus
                          onCommit={(text) => {
                            const x = parsePrice(text)
                            if (x === null || x === r.price) return false
                            update(r, { price: x, placeholder: false })
                          }}
                        />
                        <span className="faint num">kr</span>
                      </span>
                      <button
                        type="button"
                        className={'status' + (r.placeholder ? ' ph' : '')}
                        title={r.placeholder ? 'Marker som bekreftet' : 'Marker som plassholder'}
                        onClick={() => update(r, { placeholder: !r.placeholder })}
                      >
                        {r.placeholder ? <i className="ph-dot" /> : <Check size={14} />}
                        {r.placeholder ? 'Plassholder' : 'Bekreftet'}
                      </button>
                      {r.added ? (
                        <IconButton
                          icon={Trash2}
                          label="Fjern vare"
                          size={14}
                          onClick={() => withUndo(removeProduct(edits, r.artnr), `Fjernet ${r.product}`)}
                        />
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                </Fragment>
              ))}
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
