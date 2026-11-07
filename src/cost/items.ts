// The price items of the kalkyle, costed by the engine: each item's recipe (Foga parts and own purchases, in the
// supplier's unit) and person-minutes come from the kostgrunnlag; it gets its direct cost from them and its price from
// the DG target of its group. An item without a recipe, or with a part the price lists do not have, gets no cost at
// all: it is listed as missing, never given a number to stand in. docs/kostmodell.md.
import { FOGA_PARTS, type PartKind } from '../foga/parts';
import type { ItemDef } from '../pricing/items';
import { HANDLING_STEPS, type PriceItem, type PriceList, type Time } from '../pricing/model';
import { supplierList, type CostBasis } from './basis';
import { boughtCost, labourCost, ownedPerUse, priceAtDg, purchaseCost } from './model';
import { OWN_SUPPLIER } from './own-list';
import type { DgGroup } from './params';

export interface ItemRecipe {
  /** Foga parts by code, in the list's unit: metres for profiles, pieces for the rest. Owned and rented out. */
  parts?: readonly (readonly [code: string, qty: number])[];
  /** Own purchases outside Foga by art.nr, with the group whose lifetime they have. Owned and rented out. */
  own?: readonly (readonly [artnr: string, qty: number, kind: PartKind])[];
  /** Bought for the job (printed textile), by art.nr in the own list, with waste on top. */
  bought?: readonly (readonly [artnr: string, qty: number])[];
  dg: DgGroup;
}

export interface CostedItem {
  item: PriceItem;
  /** Direct cost per unit split up: equipment and material, and work. */
  material: number;
  labour: number;
  /** Parts the kostgrunnlag has no price for: the item has no cost. */
  missing: string[];
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** The year the kostgrunnlag's numbers are for: cost is moved by the index from each list's date to this. */
export const basisYear = (b: CostBasis) => Number(b.date.slice(0, 4));

export function costItem(base: PriceItem, r: ItemRecipe, b: CostBasis): CostedItem {
  // `base` brings name, unit and time; cost and price are set here
  const year = basisYear(b);
  const p = b.params;
  const missing: string[] = [];
  let material = 0;
  for (const [code, qty] of r.parts ?? []) {
    const part = FOGA_PARTS.find((x) => x.code === code);
    const buy = part && purchaseCost(supplierList(b, 'Foga'), part.artnr, year, p);
    if (buy === undefined || !part) missing.push(code);
    else material += ownedPerUse(buy, part.kind, p) * qty;
  }
  for (const [artnr, qty, kind] of r.own ?? []) {
    const buy = purchaseCost(supplierList(b, OWN_SUPPLIER), artnr, year, p);
    if (buy === undefined) missing.push(artnr);
    else material += ownedPerUse(buy, kind, p) * qty;
  }
  for (const [artnr, qty] of r.bought ?? []) {
    const buy = purchaseCost(supplierList(b, OWN_SUPPLIER), artnr, year, p);
    if (buy === undefined) missing.push(artnr);
    else material += boughtCost(buy, p) * qty;
  }
  const minutes = HANDLING_STEPS.reduce((a, s) => a + (base.time?.[s] ?? 0), 0);
  const labour = labourCost(minutes, year, p);
  if (missing.length) return { item: base, material, labour, missing };
  const cost = material + labour;
  // The price carries the indirect cost on top (admin, premises, vans; Bjørn 7.11.2026: catalog = calculator + 10 %
  // administration), so the DG target is met after it. Only for what the engine prices: an OMS price is used as is.
  return { item: { ...base, cost: round2(cost), price: round2(priceAtDg(cost * (1 + p.indirect), p.dg[r.dg])) }, material, labour, missing };
}

/** A price item that could not be costed: no recipe, or parts the price lists lack. */
export interface MissingItem {
  id: string;
  name: string;
  /** Part codes or art.nr without a price; empty when the item has no recipe. */
  parts: string[];
}

/** Every price item costed from the kostgrunnlag. What cannot be costed is left out of the list, so a line that uses it
 *  is incomplete (pricing/model.ts `sumItems`), and named in `missing`. */
export function costItems(defs: readonly ItemDef[], b: CostBasis): { items: PriceList; missing: MissingItem[] } {
  const items = new Map<string, PriceItem>();
  const missing: MissingItem[] = [];
  for (const d of defs) {
    const r = b.recipes[d.id];
    const time: Time | undefined = b.times[d.id];
    if (!r) {
      missing.push({ id: d.id, name: d.name, parts: [] });
      continue;
    }
    const c = costItem({ ...d, cost: 0, price: 0, ...(time ? { time } : {}) }, r, b);
    if (c.missing.length) missing.push({ id: d.id, name: d.name, parts: c.missing });
    else items.set(d.id, c.item);
  }
  return { items, missing };
}
