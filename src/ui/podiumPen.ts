// The pen of Disker og podier by function (Bjørn 14.11.2026): «Fri» draws its own shape, and one choice per subgroup of
// Disker og podier that has a standard counter (K22): «Disk», «Podie». Behind each function stands one item, the one
// last fetched from the catalog for it, at the start the catalog's first. The pen holds the item in hand as `stock`
// (its art.nr says function, product and height); `h` is Fri's own height, kept while a function is in hand. Pure, so
// the same pattern can later give «Ståbord» or «Barkrakker» on other tools.
import { PRODUCT_GROUPS } from '../catalog/groups';
import { stockByArtnr, stockSize, STOCK_COUNTERS, type StockCounter } from '../domain/podiumStock';
import { HEIGHT, HEIGHTS } from '../domain/podiums';
import type { Brush } from './tools';

type PodiumBrush = Extract<Brush, { kind: 'podium' }>;

/** A function on the quick picks: the subgroup's key (`disker`, `podier`), its name as one and what it is for. */
export interface PenFunc {
  func: string;
  one: string;
  does: string;
}

/** The functions of Disker og podier, in catalog order: its subgroups that have a standard counter. */
export const PEN_FUNCS: readonly PenFunc[] = (PRODUCT_GROUPS.find((g) => g.id === 'disk')?.subgroups ?? []).flatMap((s) => {
  const func = s.id.slice('disk.'.length);
  return s.one && STOCK_COUNTERS.some((x) => x.func === func) ? [{ func, one: s.one, does: s.does ?? '' }] : [];
});

/** The item behind each function: the art.nr last fetched from the catalog for it. */
export type PenPicks = Partial<Record<string, string>>;

/** The function in hand, or undefined for «Fri». */
export const funcOf = (b: PodiumBrush): string | undefined => (b.stock ? stockByArtnr(b.stock)?.func : undefined);

/** The standard counter of this product in this height, if it has one (Podie 50 × 50 per height). */
const inHeight = (product: string, h: number): StockCounter | undefined => STOCK_COUNTERS.find((s) => s.product === product && stockSize(s).h === h);

/** The item a function puts in hand: the one last fetched for it, else the first of the function in Fri's height,
 *  else the first of the function. */
export function stockFor(func: string, picks: PenPicks, h = HEIGHT): StockCounter | undefined {
  const picked = picks[func] && stockByArtnr(picks[func]!);
  if (picked && picked.func === func) return picked;
  const first = STOCK_COUNTERS.find((s) => s.func === func);
  return (first && inHeight(first.product, h)) ?? first;
}

/** The pen with this function in hand (undefined: «Fri», with the height it had). */
export function withFunc(b: PodiumBrush, func: string | undefined, picks: PenPicks): PodiumBrush {
  if (!func) return { ...b, stock: undefined };
  const s = stockFor(func, picks, b.h);
  return s ? { ...b, stock: s.artnr } : b;
}

/** The heights on the pill and which of them applies: a standard counter has its own height, so only the heights its
 *  product comes in, and none when it comes in one only (Bardisk); «Fri» every height. `on` the height in hand. */
export function penHeights(b: PodiumBrush): { h: number; on: boolean; off: boolean }[] {
  const s = b.stock ? stockByArtnr(b.stock) : undefined;
  const at = s ? stockSize(s).h : (b.h ?? HEIGHT);
  const has = s && STOCK_COUNTERS.filter((x) => x.product === s.product).map((x) => stockSize(x).h);
  return HEIGHTS.map((h) => {
    const off = !!has && (has.length < 2 || !has.includes(h));
    return { h, on: !off && h === at, off };
  });
}

/** A height picked on the pill: with a function in hand it picks the item in that height, else Fri's height. */
export function withHeight(b: PodiumBrush, h: number): PodiumBrush {
  const s = b.stock ? stockByArtnr(b.stock) : undefined;
  if (!s) return { ...b, h };
  const t = inHeight(s.product, h);
  return t ? { ...b, stock: t.artnr } : b;
}

/** «Fin» (250 steps) applies to «Fri» only: a function places its item whole. */
export const fineApplies = (b: PodiumBrush): boolean => !b.stock;
