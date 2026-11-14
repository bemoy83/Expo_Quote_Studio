// The variants a placed piece of furniture can be swapped for (docs/pille-og-skuff.md, «Bytt variant på møbel»): the
// other variants of its product, and products in the same group with the same footprint and height (the catalog keeps a white
// and a black standing table as two products, not as two variants of one).
import { artnrName, catalog, idx } from './env'

export interface ObjectVariant {
  artnr: string
  name: string
  color?: string
}

export function objectFamily(artnr: string): ObjectVariant[] {
  const own = idx.byArtnr.get(artnr)
  // A counter of Disker og podier is what its sections are (K13, K22): its height or shape is changed in the drawer,
  // never by swapping product, so it has no family (Podie 50 × 50 in four heights showed as swatches)
  if (!own || own.product.counter) return []
  const f = own.product.footprint
  const same = (p: (typeof catalog.products)[number]) =>
    p === own.product || (!!f && !!p.footprint && p.kind === own.product.kind && p.group === own.product.group && p.footprint.w === f.w && p.footprint.d === f.d && p.footprint.h === f.h && !!p.footprint.round === !!f.round)
  return catalog.products.filter(same).flatMap((p) => p.variants.map((x) => ({ artnr: x.artnr, name: artnrName(x.artnr), color: x.color })))
}
