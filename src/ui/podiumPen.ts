// The pen of Disker og podier by function (Bjørn 14.11.2026): «Fri» draws its own shape, and one choice per subgroup of
// Disker og podier that has a standard counter (K22): «Disk», «Podie». Behind each function stands one item, the one
// last fetched from the catalog for it, at the start the catalog's first. The pen holds the item in hand as `stock`
// (its art.nr says function, product and height); `h` is Fri's own height, kept while a function is in hand. Pure, so
// the same pattern can later give «Ståbord» or «Barkrakker» on other tools.
import { PRODUCT_GROUPS } from '../catalog/groups';
import { builtProduct } from '../catalog/podium';
import type { Product } from '../catalog/types';
import { stockByArtnr, stockOf, stockSize, STOCK_COUNTERS, type StockCounter } from '../domain/podiumStock';
import { funcByShape, HEIGHT, HEIGHTS } from '../domain/podiums';
import type { Variant } from '../domain/types';
import type { Brush, PenPicks } from './tools';

type PodiumBrush = Extract<Brush, { kind: 'podium' }>;

/** A function on the quick picks: the subgroup's key (`disker`, `podier`), the product built on site in it (`built`, its
 *  art.nr) whose name is the function's name, and what it is for. */
export interface PenFunc {
  func: string;
  built: string;
  one: string;
  does: string;
}

/** The functions of Disker og podier, in catalog order: its subgroups with a product built on site and a standard item.
 *  Names come from the product list only (Bjørn 14.11.2026). */
export const penFuncs = (products: readonly Product[]): PenFunc[] =>
  (PRODUCT_GROUPS.find((g) => g.id === 'disk')?.subgroups ?? []).flatMap((s) => {
    const func = s.id.slice('disk.'.length);
    const p = builtProduct(products, func);
    return p && STOCK_COUNTERS.some((x) => x.func === func) ? [{ func, built: p.variants[0].artnr, one: p.name, does: s.does ?? '' }] : [];
  });


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

/** The pen with this function in hand (undefined: «Fri», with the height it had): what it draws is built as the
 *  function's product. With «Fri» the shape decides when it is stored (K13). */
export function withFunc(b: PodiumBrush, func: string | undefined, picks: PenPicks, products: readonly Product[]): PodiumBrush {
  if (!func) return { ...b, stock: undefined };
  const s = stockFor(func, picks, b.h);
  const built = builtProduct(products, func)?.variants[0].artnr ?? b.product;
  return s ? { ...b, product: built, stock: s.artnr } : b;
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

/** What «Fri» stored as new, built as the product of its function (K13): the standard item it is (K22), else its shape
 *  (a disk when no deeper than 500). A function in hand already draws its own product; a påbygg keeps its counter's. */
export function builtByShape(v: Variant, id: string, isNew: boolean, b: PodiumBrush, products: readonly Product[]): Variant {
  if (b.stock || !isNew) return v;
  return {
    ...v,
    objects: v.objects.map((o) => {
      if (o.id !== id || !o.sections) return o;
      const func = stockOf(o.sections)?.func ?? funcByShape(o.sections);
      const p = builtProduct(products, func);
      return p ? { ...o, product: p.variants[0].artnr } : o;
    }),
  };
}
