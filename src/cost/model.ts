// The cost engine: what a thing costs us directly, in NOK eks. mva., for the year asked for. Six kinds of direct cost,
// one rule each (docs/kostmodell.md):
//   1 Owned and rented out    (purchase / lifetime + purchase / 2 × interest) / uses per year + purchase × loss per use
//   2 Special cut             material in the cut length × (1 + waste) × (1 − reuse) + cutting time
//   3 Bought for the job      purchase × (1 + waste)
//   4 Labour                  person-minutes × hourly cost / 60, overtime surcharge on the wage part of its share
//   5 Per order               fixed, once per quote
//   6 Height                  lift per day, and montering minutes above the limit × factor
// Indirect cost (admin, premises, storage, vans) is one share of direct cost, its own line, never inside the rules.
// Price for what the engine prices: direct cost × (1 + indirect) / (1 − DG target) (src/cost/items.ts). Cost and price
// follow the same index, so DG holds when a discount is given. The app owns this engine; the OMS only hands over fixed
// per-piece prices (Bjørn 7.11.2026). Rules 2 and 6 are here and tested, not yet used by the calc.
import { FOGA_PARTS, type PartKind } from '../foga/parts';
import type { CostParams, IndexSeries } from './params';
import { FOGA, supplierItem, type SupplierList } from './prices';

/** Growth from the end of `from` to `to`: the product of every year's change after `from` up to and incl. `to`.
 *  A year missing from the series counts as no change. */
export function indexFactor(series: IndexSeries, from: number, to: number): number {
  let f = 1;
  for (let y = from + 1; y <= to; y++) f *= 1 + (series[y] ?? 0);
  for (let y = from; y > to; y--) f /= 1 + (series[y] ?? 0);
  return f;
}

const yearOf = (date: string) => Number(date.slice(0, 4));

/**
 * What one unit costs to buy today (`year`): the supplier's price (broken pack when asked), in NOK, moved by the
 * material index from the list's date, plus freight. Undefined when the list does not have the article.
 */
export function purchaseCost(list: SupplierList, artnr: string, year: number, p: CostParams, opts: { broken?: boolean } = {}): number | undefined {
  const it = supplierItem(list, artnr);
  if (!it) return undefined;
  const price = opts.broken ? it.broken : it.price;
  return price * p.rates[list.currency] * indexFactor(p.materialIndex, yearOf(list.date), year) * (1 + p.freightShare);
}

/** 1 Owned equipment, cost of one use: wear over the lifetime, interest on the average tied up, and what is lost on
 *  the job. */
export function ownedPerUse(purchase: number, kind: PartKind, p: CostParams): number {
  const o = p.owned;
  const g = o.groups[kind];
  return (purchase / g.lifetimeYears + (purchase / 2) * o.interest) / g.usesPerYear + purchase * o.lossPerUse;
}

/** 4 Labour: the hourly cost in `year`, before overtime. */
export function hourlyCost(year: number, p: CostParams): number {
  return (p.labour.baseRate * indexFactor(p.labourIndex, p.labour.baseYear, year)) / p.labour.billableShare;
}

/** 4 Labour: person-minutes (2 montører × 3 min = 6), with `overtime` the share of them that falls on overtime. The
 *  surcharge is paid on the wage, not on the social costs. */
export function labourCost(personMinutes: number, year: number, p: CostParams, overtime = 0): number {
  const l = p.labour;
  return (personMinutes / 60) * hourlyCost(year, p) * (1 + overtime * l.overtimeSurcharge * l.wageShare);
}

/** 2 A profile cut to a length outside the range: the cut piece, less what is expected to be used again, and the cut. */
export function specialCutCost(purchasePerM: number, lengthM: number, year: number, p: CostParams): number {
  const c = p.cut;
  return purchasePerM * lengthM * (1 + c.waste) * (1 - c.reuse) + labourCost(c.minutes, year, p);
}

/** 3 Bought for the job. */
export const boughtCost = (purchase: number, p: CostParams) => purchase * (1 + p.boughtWaste);

/** 5 Per order: fixed costs counted once per quote, each as kroner and/or person-minutes. */
export interface OrderCost {
  id: string;
  name: string;
  /** Kr at `baseYear`, moved by the material index. */
  cost?: number;
  baseYear?: number;
  personMinutes?: number;
  /** Only on an order that has this: `trykk` = printed textile. Else on every order. */
  when?: 'trykk';
}

export function orderCost(items: readonly OrderCost[], year: number, p: CostParams, overtime = 0): number {
  return items.reduce(
    (a, x) => a + (x.cost ?? 0) * indexFactor(p.materialIndex, x.baseYear ?? year, year) + labourCost(x.personMinutes ?? 0, year, p, overtime),
    0,
  );
}

/** 6 Height: montering minutes for what reaches above the limit take longer. */
export const heightMinutes = (minutes: number, topMm: number, p: CostParams) => (topMm > p.height.limit ? minutes * p.height.factor : minutes);

/** 6 Height: a lift is needed when anything reaches above the limit. */
export const needsLift = (topMm: number, p: CostParams) => topMm > p.height.limit;

/** Indirect cost on top of a direct cost: its own line in the kalkyle. */
export const indirectCost = (direct: number, p: CostParams) => direct * p.indirect;

/** The kalkyle for a price: DB and DG on direct cost, then indirect cost and what is left after it. */
export function margins(direct: number, price: number, p: CostParams) {
  const db = price - direct;
  const indirect = indirectCost(direct, p);
  return { direct, price, db, dg: price ? db / price : 0, indirect, afterIndirect: db - indirect };
}

/** Suggested price from direct cost and a DG target (0,6 = 60 %). */
export function priceAtDg(cost: number, dg: number): number {
  if (dg >= 1) throw new Error(`DG target must be below 100 %, got ${dg}`);
  return cost / (1 - dg);
}

/** Markup (300 % = 3) as the DG it gives. */
export const dgOfMarkup = (markup: number) => markup / (1 + markup);

/**
 * Cost of one use of a Foga part we own, per its unit in the list (m or stk), by Foga code ("43TX", "617"). Undefined
 * when the part is not in the list (92LL, the hook).
 */
export function fogaPartPerUse(code: string, year: number, p: CostParams, list: SupplierList = FOGA): number | undefined {
  const part = FOGA_PARTS.find((x) => x.code === code);
  if (!part) return undefined;
  const buy = purchaseCost(list, part.artnr, year, p);
  return buy === undefined ? undefined : ownedPerUse(buy, part.kind, p);
}
