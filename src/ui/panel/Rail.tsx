import { Blinds, Box, Check, ChevronRight, DoorClosed, Eraser, PaintBucket, Paintbrush, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CalcResult } from '../../calc/calc'
import type { Product } from '../../catalog/types'
import { setCounted, setStand } from '../../domain/edit'
import { addObjectAnywhere, removeObjects } from '../../domain/objects'
import { addDefaultRoom } from '../../domain/rooms'
import type { StandType, Variant } from '../../domain/types'
import { fillFloor } from '../../domain/variant'
import { Counter, IconButton, Segmented } from '../controls'
import { catalog, place, wallPlates } from '../env'
import { fmt, kr } from '../format'
import type { Brush, Tool } from '../tools'
import { MENUS } from './menus'
import { ProductRow, Swatch, VariantChips } from './ProductRow'

export interface RailProps {
  v: Variant
  res: CalcResult
  tab: string
  setTab: (k: string) => void
  tool: Tool
  brush: Brush | null
  /** Choose what the brush draws, and switch to the brush (or eraser). */
  pick: (b: Brush, tool?: Tool) => void
  onEdit: (fn: (v: Variant) => Variant) => void
  onToast: (t: string) => void
}

const TYPE_TEXT: Record<StandType, string> = {
  row: 'Bare fronten er åpen. Lukkede sider får standvegg.',
  corner: 'Front og én side åpen. Lukkede sider får standvegg.',
  end: 'Tre sider åpne, standvegg bak.',
  island: 'Alle sider åpne. Ingen standvegg.',
}

export function Rail(p: RailProps) {
  const { v, res, tab, setTab } = p
  const [q, setQ] = useState('')
  const menu = MENUS.find((m) => m.key === tab) ?? MENUS[0]
  const counts = useMemo(() => menuCounts(v), [v])
  const done: Record<string, boolean> = {
    stand: true,
    vegg: res.keyFigures.topRails > 0 || v.stand.type === 'island',
    gulv: res.keyFigures.floorTotal > 0,
  }
  const step = MENUS.filter((m) => m.group === 'build').findIndex((m) => m.key === tab)
  const next = MENUS[MENUS.findIndex((m) => m.key === tab) + 1]

  return (
    <aside className="rail">
      <nav className="strip" aria-label="Produktgrupper">
        {(['build', 'equip'] as const).map((g) => (
          <div key={g} style={{ display: 'contents' }}>
            <span className="grp">{g === 'build' ? 'Bygg' : 'Utstyr'}</span>
            {MENUS.filter((m) => m.group === g).map((m) => (
              <button key={m.key} type="button" className="strip-btn" aria-current={m.key === tab} onClick={() => setTab(m.key)}>
                {done[m.key] && <Check size={11} className="check" />}
                {counts[m.key] ? <span className="count">{counts[m.key]}</span> : null}
                <m.icon size={18} />
                {m.short ?? m.name}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="panel">
        <div className="panel-scroll">
          <label className="search">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk vare eller varenr" aria-label="Søk vare eller varenr" />
          </label>
          {q.trim() ? (
            <SearchResults {...p} q={q.trim()} />
          ) : (
            <>
              <div className="panel-head">
                <h2>{menu.name}</h2>
                {step >= 0 && (
                  <span className="step">
                    Steg {step + 1} av 3{done[menu.key] ? ' · fullført' : ''}
                  </span>
                )}
              </div>
              {tab === 'stand' && <StandSection {...p} />}
              {tab === 'vegg' && <WallSection {...p} />}
              {tab === 'gulv' && <FloorSection {...p} />}
              {menu.group === 'equip' && <EquipSection {...p} menu={menu.key} />}
            </>
          )}
        </div>
        {next && (
          <div className="panel-foot">
            <span style={{ flex: 1 }}>Neste: {next.short ?? next.name}</span>
            <button type="button" className="btn ghost" onClick={() => setTab(next.key)}>
              <ChevronRight size={16} />
              Neste
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

function menuCounts(v: Variant): Record<string, number> {
  const out: Record<string, number> = {}
  const add = (artnr: string, n: number) => {
    const m = catalog.products.find((p) => p.variants.some((x) => x.artnr === artnr))?.menu
    if (m) out[m] = (out[m] ?? 0) + n
  }
  v.objects.forEach((o) => add(o.product, 1))
  v.counted.forEach((c) => add(c.product, c.qty))
  delete out.vegg
  delete out.gulv
  return out
}

function NumField({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <input
      className="field num"
      style={{ width: 64 }}
      aria-label={label}
      inputMode="numeric"
      defaultValue={value}
      key={value}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      onBlur={(e) => {
        const n = Math.round(Number(e.target.value.replace(',', '.')))
        if (Number.isFinite(n) && n >= 1 && n <= 40 && n !== value) onChange(n)
        else e.target.value = String(value)
      }}
    />
  )
}

function StandSection({ v, res, onEdit }: RailProps) {
  const s = v.stand
  const k = res.keyFigures
  return (
    <>
      <div className="opt">
        <span className="lbl">Bredde</span>
        <NumField label="Bredde i meter" value={s.width} onChange={(n) => onEdit((x) => setStand(x, { ...x.stand, width: n }))} />
        <span className="num" style={{ color: 'rgb(var(--ink-faint))', fontSize: 12 }}>
          m
        </span>
      </div>
      <div className="opt">
        <span className="lbl">Dybde</span>
        <NumField label="Dybde i meter" value={s.depth} onChange={(n) => onEdit((x) => setStand(x, { ...x.stand, depth: n }))} />
        <span className="num" style={{ color: 'rgb(var(--ink-faint))', fontSize: 12 }}>
          m
        </span>
      </div>
      <div className="panel-sec eyebrow">Standtype</div>
      <Segmented<StandType>
        inWell
        label="Standtype"
        value={s.type}
        onChange={(type) => onEdit((x) => setStand(x, { ...x.stand, type }))}
        options={[
          { value: 'row', label: 'Rekke' },
          { value: 'corner', label: 'Hjørne' },
          { value: 'end', label: 'Ende' },
          { value: 'island', label: 'Øy' },
        ]}
      />
      {s.type === 'corner' && (
        <div className="opt" style={{ borderTop: 0, marginTop: 4 }}>
          <span className="lbl">Åpen mot</span>
          <Segmented<'left' | 'right'>
            inWell
            label="Åpen side"
            value={s.cornerSide ?? 'right'}
            onChange={(cornerSide) => onEdit((x) => setStand(x, { ...x.stand, cornerSide }))}
            options={[
              { value: 'left', label: 'Venstre' },
              { value: 'right', label: 'Høyre' },
            ]}
          />
        </div>
      )}
      <p className="panel-note">{TYPE_TEXT[s.type]}</p>
      <div className="opt">
        <span className="lbl">
          Takdrager
          <small className="num">
            {fmt(k.beamLm)} m · {k.beamLengths} {k.beamLengths === 1 ? 'lengde' : 'lengder'} · {k.beamPosts} {k.beamPosts === 1 ? 'stolpe' : 'stolper'}
          </small>
        </span>
      </div>
      <p className="panel-note">
        80 × 20 mm langs åpne sider, i flukt med veggtopp. Lange drag deles jevnt i hele meter (maks 6 m) og skjøtes med stolpe og tverrdrager.
      </p>
    </>
  )
}

function WallSection({ v, res, brush, tool, pick, onEdit, onToast }: RailProps) {
  const plates = wallPlates()
  const di = Math.max(0, plates.findIndex((p) => p.ral === v.defaultPlate))
  const def = plates[di]
  const wallPen = tool !== 'select' && brush?.kind === 'wall'
  const nPlates = res.groups.find((g) => g.id === 'walls')?.lines.reduce((a, l) => a + l.qty, 0) ?? 0
  const openingCount = (a: string) => v.openings.filter((o) => o.product === a).length
  return (
    <>
      <div className="panel-sec eyebrow">Veggplater</div>
      <ProductRow
        on
        pen={wallPen}
        thumb={<Swatch color={def?.color} />}
        title="Veggplate 960 × 2420"
        meta={
          <>
            {def?.name} · <span className="num">RAL {def?.ral} · {kr(def?.price ?? 0)} kr/stk</span>
          </>
        }
        result={nPlates ? `${nPlates} plater` : null}
        action={<IconButton icon={Paintbrush} label="Tegn standvegg i plan" pressed={wallPen && tool === 'brush'} onClick={() => pick({ kind: 'wall', ral: v.defaultPlate })} />}
        chips={
          <VariantChips
            chips={plates.map((p) => ({ name: `${p.name} · RAL ${p.ral}`, color: p.color }))}
            selected={di}
            onSelect={(i) => {
              onEdit((x) => ({ ...x, defaultPlate: plates[i].ral! }))
              if (wallPen) pick({ kind: 'wall', ral: plates[i].ral! })
            }}
          />
        }
      />
      <p className="panel-note">Gjelder alle vegger. Velg en vegg i planen for å gi den egen farge.</p>

      <div className="panel-sec eyebrow">Bakrom</div>
      <ProductRow
        thumb={
          <svg viewBox="-1 -1 2 2" width="28" height="28" aria-hidden>
            <rect x="-.7" y="-.7" width="1.4" height="1.4" fill="rgb(var(--sunken))" />
            <path d="M-.7 .7 V-.7 H.7 V.7 H.25 M-.25 .7 H-.7" fill="none" stroke="var(--line-slate)" strokeWidth=".1" />
          </svg>
        }
        title="Bakrom"
        meta="Snarvei: fire vegger 1 × 1 med dør i et ledig hjørne. Dra en vegg i planen for å endre størrelsen."
        action={
          <IconButton
            icon={Box}
            label="Legg til bakrom"
            onClick={() => {
              const door = catalog.products.find((p) => p.opening === 'door')!.variants[0].artnr
              const next = addDefaultRoom(v, door)
              if (next) onEdit(() => next)
              else onToast('Ingen ledige hjørner til bakrom')
            }}
          />
        }
      />

      <div className="panel-sec eyebrow">Åpninger</div>
      {catalog.products
        .filter((p) => p.opening)
        .map((p) => {
          const a = p.variants[0].artnr
          const n = openingCount(a)
          const pen = tool !== 'select' && brush?.kind === 'opening' && brush.product === a
          const header = catalog.products.find((x) => x.variants.some((y) => y.artnr === catalog.system.header))?.variants[0].price ?? 0
          return (
            <ProductRow
              key={p.id}
              on={n > 0}
              pen={pen}
              thumb={p.opening === 'door' ? <DoorClosed size={16} /> : <Blinds size={16} />}
              title={p.name}
              meta={
                <>
                  <span className="num">{a}</span> · <span className="num">{kr(p.variants[0].price + header)} kr</span> inkl. overstykke · klikk en veggmodul
                </>
              }
              result={n ? `${n} stk` : null}
              action={<IconButton icon={Paintbrush} label={`Tegn ${p.name.toLowerCase()} i plan`} pressed={pen && tool === 'brush'} onClick={() => pick({ kind: 'opening', product: a })} />}
            />
          )
        })}
      <p className="panel-note">Åpninger kan stå på alle vegger, flere på samme vegg. Tøm gjør en åpning til vegg igjen.</p>
    </>
  )
}

function FloorSection({ v, res, brush, tool, pick, onEdit }: RailProps) {
  const [sel, setSel] = useState<Record<string, number>>({})
  const areas = res.keyFigures.floor
  const floors = catalog.products.filter((p) => p.menu === 'gulv' && p.kind === 'surface')
  const eraser = tool === 'erase' && brush?.kind === 'floor'
  const protection = catalog.products.find((p) => p.variants.some((x) => x.artnr === catalog.system.floorProtection))
  return (
    <>
      {floors.map((p) => {
        const active = tool === 'brush' && brush?.kind === 'floor' && p.variants.some((x) => x.artnr === brush.product)
        const counts = p.variants.map((x) => areas[x.artnr] ?? 0)
        const tot = counts.reduce((a, b) => a + b, 0)
        const vi = active ? p.variants.findIndex((x) => brush?.kind === 'floor' && x.artnr === brush.product) : (sel[p.id] ?? Math.max(0, counts.findIndex((n) => n > 0)))
        const cur = p.variants[vi] ?? p.variants[0]
        const sum = p.variants.reduce((a, x, i) => a + counts[i] * x.price, 0)
        return (
          <ProductRow
            key={p.id}
            on={tot > 0 || active}
            pen={active}
            thumb={<Swatch color={cur.color} pattern={p.id === 'flis' ? 'tiles' : p.name.startsWith('Vinyl') ? 'planks' : undefined} />}
            title={p.name}
            meta={
              <>
                {p.variants.length > 1 && <>{cur.name} · </>}
                <span className="num">
                  {cur.artnr} · {kr(cur.price)} kr/m²
                </span>
              </>
            }
            result={tot ? `${fmt(tot)} m² · ${kr(sum)} kr` : null}
            chips={
              <VariantChips
                chips={p.variants.map((x, i) => ({ name: x.name, color: x.color, count: counts[i] }))}
                selected={tot > 0 || active ? vi : -1}
                onSelect={(i) => {
                  setSel({ ...sel, [p.id]: i })
                  pick({ kind: 'floor', product: p.variants[i].artnr })
                }}
              />
            }
            action={
              <>
                <IconButton icon={PaintBucket} label={`Fyll hele standen med ${cur.name.toLowerCase()}`} onClick={() => onEdit((x) => fillFloor(x, cur.artnr))} />
                <IconButton icon={Paintbrush} label={`Tegn ${p.name.toLowerCase()} i plan`} pressed={active} onClick={() => pick({ kind: 'floor', product: cur.artnr })} />
              </>
            }
          />
        )
      })}
      <ProductRow
        pen={eraser}
        thumb={<Swatch />}
        title="Uten belegg"
        meta={`Hallgulv · ${fmt(res.keyFigures.area - res.keyFigures.floorTotal)} m² uten belegg`}
        action={
          <>
            <IconButton icon={Trash2} label="Fjern alt gulv" onClick={() => onEdit((x) => ({ ...x, floor: { ...x.floor, cells: {} } }))} />
            <IconButton
              icon={Eraser}
              label="Visk ut gulv i plan"
              pressed={eraser}
              onClick={() => pick({ kind: 'floor', product: brush?.kind === 'floor' ? brush.product : floors[0].variants[0].artnr }, 'erase')}
            />
          </>
        }
      />
      {res.keyFigures.floorTotal > 0 && protection && (
        <div className="opt">
          <span className="lbl">
            Monteringsplast
            <small>
              <span className="num">{protection.variants[0].artnr}</span> · 0,1 mm · {fmt(res.keyFigures.floorTotal)} m² · ved snekring eller maling
            </small>
          </span>
          <Segmented<boolean>
            inWell
            label="Monteringsplast"
            value={v.floor.protection}
            onChange={(on) => onEdit((x) => ({ ...x, floor: { ...x.floor, protection: on } }))}
            options={[
              { value: false, label: 'Av' },
              { value: true, label: 'På' },
            ]}
          />
        </div>
      )}
      <p className="panel-note">Fyll dekker hele standen. Penselen tegner valgt gulv i planen: 1 × 1 som standard, ned til 0,5 × 0,5. Flere gulvtyper kan stå på samme stand.</p>
    </>
  )
}

function EquipSection(p: RailProps & { menu: string }) {
  const products = catalog.products.filter((x) => x.menu === p.menu && (x.kind === 'object' || x.kind === 'counted'))
  const subgroups = [...new Set(products.map((x) => x.subgroup ?? ''))]
  return (
    <>
      {subgroups.map((sg) => (
        <div key={sg}>
          {sg && <div className="panel-sec eyebrow">{sg}</div>}
          {products
            .filter((x) => (x.subgroup ?? '') === sg)
            .map((x) => (
              <CatalogRow key={x.id} {...p} product={x} />
            ))}
        </div>
      ))}
    </>
  )
}

function SearchResults(p: RailProps & { q: string }) {
  const q = p.q.toLowerCase()
  const hits = catalog.products.filter(
    (x) => (x.kind === 'object' || x.kind === 'counted') && !x.opening && (x.name.toLowerCase().includes(q) || x.variants.some((v) => v.artnr.toLowerCase().includes(q) || v.name.toLowerCase().includes(q))),
  )
  if (!hits.length) return <p className="panel-note">Ingen varer passer «{p.q}».</p>
  return (
    <>
      <div className="panel-head">
        <h2>Søk</h2>
        <span className="step">{hits.length} treff</span>
      </div>
      {hits.map((x) => (
        <CatalogRow key={x.id} {...p} product={x} />
      ))}
    </>
  )
}

/** A placed object (counter + brush) or a counted item (counter per variant). */
function CatalogRow({ v, product, brush, tool, pick, onEdit, onToast }: RailProps & { product: Product }) {
  const [vi, setVi] = useState<number | null>(null)
  const isObject = product.kind === 'object'
  const counts = product.variants.map((x) =>
    isObject ? v.objects.filter((o) => o.product === x.artnr).length : (v.counted.find((c) => c.product === x.artnr)?.qty ?? 0),
  )
  const tot = counts.reduce((a, b) => a + b, 0)
  const i = vi ?? Math.max(0, counts.findIndex((n) => n > 0))
  const cur = product.variants[i]
  const sum = product.variants.reduce((a, x, k) => a + counts[k] * x.price, 0)
  const pen = isObject && tool !== 'select' && brush?.kind === 'object' && brush.product === cur.artnr
  const setCount = (n: number) => {
    if (!isObject) return onEdit((x) => setCounted(x, cur.artnr, n))
    const have = counts[i]
    if (n < have) return onEdit((x) => removeObjects(x, cur.artnr, have - n))
    let next: Variant | null = v
    for (let k = have; k < n && next; k++) next = addObjectAnywhere(next, place, cur.artnr)
    if (next) onEdit(() => next!)
    else onToast(`Ikke plass til ${product.name.toLowerCase()} på standen`)
  }
  const menuName = product.subgroup ? null : product.category
  return (
    <ProductRow
      on={tot > 0}
      pen={pen}
      thumb={<ObjectThumb product={product} color={cur.color} />}
      title={product.name}
      meta={
        <>
          {product.variants.length > 1 && <>{cur.name} · </>}
          {menuName && <>{menuName} · </>}
          <span className="num">
            {cur.artnr} · {kr(cur.price)} kr
          </span>
          {product.dim && <> · {product.dim}</>}
          {isObject ? ' · tegnes' : ' · plasseres senere'}
        </>
      }
      result={tot ? `${product.variants.length > 1 ? `${tot} totalt · ` : ''}${kr(sum)} kr` : null}
      chips={<VariantChips chips={product.variants.map((x, k) => ({ name: x.name, color: x.color, count: counts[k] }))} selected={tot > 0 || vi !== null ? i : -1} onSelect={setVi} />}
      action={
        <>
          <Counter value={counts[i]} onChange={setCount} label={`Legg til ${product.name.toLowerCase()}`} max={isObject ? 20 : 99} />
          {isObject && <IconButton icon={Paintbrush} label={`Plasser ${product.name.toLowerCase()} i plan`} pressed={pen && tool === 'brush'} onClick={() => pick({ kind: 'object', product: cur.artnr })} />}
        </>
      }
    />
  )
}

function ObjectThumb({ product, color }: { product: Product; color?: string }) {
  const f = product.footprint
  if (!f) {
    const m = MENUS.find((x) => x.key === product.menu)
    const I = m?.icon ?? Box
    return <I size={16} />
  }
  const s = 26 / Math.max(f.w, f.d, 0.5)
  const fill = color ?? (product.name.includes('hvit') ? 'oklch(0.96 0.003 90)' : 'oklch(0.24 0.004 250)')
  return (
    <svg width="30" height="30" viewBox="-15 -15 30 30" aria-hidden>
      {f.round ? <circle r={(f.w * s) / 2} fill={fill} stroke="rgb(var(--ink))" strokeWidth={0.6} /> : <rect x={(-f.w * s) / 2} y={(-f.d * s) / 2} width={f.w * s} height={f.d * s} rx={1.5} fill={fill} stroke="rgb(var(--ink))" strokeWidth={0.6} />}
    </svg>
  )
}

