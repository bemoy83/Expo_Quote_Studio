// Edits to the product list (Produktliste), stored apart from the built-in catalog so code updates to the
// example catalog still come through. Pure: apply, list as rows, CSV export and import.
import { FALLBACK_SUBGROUP, isSubgroup, resolveGroup, subgroupByName } from './groups';
import type { Catalog, Product, ProductVariant, Unit } from './types';
import { toCsvText } from '../persistence/csv';

export interface VariantEdit {
  name?: string;
  price?: number;
  placeholder?: boolean;
}

export interface CatalogEdits {
  version: 1;
  /** Changes to built-in variants, by art.nr. */
  variants: Record<string, VariantEdit>;
  /** Products added by the user. Always counted, single variant. */
  added: Product[];
}

export const NO_EDITS: CatalogEdits = { version: 1, variants: {}, added: [] };

export const UNITS: Unit[] = ['stk', 'lm', 'm²', 't'];

/** The catalog with the edits applied. A single-variant product's name is the variant's name. */
export function applyEdits(base: Catalog, e: CatalogEdits): Catalog {
  const products = base.products.map((p): Product => {
    if (!p.variants.some((v) => e.variants[v.artnr])) return p;
    const variants = p.variants.map((v): ProductVariant => {
      const x = e.variants[v.artnr];
      if (!x) return v;
      return {
        ...v,
        ...(x.name !== undefined ? { name: x.name } : {}),
        ...(x.price !== undefined ? { price: x.price } : {}),
        ...(x.placeholder !== undefined ? { placeholder: x.placeholder } : {}),
      };
    });
    const single = p.variants.length === 1 ? e.variants[p.variants[0].artnr]?.name : undefined;
    return { ...p, ...(single !== undefined ? { name: single } : {}), variants };
  });
  // Added products saved before the shared grouping have no valid group: they go to the fallback
  const added = e.added.map((p) => (isSubgroup(p.group) ? p : { ...p, group: FALLBACK_SUBGROUP }));
  return { ...base, products: [...products, ...added] };
}

export interface CatalogRow {
  artnr: string;
  /** Product name; for products with several variants the variant name is separate. */
  product: string;
  variant: string | null;
  unit: Unit;
  /** Subgroup id (groups.ts). */
  group: string;
  price: number;
  placeholder: boolean;
  /** Added by the user: everything can be edited and the row can be removed. */
  added: boolean;
  kind: Product['kind'];
  /** Priced as the sum of its articles: the price here is only used when an article price is missing. */
  sum: boolean;
}

export function catalogRows(c: Catalog, e: CatalogEdits): CatalogRow[] {
  const added = new Set(e.added.map((p) => p.id));
  return c.products.flatMap((p) =>
    p.variants.map((v) => ({
      artnr: v.artnr,
      product: p.name,
      variant: p.variants.length > 1 ? v.name : null,
      unit: p.unit,
      group: p.group,
      price: v.price,
      placeholder: !!v.placeholder,
      added: added.has(p.id),
      kind: p.kind,
      sum: p.pricing === 'sum',
    })),
  );
}

/** Change a row. Built-in rows take name, price and status; added rows take everything. */
export function editRow(
  e: CatalogEdits,
  row: CatalogRow,
  patch: Partial<Pick<CatalogRow, 'artnr' | 'product' | 'variant' | 'unit' | 'group' | 'price' | 'placeholder'>>,
): CatalogEdits {
  if (row.added) {
    return {
      ...e,
      added: e.added.map((p) => {
        if (p.variants[0].artnr !== row.artnr) return p;
        const name = patch.product ?? p.name;
        const artnr = patch.artnr ?? p.variants[0].artnr;
        const variant = {
          ...p.variants[0],
          artnr,
          name,
          ...(patch.price !== undefined ? { price: patch.price } : {}),
          ...(patch.placeholder !== undefined ? { placeholder: patch.placeholder } : {}),
        };
        return { ...p, id: artnr, name, unit: patch.unit ?? p.unit, group: patch.group ?? p.group, variants: [variant] };
      }),
    };
  }
  const cur = e.variants[row.artnr] ?? {};
  const next: VariantEdit = { ...cur };
  const name = (row.variant !== null ? patch.variant : patch.product) ?? undefined;
  if (name !== undefined) next.name = name;
  if (patch.price !== undefined) next.price = patch.price;
  if (patch.placeholder !== undefined) next.placeholder = patch.placeholder;
  return { ...e, variants: { ...e.variants, [row.artnr]: next } };
}

/** A new counted product with a free art.nr (`ny1`, `ny2` …). */
export function addProduct(c: Catalog, e: CatalogEdits, fields: Partial<Product> & { price?: number; artnr?: string } = {}): { edits: CatalogEdits; artnr: string } {
  const taken = new Set(c.products.flatMap((p) => p.variants.map((v) => v.artnr)));
  let artnr = fields.artnr;
  if (!artnr || taken.has(artnr)) {
    let n = 1;
    while (taken.has(`ny${n}`)) n++;
    artnr = `ny${n}`;
  }
  const name = fields.name ?? 'Ny vare';
  const p: Product = {
    id: artnr,
    name,
    kind: 'counted',
    unit: fields.unit ?? 'stk',
    group: fields.group ?? FALLBACK_SUBGROUP,
    variants: [{ artnr, name, price: fields.price ?? 0, placeholder: fields.price === undefined }],
  };
  return { edits: { ...e, added: [...e.added, p] }, artnr };
}

export function removeProduct(e: CatalogEdits, artnr: string): CatalogEdits {
  return { ...e, added: e.added.filter((p) => p.variants[0].artnr !== artnr) };
}

/** Is the art.nr free for this row? */
export function artnrFree(c: Catalog, artnr: string, self: string): boolean {
  return !!artnr && (artnr === self || !c.products.some((p) => p.variants.some((v) => v.artnr === artnr)));
}

// ---- CSV ----

const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/** The product list as CSV (see toCsvText). */
export function toCSV(rows: CatalogRow[]): string {
  const out = [['Varenr', 'Navn', 'Enhet', 'Gruppe', 'Undergruppe', 'Pris', 'Status']];
  for (const r of rows) {
    const g = resolveGroup(r.group);
    out.push([r.artnr, r.variant ? `${r.product} ${r.variant}` : r.product, r.unit, g.group.name, g.subgroup.name, num(r.price), r.placeholder ? 'Plassholder' : 'Bekreftet']);
  }
  return toCsvText(out);
}

/** Parse CSV or TSV (separator ; , or tab, quotes allowed) into rows of cells. */
export function parseTable(text: string): string[][] {
  const t = text.replace(/^\ufeff/, '');
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = ['\t', ';', ','].map((s) => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const HEADERS: Record<string, string[]> = {
  artnr: ['varenr', 'artnr', 'art.nr', 'art.nr.', 'varenummer'],
  price: ['pris', 'price', 'pris eks. mva', 'pris eks mva'],
  name: ['navn', 'beskrivelse', 'name'],
  unit: ['enhet', 'unit'],
  group: ['undergruppe', 'gruppe', 'kategori', 'varegruppe', 'prisgruppe'],
};

export function parsePrice(s: string): number | null {
  const t = s.replace(/[\s\u00a0\u202f]/g, '').replace(/kr$/i, '').replace(',', '.');
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

/**
 * Import a table with a header row. Needs the columns varenr and pris; navn, enhet and undergruppe (or gruppe) are
 * optional. A group name that does not match the product grouping puts a new product under Tilbehør.
 * Known art.nr get the new price (and name) and are marked as confirmed; unknown ones are added.
 */
export function importTable(base: Catalog, e: CatalogEdits, table: string[][]): { edits: CatalogEdits; updated: number; added: number; skipped: number } | { error: string } {
  if (table.length < 2) return { error: 'Filen har ingen rader' };
  const head = table[0].map((h) => h.trim().toLowerCase());
  const col = (k: string) => head.findIndex((h) => HEADERS[k].includes(h));
  const ci = { artnr: col('artnr'), price: col('price'), name: col('name'), unit: col('unit') };
  // The most specific group column wins: undergruppe before gruppe before kategori
  const groupCols = HEADERS.group.map((h) => head.indexOf(h)).filter((i) => i >= 0);
  if (ci.artnr < 0 || ci.price < 0) return { error: 'Fant ikke kolonnene varenr og pris' };
  let edits = e;
  let updated = 0;
  let added = 0;
  let skipped = 0;
  for (const r of table.slice(1)) {
    const artnr = (r[ci.artnr] ?? '').trim();
    const price = parsePrice(r[ci.price] ?? '');
    if (!artnr || price === null) {
      skipped++;
      continue;
    }
    const name = ci.name >= 0 ? (r[ci.name] ?? '').trim() : '';
    const c = applyEdits(base, edits);
    const row = catalogRows(c, edits).find((x) => x.artnr === artnr);
    if (row) {
      edits = editRow(edits, row, { price, placeholder: false, ...(name && row.added ? { product: name } : {}) });
      updated++;
    } else {
      const unitRaw = ci.unit >= 0 ? (r[ci.unit] ?? '').trim() : '';
      const unit = (UNITS as string[]).includes(unitRaw) ? (unitRaw as Unit) : 'stk';
      const group = groupCols.map((i) => subgroupByName(r[i] ?? '')).find(Boolean) ?? FALLBACK_SUBGROUP;
      edits = addProduct(c, edits, { artnr, name: name || artnr, unit, group, price }).edits;
      added++;
    }
  }
  return { edits, updated, added, skipped };
}
