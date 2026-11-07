// What the calc prices with, from a kostgrunnlag: every price item (pricing/items.ts) costed by the cost engine from its
// recipe and minutes (src/cost/items.ts, docs/kostmodell.md), the order costs, and the cost and time of catalog products
// without a recipe. The item price is only used by sum-priced products (textile walls); catalog products keep their
// OMS price and use the cost. Change numbers in the kostgrunnlag, never in calc code.
import { EXAMPLE_BASIS, supplierList, type CatalogRates, type CostBasis } from '../cost/basis';
import { fingerprint } from '../cost/fingerprint';
import { basisYear, costItems, type MissingItem } from '../cost/items';
import { hourlyCost, orderCost } from '../cost/model';
import type { CarpetRates } from '../cost/params';
import { OWN_SUPPLIER } from '../cost/own-list';
import type { Product, ProductVariant } from '../catalog/types';
import { ITEM_DEFS } from './items';
import type { PriceList, Time } from './model';

export { ITEM } from './items';

export interface PricingData {
  items: PriceList;
  /** By product id, or by the quote key of lines the quote shows as one: what the quote tells the customer when it is
   *  part rental, part sale. */
  terms: Record<string, string>;
  /** Cost once per quote (kostgrunnlag `ordrekost`), in kr for the basis year: in the kalkyle's cost, not in a price. */
  orderCosts: readonly { id: string; name: string; cost: number; when?: 'trykk' }[];
  /** Fingerprint of everything the calc runs on: the kostgrunnlag as used (own numbers and example numbers alike) and
   *  the price items it gives. Shown beside the basis' version and kept on the quote (Bjørn 7.11.2026). */
  code: string;
  /** Price items the kostgrunnlag cannot cost (no recipe, or a part without price): left out of `items`. */
  missing: readonly MissingItem[];
  catalog: CatalogRates;
  /** Engangsteppe: the rates to rank fills by, the work at the montør's hourly cost for the basis year. */
  carpet: CarpetRates;
}

/** The price items with the costed ones from this kostgrunnlag. */
export function pricingFrom(b: CostBasis): PricingData {
  const { items, missing } = costItems(ITEM_DEFS, b);
  const orderCosts = b.orderCosts.map((o) => ({ id: o.id, name: o.name, cost: orderCost([o], basisYear(b), b.params), ...(o.when ? { when: o.when } : {}) }));
  // The lists the engine looks up, so an example list filling in for a missing one counts too
  const used = { date: b.date, params: b.params, orderCosts: b.orderCosts, lists: [supplierList(b, 'Foga'), supplierList(b, OWN_SUPPLIER)], items, missing, catalog: b.catalog, terms: DEFAULT_TERMS };
  const carpet = { ...b.params.carpet, hour: hourlyCost(basisYear(b), b.params) };
  return { ...DEFAULT_TERMS, items, orderCosts, missing, catalog: b.catalog, carpet, code: fingerprint(used) };
}

const DEFAULT_TERMS: Pick<PricingData, 'terms'> = {
  terms: { tekstil: 'Leie av ramme, kjøp av tekstil', '8040': 'Kjøp av tekstil, montering inkludert', '8041': 'Kjøp av tekstil, montering inkludert' },
};

/** Costed from the example kostgrunnlag. The calc's default, and what the fasit tests run on. */
export const DEFAULT_PRICING: PricingData = pricingFrom(EXAMPLE_BASIS);

const byPrefix = <T>(rates: Readonly<Record<string, T>>, group: string): T | undefined => Object.entries(rates).find(([g]) => group.startsWith(g))?.[1];

/** A catalog product's own cost and time per unit: its own where it has them (from the OMS), else the kostgrunnlag's
 *  rate for its group. Products priced as a sum or built as an article get theirs from the price items instead. */
export function catalogOwn(pricing: PricingData, product: Product, variant: ProductVariant): { cost?: number; time?: Time } {
  const rated = !product.pricing && !product.article;
  const share = rated ? byPrefix(pricing.catalog.cost, product.group) : undefined;
  const cost = variant.cost ?? (share === undefined ? undefined : Math.round(variant.price * share));
  const time = product.time ?? (rated ? byPrefix(pricing.catalog.time, product.group) : undefined);
  return { ...(cost !== undefined ? { cost } : {}), ...(time ? { time } : {}) };
}
