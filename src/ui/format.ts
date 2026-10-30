// Norwegian number format: decimal comma, thin-space thousands, real minus.
export function fmt(n: number, decimals = 1): string {
  return n
    .toLocaleString('nb-NO', { maximumFractionDigits: decimals, minimumFractionDigits: 0 })
    .replace(/\s/g, '\u202f')
    .replace('-', '−');
}

export const kr = (n: number) => fmt(Math.round(n), 0);

export const signed = (n: number) => (n > 0 ? '+' : '') + kr(n);
