// Example list of what we buy outside Foga and own (plates, door leaves, curtains, hooks), with MADE-UP prices, so the
// cost engine runs. The real numbers come in the kostgrunnlag file (src/cost/basis.ts), never in the repo.
import type { SupplierItem, SupplierList } from './prices';

type Row = [artnr: string, name: string, group: string, unit: 'm' | 'stk', price: number];

const ROWS: Row[] = [
  ['HDF-976x2440', 'Lakkert HDF-plate 3 mm, 976 × 2440 mm', 'Plater', 'stk', 450],
  ['DOR-292-410', 'Dør med 292-ramme, hengsler 403 og lås 410, ferdig montert', 'Dører', 'stk', 2500],
  ['FORHENG', 'Forheng med glidere', 'Dører', 'stk', 900],
  ['KROK', 'Krok for takdrager', 'Takdrager', 'stk', 60],
];

export const OWN_SUPPLIER = 'Egne innkjøp';

export const EXAMPLE_OWN_LIST: SupplierList = {
  supplier: `${OWN_SUPPLIER} (eksempelpriser)`,
  name: 'Eksempelliste, oppdiktede priser',
  date: '2026-11',
  currency: 'NOK',
  items: ROWS.map(([artnr, name, group, unit, price]): SupplierItem => ({ artnr, name, group, pack: 1, unit, price, broken: price })),
};
