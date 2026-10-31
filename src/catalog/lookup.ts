import type { PlaceContext } from '../domain/objects';
import type { Rules } from '../rules/rules';
import type { Catalog, ResolvedVariant } from './types';

export interface CatalogIndex {
  byArtnr: Map<string, ResolvedVariant>;
  /** The wall (level 1) in each RAL colour: what the brush draws and the quote sells. */
  wallByRal: Map<string, ResolvedVariant>;
}

const cache = new WeakMap<Catalog, CatalogIndex>();

export function indexCatalog(c: Catalog): CatalogIndex {
  const hit = cache.get(c);
  if (hit) return hit;
  const byArtnr = new Map<string, ResolvedVariant>();
  const wallByRal = new Map<string, ResolvedVariant>();
  for (const product of c.products) {
    for (const variant of product.variants) {
      byArtnr.set(variant.artnr, { product, variant });
      if (variant.ral && product.id === c.system.wall) wallByRal.set(variant.ral, { product, variant });
    }
  }
  const idx = { byArtnr, wallByRal };
  cache.set(c, idx);
  return idx;
}

/** Display name of a variant: the product name, plus the variant name when it differs. */
export function displayName({ product, variant }: ResolvedVariant): string {
  return variant.name && variant.name !== product.name ? `${product.name} ${variant.name.toLowerCase()}` : product.name;
}

/** Context for placing objects: footprints and which openings swing. */
export function placeContext(rules: Rules, c: Catalog): PlaceContext {
  const idx = indexCatalog(c);
  return {
    rules,
    footprint: (a) => idx.byArtnr.get(a)?.product.footprint,
    swings: (a) => idx.byArtnr.get(a)?.product.opening === 'door',
  };
}
