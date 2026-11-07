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
import { supplierItem } from './prices';
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

/** How one row of an item's cost came about, with the numbers that were used. */
export type TraceHow =
  /** Owned and rented out (rule 1): purchase today, lifetime, uses a year, interest, loss per use. */
  | { kind: 'owned'; buy: number; lifetimeYears: number; usesPerYear: number; interest: number; lossPerUse: number }
  /** Bought for the job (rule 3): purchase today and waste. */
  | { kind: 'bought'; buy: number; waste: number }
  /** Labour (rule 4): person-minutes at the hourly cost for the basis year. */
  | { kind: 'labour'; hourly: number; baseRate: number; baseYear: number; year: number };

/** One row of the explanation: `qty` × `each` = `sum`, per unit of the item. */
export interface TraceRow {
  label: string;
  qty: number;
  /** The unit of `qty`: m, stk, m², personmin. */
  unit: string;
  each: number;
  sum: number;
  how: TraceHow;
  /** Where the numbers are in the kostgrunnlag ("prisliste Foga 873 062 22", "parametere.owned.groups.profile",
   *  "oppskrifter.stolpe-94", "tider.stolpe-94"). */
  from: string[];
}

/** «Slik er det regnet» for a price item: produced by the same code that sets its cost and price. */
export interface ItemTrace {
  rows: TraceRow[];
  direct: number;
  indirect: number;
  dg: number;
  dgGroup: DgGroup;
  price: number;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** The year the kostgrunnlag's numbers are for: cost is moved by the index from each list's date to this. */
export const basisYear = (b: CostBasis) => Number(b.date.slice(0, 4));

/** Cost of one price item from its recipe and minutes, with the explanation of it. */
export function costItem(base: PriceItem, r: ItemRecipe, b: CostBasis): CostedItem {
  // `base` brings name, unit and time; cost and price are set here
  const year = basisYear(b);
  const p = b.params;
  const missing: string[] = [];
  const rows: TraceRow[] = [];
  const recipe = `oppskrifter.${base.id}`;
  const owned = (buy: number, kind: PartKind): TraceHow => {
    const g = p.owned.groups[kind];
    return { kind: 'owned', buy, lifetimeYears: g.lifetimeYears, usesPerYear: g.usesPerYear, interest: p.owned.interest, lossPerUse: p.owned.lossPerUse };
  };
  const ownedFrom = (kind: PartKind) => [`parametere.owned.groups.${kind}`, 'parametere.owned.interest', 'parametere.owned.lossPerUse', 'parametere.materialIndex'];
  const fogaList = supplierList(b, 'Foga');
  const ownList = supplierList(b, OWN_SUPPLIER);
  for (const [code, qty] of r.parts ?? []) {
    const part = FOGA_PARTS.find((x) => x.code === code);
    const buy = part && purchaseCost(fogaList, part.artnr, year, p);
    if (buy === undefined || !part) {
      missing.push(code);
      continue;
    }
    const each = ownedPerUse(buy, part.kind, p);
    rows.push({ label: `${part.name} (${code})`, qty, unit: part.kind === 'profile' || part.kind === 'frame' ? 'm' : 'stk', each, sum: each * qty, how: owned(buy, part.kind), from: [recipe, `prisliste ${fogaList.supplier} ${part.artnr}`, ...ownedFrom(part.kind)] });
  }
  for (const [artnr, qty, kind] of r.own ?? []) {
    const buy = purchaseCost(ownList, artnr, year, p);
    if (buy === undefined) {
      missing.push(artnr);
      continue;
    }
    const each = ownedPerUse(buy, kind, p);
    rows.push({ label: supplierItem(ownList, artnr)?.name || artnr, qty, unit: 'stk', each, sum: each * qty, how: owned(buy, kind), from: [recipe, `prisliste ${ownList.supplier} ${artnr}`, ...ownedFrom(kind)] });
  }
  for (const [artnr, qty] of r.bought ?? []) {
    const buy = purchaseCost(ownList, artnr, year, p);
    if (buy === undefined) {
      missing.push(artnr);
      continue;
    }
    const each = boughtCost(buy, p);
    rows.push({ label: supplierItem(ownList, artnr)?.name || artnr, qty, unit: base.unit, each, sum: each * qty, how: { kind: 'bought', buy, waste: p.boughtWaste }, from: [recipe, `prisliste ${ownList.supplier} ${artnr}`, 'parametere.boughtWaste', 'parametere.materialIndex'] });
  }
  const material = rows.reduce((a, x) => a + x.sum, 0);
  const minutes = HANDLING_STEPS.reduce((a, s) => a + (base.time?.[s] ?? 0), 0);
  const labour = labourCost(minutes, year, p);
  if (minutes > 0) {
    const hourly = labourCost(60, year, p);
    rows.push({ label: 'Arbeid', qty: minutes, unit: 'personmin', each: hourly / 60, sum: labour, how: { kind: 'labour', hourly, baseRate: p.labour.baseRate, baseYear: p.labour.baseYear, year }, from: [`tider.${base.id}`, 'parametere.labour', 'parametere.labourIndex'] });
  }
  if (missing.length) return { item: base, material, labour, missing };
  const cost = material + labour;
  // The price carries the indirect cost on top (admin, premises, vans; Bjørn 7.11.2026: catalog = calculator + 10 %
  // administration), so the DG target is met after it. Only for what the engine prices: an OMS price is used as is.
  const dg = p.dg[r.dg];
  const price = priceAtDg(cost * (1 + p.indirect), dg);
  const trace: ItemTrace = { rows, direct: cost, indirect: p.indirect, dg, dgGroup: r.dg, price };
  return { item: { ...base, cost: round2(cost), price: round2(price), trace }, material, labour, missing };
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
