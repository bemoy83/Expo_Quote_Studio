// The variants a placed piece of furniture can be swapped for (docs/pille-og-skuff.md, «Bytt variant på møbel»): the
// other variants of its product, and products in the same group with the same footprint (the catalog keeps a white
// and a black standing table as two products, not as two variants of one).
import { catalog, idx } from './env'

export interface ObjectVariant {
  artnr: string
  name: string
  color?: string
}

export function objectFamily(artnr: string): ObjectVariant[] {
  const own = idx.byArtnr.get(artnr)
  if (!own) return []
  const f = own.product.footprint
  const same = (p: (typeof catalog.products)[number]) =>
    p === own.product || (!!f && !!p.footprint && p.kind === own.product.kind && p.group === own.product.group && p.footprint.w === f.w && p.footprint.d === f.d && !!p.footprint.round === !!f.round)
  return catalog.products.filter(same).flatMap((p) => p.variants.map((x) => ({ artnr: x.artnr, name: p.variants.length > 1 ? `${p.name} ${x.name.toLowerCase()}` : p.name, color: x.color })))
}
