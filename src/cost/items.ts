// The price items of the kalkyle, costed by the engine: each item that has a recipe (Foga parts and own purchases,
// in the supplier's unit, plus its person-minutes) gets its direct cost from the kostgrunnlag and its price from the
// DG target of its group. Items without a recipe keep their example numbers. docs/kostmodell.md.
import { FOGA_PARTS, type PartKind } from '../foga/parts';
import { HANDLING_STEPS, type PriceItem, type PriceList } from '../pricing/model';
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
  /** Parts the kostgrunnlag has no price for: the item keeps its example numbers. */
  missing: string[];
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** The year the kostgrunnlag's numbers are for: cost is moved by the index from each list's date to this. */
export const basisYear = (b: CostBasis) => Number(b.date.slice(0, 4));

export function costItem(base: PriceItem, r: ItemRecipe, b: CostBasis): CostedItem {
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
  return { item: { ...base, cost: round2(cost), price: round2(priceAtDg(cost, p.dg[r.dg])) }, material, labour, missing };
}

/** The price list with every item that has a recipe costed from the kostgrunnlag. */
export function costItems(base: PriceList, recipes: Readonly<Record<string, ItemRecipe>>, b: CostBasis): PriceList {
  const out = new Map(base);
  for (const [id, r] of Object.entries(recipes)) {
    const it = base.get(id);
    if (it) out.set(id, costItem(it, r, b).item);
  }
  return out;
}
