// CSV for Excel in Norway: semicolon-separated, quoted where needed, with a BOM so it opens directly.

const cell = (x: string | number) => {
  const s = String(x);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsvText(rows: (string | number)[][]): string {
  return '\ufeff' + rows.map((r) => r.map(cell).join(';')).join('\n');
}
