import type { Catalog, ResolvedVariant } from './types';

export interface CatalogIndex {
  byArtnr: Map<string, ResolvedVariant>;
  plateByRal: Map<string, ResolvedVariant>;
}

const cache = new WeakMap<Catalog, CatalogIndex>();

export function indexCatalog(c: Catalog): CatalogIndex {
  const hit = cache.get(c);
  if (hit) return hit;
  const byArtnr = new Map<string, ResolvedVariant>();
  const plateByRal = new Map<string, ResolvedVariant>();
  for (const product of c.products) {
    for (const variant of product.variants) {
      byArtnr.set(variant.artnr, { product, variant });
      if (variant.ral) plateByRal.set(variant.ral, { product, variant });
    }
  }
  const idx = { byArtnr, plateByRal };
  cache.set(c, idx);
  return idx;
}

/** Display name of a variant: the product name, plus the variant name when it differs. */
export function displayName({ product, variant }: ResolvedVariant): string {
  return variant.name && variant.name !== product.name ? `${product.name} ${variant.name.toLowerCase()}` : product.name;
}
