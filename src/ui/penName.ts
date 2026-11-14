// The head of every quick pill, «I hånden» (Bjørn 14.11.2026): the product the pen in hand draws, named from the product
// list as the calc and the quote name it, and one line under it: its price per unit, or what decides the item (the
// colour, the motif, the size). One place, so every tool's head reads the same.
import type { Motif } from '../domain/types'
import { stockByArtnr, stockSize } from '../domain/podiumStock'
import { HEIGHT } from '../domain/podiums'
import { artnrName, catalog, idx } from './env'
import { kr } from './format'
import { findMotif } from './motifs'
import type { Brush } from './tools'

export interface PenName {
  name: string
  meta?: string
}

/** «765 kr/lm», «150 kr/m²», «2 620 kr» for the art.nr. */
export function unitPrice(artnr: string): string | undefined {
  const r = idx.byArtnr.get(artnr)
  if (!r) return undefined
  return `${kr(r.variant.price)} kr${r.product.unit === 'stk' ? '' : `/${r.product.unit}`}`
}

/** Name and meta line of what the pen in hand draws. */
export function penName(b: Brush | null, motifs: Motif[]): PenName {
  if (!b) return { name: 'Pensel' }
  const motifName = (id: string | undefined) => (id ? (findMotif(motifs, id)?.name ?? 'Motiv') : undefined)
  switch (b.kind) {
    case 'wall': {
      const r = idx.wallByRal.get(b.ral)
      return { name: r ? artnrName(r.variant.artnr) : `RAL ${b.ral}`, meta: [`RAL ${b.ral}`, r && unitPrice(r.variant.artnr)].filter(Boolean).join(' · ') }
    }
    case 'beam':
      return { name: artnrName(catalog.system.beam), meta: unitPrice(catalog.system.beam) }
    case 'shelf':
      return { name: artnrName(catalog.system.shelf), meta: unitPrice(catalog.system.shelf) }
    // Profilering: the product of the pen in hand, and the graphics on it
    case 'textile':
      return { name: artnrName(catalog.system.textileFill.print), meta: motifName(b.motif) ?? 'uten motiv · vegg eller fritt' }
    case 'motif':
      return { name: artnrName(b.pen === 'print' ? catalog.system.foilFull : catalog.system.foil), meta: motifName(b.motif) }
    case 'podium': {
      // The item in hand and its size, or «Fri fasong» with what a click sets
      const s = b.stock ? stockByArtnr(b.stock) : undefined
      if (!s) return { name: 'Fri fasong', meta: `RAL ${b.ral} · høyde ${b.h ?? HEIGHT}` }
      const z = stockSize(s)
      return { name: artnrName(s.artnr), meta: `${kr(z.length)} × ${kr(z.depth)}` }
    }
    default: {
      const r = idx.byArtnr.get(b.product)
      if (r?.product.set) return { name: r.product.name, meta: `${r.product.set.length} deler · ${kr(r.variant.price)} kr` }
      return { name: artnrName(b.product), meta: unitPrice(b.product) }
    }
  }
}
