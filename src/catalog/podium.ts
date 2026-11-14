// Disker og podier in the product list (Byggeregel K13, Bjørn 14.11.2026): one product built on site per function
// (subgroup of `disk`), which gives its name everywhere.
import type { Product } from './types';

/** The product of Disker og podier built on site for a function (`disker`, `podier`). */
export const builtProduct = (products: readonly Product[], func: string): Product | undefined => products.find((p) => p.podium && p.group === `disk.${func}`);

/** The function (`disker`, `podier`) a product of Disker og podier built on site serves. */
export const builtFunc = (products: readonly Product[], artnr: string): string | undefined => {
  const p = products.find((x) => x.podium && x.variants.some((v) => v.artnr === artnr));
  return p?.group?.startsWith('disk.') ? p.group.slice('disk.'.length) : undefined;
};
