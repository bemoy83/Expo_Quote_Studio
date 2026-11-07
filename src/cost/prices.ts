// Supplier price lists, kept exactly as the supplier prints them (currency, pack, full and broken pack price, date).
// The cost engine (model.ts) turns them into cost in NOK for the year asked for; nothing else reads the raw prices.
// Kostmodell: docs/kostmodell.md.
import { EXAMPLE_LIST } from './example-list';

export type Currency = 'NOK' | 'SEK';

export interface SupplierItem {
  /** As the supplier prints it: "87380522", "20.11.135". */
  artnr: string;
  name: string;
  /** Section of the list ("Fabric", "Couplings"). */
  group: string;
  /** Pack size, in `unit`. */
  pack: number;
  /** Profiles per metre, the rest per piece. */
  unit: 'm' | 'stk';
  /** Price per unit when buying whole packs. */
  price: number;
  /** Price per unit from a broken pack. */
  broken: number;
}

export interface SupplierList {
  supplier: string;
  name: string;
  /** When the prices were set, YYYY-MM. Indexing starts here. */
  date: string;
  currency: Currency;
  items: readonly SupplierItem[];
}

/** The Foga list in use: made-up example prices until the real list comes from the OMS (it is not published). */
export const FOGA: SupplierList = EXAMPLE_LIST;

/** "873 805 22" and "87380522" are the same article. */
export const normArtnr = (artnr: string) => artnr.replace(/\s+/g, '');

const byList = new WeakMap<SupplierList, Map<string, SupplierItem>>();

/** The list's item with this art.nr, or undefined. */
export function supplierItem(list: SupplierList, artnr: string): SupplierItem | undefined {
  let m = byList.get(list);
  if (!m) {
    m = new Map(list.items.map((x) => [normArtnr(x.artnr), x]));
    byList.set(list, m);
  }
  return m.get(normArtnr(artnr));
}
