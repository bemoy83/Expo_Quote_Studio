import type { Product } from '../../../catalog/types'

/** How many there are of each variant of a product, all told and in kr, and the first variant in use (else the first). */
export function variantTotals(p: Product, counts: number[]) {
  return {
    tot: counts.reduce((a, b) => a + b, 0),
    sum: p.variants.reduce((a, x, i) => a + counts[i] * x.price, 0),
    first: Math.max(0, counts.findIndex((n) => n > 0)),
  }
}
