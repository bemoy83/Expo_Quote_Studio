// Panel tabs for equipment (furniture, counters, lighting …) and the product search: placed objects and counted items.
import { Paintbrush } from 'lucide-react'
import { useState } from 'react'
import { mainGroupOf, PRODUCT_GROUPS, resolveGroup } from '../../../catalog/groups'
import type { Product } from '../../../catalog/types'
import { setCounted } from '../../../domain/edit'
import { addObjectAnywhere, COUNTER_STOCK_RAL, removeObjects } from '../../../domain/objects'
import { addStockAnywhere } from '../../../domain/podiums'
import { isStock, soldAs, stockByArtnr } from '../../../domain/podiumStock'
import { shelvesOf } from '../../../domain/shelves/model'
import type { Variant } from '../../../domain/types'
import { Counter, IconButton } from '../../controls'
import { builtFunc, builtProduct } from '../../../catalog/podium'
import { withFunc } from '../../podiumPen'
import { catalog, place } from '../../env'
import { kr } from '../../format'
import { penOn, type Brush } from '../../tools'
import { ShelfIcon } from '../../plan/quick/parts'
import { ObjectThumb, ProductRow, VariantChips } from '../ProductRow'
import type { RailProps } from '../Rail'
import { variantTotals } from './variantTotals'

export function EquipSection(p: RailProps & { menu: string }) {
  const products = catalog.products.filter((x) => mainGroupOf(x.group) === p.menu && (x.kind === 'object' || x.kind === 'counted' || x.id === catalog.system.shelf))
  const subgroups = PRODUCT_GROUPS.find((g) => g.id === p.menu)?.subgroups ?? []
  const many = subgroups.length > 1
  return (
    <>
      {subgroups.map((sg) => {
        const list = products.filter((x) => resolveGroup(x.group).subgroup.id === sg.id)
        if (!list.length) return null
        return (
          <div key={sg.id}>
            {many && <div className="panel-sec eyebrow">{sg.name}</div>}
            {/* A function of a pen says what it is for (Bjørn 14.11.2026) */}
            {many && sg.does && <p className="panel-note">{sg.does}.</p>}
            {list.map((x) => (x.id === catalog.system.shelf ? <ShelfRow key={x.id} {...p} product={x} /> : <CatalogRow key={x.id} {...p} product={x} />))}
          </div>
        )
      })}
    </>
  )
}

export function SearchResults(p: RailProps & { q: string }) {
  const q = p.q.toLowerCase()
  const hits = catalog.products.filter(
    (x) => (x.kind === 'object' || x.kind === 'counted' || x.id === catalog.system.shelf) && !x.opening && (x.name.toLowerCase().includes(q) || x.variants.some((v) => v.artnr.toLowerCase().includes(q) || v.name.toLowerCase().includes(q))),
  )
  if (!hits.length) return <p className="panel-note">Ingen varer passer «{p.q}».</p>
  return (
    <>
      <div className="panel-head">
        <h2>Søk</h2>
        <span className="step">{hits.length} treff</span>
      </div>
      {hits.map((x) => (x.id === catalog.system.shelf ? <ShelfRow key={x.id} {...p} product={x} /> : <CatalogRow key={x.id} {...p} product={x} showGroup />))}
    </>
  )
}

/** Hylle 6311: drawn on a wall face with its own pen (plan/pointer/shelf.ts), so no counter; the count is what is drawn. */
function ShelfRow({ v, product, brush, tool, pick }: RailProps & { product: Product }) {
  const n = shelvesOf(v).length
  const cur = product.variants[0]
  const pen = penOn(tool, brush, 'shelf')
  return (
    <ProductRow
      on={n > 0}
      pen={pen}
      thumb={<ShelfIcon size={22} />}
      title={product.name}
      meta={
        <>
          <span className="num">
            {cur.artnr} · {kr(cur.price)} kr
          </span>
          {product.dim && <> · {product.dim}</>} · tegnes på vegg
        </>
      }
      result={n ? `${n} stk · ${kr(n * cur.price)} kr` : null}
      action={<IconButton icon={Paintbrush} label="Tegn hylle på en vegg" pressed={pen} onClick={() => pick({ kind: 'shelf' })} />}
    />
  )
}

/** A placed object (counter + brush) or a counted item (counter per variant). A standard counter (K22) is placed and
 *  drawn by Disker og podier, its preset chosen. */
function CatalogRow({ v, product, brush, tool, pick, picks, onEdit, onToast, showGroup }: RailProps & { product: Product; showGroup?: boolean }) {
  const [vi, setVi] = useState<number | null>(null)
  const isObject = product.kind === 'object'
  const counts = product.variants.map((x) =>
    isObject ? v.objects.filter((o) => soldAs(o) === x.artnr).length : (v.counted.find((c) => c.product === x.artnr)?.qty ?? 0),
  )
  const { tot, sum, first } = variantTotals(product, counts)
  const i = vi ?? first
  const cur = product.variants[i]
  const stock = isStock(cur.artnr)
  // A standard item is placed as the product its function builds on site, so a grip or shelf keeps its name (K13, K22)
  const podium = builtProduct(catalog.products, stockByArtnr(cur.artnr)?.func ?? 'disker')?.variants[0].artnr ?? cur.artnr
  /** A counter's pen keeps the colour Disker og podier last drew with (Byggeregel K6). */
  const ral = brush?.kind === 'podium' ? brush.ral : COUNTER_STOCK_RAL
  // A standard counter's pen puts it behind its function and in hand, the pen kept as it was (Fri's height, Fin) (K22)
  const kept = brush?.kind === 'podium' ? brush : { kind: 'podium' as const, product: podium, ral }
  // A product built on site puts its function in hand, with the item last fetched for it (K13)
  const func = product.podium ? builtFunc(catalog.products, cur.artnr) : undefined
  const penBrush = (): Brush =>
    stock ? { ...kept, product: podium, stock: cur.artnr } : func ? withFunc(kept, func, picks.podium ?? {}, catalog.products) : { kind: 'object', product: cur.artnr }
  // The pen in hand draws this row: the item behind the function in hand on a click (K22), the product built on site for
  // it on a drag (K13), else the product
  const inHand = brush?.kind === 'podium' && brush.stock ? stockByArtnr(brush.stock) : undefined
  const drawsThis = brush?.kind === 'podium' ? (stock ? inHand?.product === product.id : !!func && inHand?.func === func) : penOn(tool, brush, 'object', cur.artnr)
  const pen = isObject && tool !== 'select' && drawsThis
  const setCount = (n: number) => {
    if (!isObject) return onEdit((x) => setCounted(x, cur.artnr, n))
    const have = counts[i]
    if (n < have) return onEdit((x) => removeObjects(x, cur.artnr, have - n, soldAs))
    let next: Variant | null = v
    for (let k = have; k < n && next; k++) next = stock ? addStockAnywhere(next, place, podium, cur.artnr) : addObjectAnywhere(next, place, cur.artnr)
    if (next) onEdit(() => next!)
    else onToast(`Ikke plass til ${product.name.toLowerCase()} på standen`)
  }
  const groupName = showGroup ? resolveGroup(product.group).subgroup.name : null
  return (
    <ProductRow
      on={tot > 0}
      pen={pen}
      thumb={<ObjectThumb product={product} color={cur.color} />}
      title={product.name}
      meta={
        <>
          {product.variants.length > 1 && <>{cur.name} · </>}
          {groupName && <>{groupName} · </>}
          <span className="num">
            {cur.artnr} · {kr(cur.price)} kr
          </span>
          {product.dim && <> · {product.dim}</>}
          {isObject ? ' · tegnes' : product.unit === 't' ? ' · timer' : ' · plasseres senere'}
        </>
      }
      // Disker og podier is drawn, never counted in: each is priced from what it is built of (Byggeregel K13)
      result={tot && product.podium ? `${tot} tegnet` : tot ? `${product.variants.length > 1 ? `${tot} totalt · ` : ''}${kr(sum)} kr` : null}
      chips={<VariantChips chips={product.variants.map((x, k) => ({ name: x.name, color: x.color, count: counts[k] }))} selected={tot > 0 || vi !== null ? i : -1} onSelect={setVi} />}
      action={
        <>
          {!product.podium && <Counter value={counts[i]} onChange={setCount} label={`Legg til ${product.name.toLowerCase()}`} max={isObject ? 20 : 99} />}
          {isObject && <IconButton icon={Paintbrush} label={`Plasser ${product.name.toLowerCase()} i plan`} pressed={pen && tool === 'brush'} onClick={() => pick(penBrush())} />}
        </>
      }
    />
  )
}
