// The pen of Vegg by function (Bjørn 14.11.2026), as Disker og podier: Pensel is Vegg, Dør and Takdrager; the Dør
// button stands for the opening last put in hand (dør or forheng, picked under Tilpasset) and is named after it.
// Farge is the colour of the item in hand: the wall's plate, the door's leaf (RAL), the curtain's fabric (sort, grå,
// blå). A colour never puts the wall in hand.
// Pure, so the pill, the tool state and the tests read the same rules.
import { fabricOf, shortName } from '../catalog/lookup'
import type { Fabric, Product } from '../catalog/types'
import type { PenPicks } from './podiumPen'
import type { Brush } from './tools'

export type WallPen = Extract<Brush, { kind: 'wall' | 'opening' | 'beam' }>

/** The openings in the catalog, doors first as listed. */
export const openingProducts = (products: readonly Product[]): Product[] => products.filter((x) => x.opening)

const openingOf = (products: readonly Product[], artnr: string | undefined) =>
  artnr ? products.find((x) => x.opening && x.variants.some((v) => v.artnr === artnr)) : undefined

/** What the wall tool remembers behind its Dør button: the opening last in hand, the door leaf's and the curtain's last
 *  colour. */
export const wallPicksOf = (b: Extract<Brush, { kind: 'opening' }>): PenPicks => ({ opening: b.product, ral: b.ral, fabric: b.fabric })

/** The pen the Dør button puts in hand: the opening last in hand, else the catalog's first, with its leaf colour. */
export function openingPen(picks: PenPicks, products: readonly Product[]): Extract<Brush, { kind: 'opening' }> {
  const p = openingOf(products, picks.opening) ?? openingProducts(products)[0]
  return { kind: 'opening', product: p.variants[0].artnr, ...(picks.ral ? { ral: picks.ral } : {}), ...(picks.fabric ? { fabric: picks.fabric } : {}) }
}

/** The opening behind the Dør button: the one in hand, else the one it would put in hand. */
export function openingShown(b: Brush | null, picks: PenPicks, products: readonly Product[]): Product {
  return (b?.kind === 'opening' ? openingOf(products, b.product) : undefined) ?? openingOf(products, openingPen(picks, products).product)!
}

/** The Dør button's name: the kortnavn of the opening behind it, «Dør» or «Forheng». */
export const openingLabel = (b: Brush | null, picks: PenPicks, products: readonly Product[]): string => shortName(openingShown(b, picks, products))

export type PenColour = { kind: 'none' } | { kind: 'ral'; ral: string } | { kind: 'fabric'; fabrics: Fabric[]; fabric: string }

/** Farge on the wall tool, for the item in hand: `none` when it never has a colour (Takdrager: hidden), the wall
 *  colours (RAL) for a wall and a door leaf (the stand's when the pen has none), a curtain its fabrics. */
export function penColour(b: WallPen, products: readonly Product[], standRal: string): PenColour {
  if (b.kind === 'beam') return { kind: 'none' }
  if (b.kind === 'wall') return { kind: 'ral', ral: b.ral }
  const p = openingOf(products, b.product)
  if (p?.opening === 'door') return { kind: 'ral', ral: b.ral ?? standRal }
  const f = fabricOf(p, b.fabric)
  return p?.fabrics && f ? { kind: 'fabric', fabrics: p.fabrics, fabric: f.key } : { kind: 'none' }
}

/** A colour picked on the pill: on the item in hand, never another pen. `ral` for a wall or door leaf, else a fabric. */
export function withColour(b: WallPen, c: { ral: string } | { fabric: string }): WallPen {
  if (b.kind === 'wall') return 'ral' in c ? { kind: 'wall', ral: c.ral } : b
  if (b.kind === 'opening') return { ...b, ...c }
  return b
}

/** Dør or Forheng picked under Tilpasset: the opening in hand becomes it, keeping each one's colour for when it comes
 *  back. */
export const withOpening = (b: Extract<Brush, { kind: 'opening' }>, product: string): Extract<Brush, { kind: 'opening' }> => ({ ...b, product })
