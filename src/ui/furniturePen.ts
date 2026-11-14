// The pen of Møbel by use (Bjørn 14.11.2026), as Disker og podier and Vegg: one button per furniture set in the
// catalog (Møte, Lounge, Mingle; their kortnavn), and «Enkelt» for one piece, the piece last in hand behind it. Pure.
import { mainGroupOf } from '../catalog/groups'
import type { Product } from '../catalog/types'
import type { PenPicks } from './podiumPen'
import type { Brush } from './tools'

/** The furniture sets, in catalog order. */
export const penSets = (products: readonly Product[]): Product[] => products.filter((x) => x.set?.length)

/** The single pieces of furniture a pen places. */
export const singles = (products: readonly Product[]): Product[] =>
  products.filter((x) => x.kind === 'object' && !x.opening && !x.counter && !x.set && mainGroupOf(x.group) === 'mob')

const byArtnr = (products: readonly Product[], artnr: string | undefined) => (artnr ? products.find((x) => x.variants.some((v) => v.artnr === artnr)) : undefined)

/** The set in hand, if the pen holds one. */
export const setInHand = (b: Brush | null, products: readonly Product[]): Product | undefined =>
  b?.kind === 'object' ? byArtnr(products, b.product)?.set && byArtnr(products, b.product) : undefined

/** What the Møbel tool remembers: the single piece last in hand, behind «Enkelt». */
export const furniturePicksOf = (b: Brush, products: readonly Product[]): PenPicks | undefined =>
  b.kind === 'object' && !byArtnr(products, b.product)?.set && singles(products).some((x) => x.variants.some((v) => v.artnr === b.product)) ? { single: b.product } : undefined

/** The pen «Enkelt» puts in hand: the piece last in hand, else the first. */
export function singlePen(picks: PenPicks, products: readonly Product[]): Extract<Brush, { kind: 'object' }> {
  const last = picks.single && singles(products).some((x) => x.variants.some((v) => v.artnr === picks.single)) ? picks.single : undefined
  return { kind: 'object', product: last ?? singles(products)[0].variants[0].artnr }
}

/** What a set holds, for its name pill: «ståbord sort, rund og 2 × barkrakk sort». */
export function setContents(set: Product, products: readonly Product[]): string {
  const counts = new Map<string, number>()
  for (const x of set.set ?? []) counts.set(x.artnr, (counts.get(x.artnr) ?? 0) + 1)
  const parts = [...counts].map(([a, n]) => {
    const p = byArtnr(products, a)
    const v = p?.variants.find((x) => x.artnr === a)
    const name = (p && p.variants.length > 1 && v ? `${p.name} ${v.name}` : (p?.name ?? a)).toLowerCase()
    return n > 1 ? `${n} × ${name}` : name
  })
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} og ${parts[parts.length - 1]}` : (parts[0] ?? '')
}
