// Price model, app side. The OMS owns the cost model (cost per part, depreciation, handling, target DG) and hands
// the app finished numbers: cost and price per unit. The app only sums what is actually drawn for a product priced
// as a sum of its articles, and shows the margin internally. Full model for the OMS: docs/prismodell.md.

/** Leie: comes back after the fair (frame, posts, furniture). Salg: the customer keeps it or it is used up (print, foil). */
export type Transfer = 'leie' | 'salg';

/**
 * How the sales price of a level 1 product is set.
 * - fast: the product's own price per unit (from the OMS).
 * - sum: the sum of the articles, parts and handling that are actually built for the line, each at its OMS price.
 */
export type Strategy = 'fast' | 'sum';

/**
 * A level 2 article, a level 3 part that is picked directly, or a handling item (montering on site), with finished
 * numbers from the OMS. Internal: never a line on the quote.
 */
export interface PriceItem {
  id: string;
  name: string;
  unit: 'stk' | 'm' | 'm²' | 'lm';
  /** Cost per unit, kr. */
  cost: number;
  /** Sales price per unit eks. mva., kr. */
  price: number;
  transfer?: Transfer;
  /** Montør hours per unit (handling and montering). */
  hours?: number;
}

export type PriceList = ReadonlyMap<string, PriceItem>;

export interface Use {
  id: string;
  qty: number;
}

export interface Summed {
  cost: number;
  price: number;
  hours: number;
  /** Leie, salg or both: both means the quote must say what is rented and what is bought. */
  transfer: Transfer | 'blandet' | null;
  /** Items not in the price list: the sum is incomplete. */
  missing: string[];
}

/** Sum of the items a line is built from. */
export function sumItems(uses: readonly Use[], list: PriceList): Summed {
  let cost = 0;
  let price = 0;
  let hours = 0;
  const transfers = new Set<Transfer>();
  const missing = new Set<string>();
  for (const u of uses) {
    if (u.qty <= 0) continue;
    const it = list.get(u.id);
    if (!it) {
      missing.add(u.id);
      continue;
    }
    cost += it.cost * u.qty;
    price += it.price * u.qty;
    hours += (it.hours ?? 0) * u.qty;
    if (it.transfer) transfers.add(it.transfer);
  }
  return {
    cost,
    price,
    hours,
    transfer: transfers.size === 2 ? 'blandet' : transfers.size === 1 ? [...transfers][0] : null,
    missing: [...missing],
  };
}

/** Dekningsgrad: (price − cost) / price. */
export const dgOf = (price: number, cost: number) => (price > 0 ? (price - cost) / price : 0);

/** The product's own numbers per unit (catalog variant, from the OMS). */
export interface Own {
  price: number;
  cost?: number;
}

export interface Priced {
  /** Price per unit, whole kroner. */
  price: number;
  /** Cost of the whole line, null when not known. */
  cost: number | null;
  /** The strategy actually used: a sum product whose items are not all priced falls back to its own price. */
  strategy: Strategy;
  dg: number | null;
  hours: number;
  transfer: Transfer | 'blandet' | null;
}

/**
 * Price one quote line.
 * - sum, with every item priced: unit price = sum of item prices / qty, rounded to whole kroner; cost = sum of item costs.
 * - otherwise the product's own price. Cost: the built items' cost when known (so a fast-priced wall still shows its
 *   real margin), else the product's own cost × qty, else unknown.
 */
export function priceLine(qty: number, strategy: Strategy, own: Own, uses: readonly Use[] | null, list: PriceList): Priced {
  const s = uses ? sumItems(uses, list) : null;
  const complete = s && !s.missing.length ? s : null;
  const useSum = strategy === 'sum' && complete !== null && qty > 0;
  const price = useSum ? Math.round(complete.price / qty) : own.price;
  const cost = complete ? complete.cost : own.cost !== undefined ? own.cost * qty : null;
  return {
    price,
    cost,
    strategy: useSum ? 'sum' : 'fast',
    dg: cost === null ? null : dgOf(price * qty, cost),
    hours: complete?.hours ?? 0,
    transfer: complete?.transfer ?? null,
  };
}
