// The pen of Vegg by function (Bjørn 14.11.2026), as Disker og podier: Pensel is Vegg, Dør and Takdrager; the Dør
// button stands for the opening last put in hand (dør or forheng, picked under Tilpasset) and is named after it.
// Farge is the colour of the item in hand: the wall's plate, the door's leaf. A colour never puts the wall in hand.
// Pure, so the pill, the tool state and the tests read the same rules.
import { shortName } from '../catalog/lookup'
import type { Product } from '../catalog/types'
import type { PenPicks } from './podiumPen'
import type { Brush } from './tools'

export type WallPen = Extract<Brush, { kind: 'wall' | 'opening' | 'beam' }>

/** The openings in the catalog, doors first as listed. */
export const openingProducts = (products: readonly Product[]): Product[] => products.filter((x) => x.opening)

const openingOf = (products: readonly Product[], artnr: string | undefined) =>
  artnr ? products.find((x) => x.opening && x.variants.some((v) => v.artnr === artnr)) : undefined

/** What the wall tool remembers behind its Dør button: the opening last in hand and the door leaf's last colour. */
export const wallPicksOf = (b: Extract<Brush, { kind: 'opening' }>): PenPicks => ({ opening: b.product, ral: b.ral })

/** The pen the Dør button puts in hand: the opening last in hand, else the catalog's first, with its leaf colour. */
export function openingPen(picks: PenPicks, products: readonly Product[]): Extract<Brush, { kind: 'opening' }> {
  const p = openingOf(products, picks.opening) ?? openingProducts(products)[0]
  return { kind: 'opening', product: p.variants[0].artnr, ...(picks.ral ? { ral: picks.ral } : {}) }
}

/** The opening behind the Dør button: the one in hand, else the one it would put in hand. */
export function openingShown(b: Brush | null, picks: PenPicks, products: readonly Product[]): Product {
  return (b?.kind === 'opening' ? openingOf(products, b.product) : undefined) ?? openingOf(products, openingPen(picks, products).product)!
}

/** The Dør button's name: the kortnavn of the opening behind it, «Dør» or «Forheng». */
export const openingLabel = (b: Brush | null, picks: PenPicks, products: readonly Product[]): string => shortName(openingShown(b, picks, products))

/** Farge on the wall tool, for the item in hand: `none` when it never has a colour (Takdrager: hidden), `off` when the
 *  tool has colours but this item takes none now (Forheng, until its colours are known: grey), else the colour chosen. */
export function penColour(b: WallPen, products: readonly Product[], standRal: string): { kind: 'none' } | { kind: 'off' } | { kind: 'on'; ral: string } {
  if (b.kind === 'beam') return { kind: 'none' }
  if (b.kind === 'wall') return { kind: 'on', ral: b.ral }
  return openingOf(products, b.product)?.opening === 'door' ? { kind: 'on', ral: b.ral ?? standRal } : { kind: 'off' }
}

/** A colour picked on the pill: on the item in hand, never another pen. */
export function withColour(b: WallPen, ral: string): WallPen {
  if (b.kind === 'wall') return { kind: 'wall', ral }
  if (b.kind === 'opening') return { ...b, ral }
  return b
}

/** Dør or Forheng picked under Tilpasset: the opening in hand becomes it, keeping the leaf colour for when a door comes
 *  back. */
export const withOpening = (b: Extract<Brush, { kind: 'opening' }>, product: string): Extract<Brush, { kind: 'opening' }> => ({ ...b, product })
