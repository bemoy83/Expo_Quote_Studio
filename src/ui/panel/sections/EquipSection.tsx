// Panel tabs for equipment (furniture, counters, lighting …) and the product search: placed objects and counted items.
import { Paintbrush } from 'lucide-react'
import { useState } from 'react'
import { mainGroupOf, PRODUCT_GROUPS, resolveGroup } from '../../../catalog/groups'
import type { Product } from '../../../catalog/types'
import { setCounted } from '../../../domain/edit'
import { addObjectAnywhere, removeObjects } from '../../../domain/objects'
import type { Variant } from '../../../domain/types'
import { Counter, IconButton } from '../../controls'
import { catalog, place } from '../../env'
import { kr } from '../../format'
import { penOn } from '../../tools'
import { ObjectThumb, ProductRow, VariantChips } from '../ProductRow'
import type { RailProps } from '../Rail'
import { variantTotals } from './variantTotals'

export function EquipSection(p: RailProps & { menu: string }) {
  const products = catalog.products.filter((x) => mainGroupOf(x.group) === p.menu && (x.kind === 'object' || x.kind === 'counted'))
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
            {list.map((x) => (
              <CatalogRow key={x.id} {...p} product={x} />
            ))}
          </div>
        )
      })}
    </>
  )
}

export function SearchResults(p: RailProps & { q: string }) {
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
        <CatalogRow key={x.id} {...p} product={x} showGroup />
      ))}
    </>
  )
}

/** A placed object (counter + brush) or a counted item (counter per variant). */
function CatalogRow({ v, product, brush, tool, pick, onEdit, onToast, showGroup }: RailProps & { product: Product; showGroup?: boolean }) {
  const [vi, setVi] = useState<number | null>(null)
  const isObject = product.kind === 'object'
  const counts = product.variants.map((x) =>
    isObject ? v.objects.filter((o) => o.product === x.artnr).length : (v.counted.find((c) => c.product === x.artnr)?.qty ?? 0),
  )
  const { tot, sum, first } = variantTotals(product, counts)
  const i = vi ?? first
  const cur = product.variants[i]
  const pen = isObject && penOn(tool, brush, 'object', cur.artnr)
  const setCount = (n: number) => {
    if (!isObject) return onEdit((x) => setCounted(x, cur.artnr, n))
    const have = counts[i]
    if (n < have) return onEdit((x) => removeObjects(x, cur.artnr, have - n))
    let next: Variant | null = v
    for (let k = have; k < n && next; k++) next = addObjectAnywhere(next, place, cur.artnr)
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
