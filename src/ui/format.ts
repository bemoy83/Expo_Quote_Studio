// Norwegian number format: decimal comma, thin-space thousands, real minus.
// One formatter per number of decimals: toLocaleString with options builds a new one on every call, which showed up
// when the band, panel and calc are drawn again on each move of a drag.
const formats = new Map<number, Intl.NumberFormat>()
const numberFormat = (decimals: number) => {
  let f = formats.get(decimals)
  if (!f) formats.set(decimals, (f = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: decimals, minimumFractionDigits: 0 })))
  return f
}

export function fmt(n: number, decimals = 1): string {
  return numberFormat(decimals)
    .format(n)
    .replace(/\s/g, ' ')
    .replace('-', '−');
}

/** Minutes shown as hours with one decimal. */
export const hours = (min: number) => fmt(min / 60, 1);

export const kr = (n: number) => fmt(Math.round(n), 0);

export const signed = (n: number) => (n > 0 ? '+' : '') + kr(n);

/** Metres shown as whole millimetres. */
export const mm = (m: number) => fmt(m * 1000, 0);

/** Singular or plural word for a count: plural(1, 'plate', 'plater') → 'plate'. */
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Count with its noun: count(3, 'plate', 'plater') → '3 plater'. */
export const count = (n: number, one: string, many: string) => `${n} ${plural(n, one, many)}`;
