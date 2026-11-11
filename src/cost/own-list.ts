// Example list of what we buy outside Foga (plates, door leaves, curtains; printed textile bought for
// the job), with MADE-UP prices, so the
// cost engine runs. The real numbers come in the kostgrunnlag file (src/cost/basis.ts), never in the repo.
import type { SupplierItem, SupplierList } from './prices';

type Row = [artnr: string, name: string, group: string, unit: 'm' | 'm²' | 'stk', price: number];

const ROWS: Row[] = [
  ['HDF-976x2440', 'Lakkert HDF-plate 3 mm, 976 × 2440 mm', 'Plater', 'stk', 450],
  ['DOR-292-410', 'Dør med 292-ramme, hengsler 403 og lås 410, ferdig montert', 'Dører', 'stk', 2500],
  ['FORHENG', 'Forheng med glidere', 'Dører', 'stk', 900],
  // Shelf board, not from Foga (Bjørn 8.11.2026): placeholder until the supplier is chosen
  ['HYLLEPLATE-976x300', 'Hobbyplate melamin hvit 18 × 300 × 976 mm', 'Plater', 'stk', 120],
  // Corner boards (Bjørn 10.11.2026), cut from the same board: placeholders too
  ['HYLLEPLATE-960x300', 'Hjørne hylleplate, hobbyplate melamin hvit 18 × 300 × 960 mm', 'Plater', 'stk', 120],
  ['HYLLEPLATE-960x290', 'Hjørne hylleplate smal, hobbyplate melamin hvit 18 × 290 × 960 mm', 'Plater', 'stk', 120],
  ['HYLLEPLATE-655x300', '2/3 hylleplate, hobbyplate melamin hvit 18 × 300 × 655 mm', 'Plater', 'stk', 90],
  // Counter top and shelf (Bjørn 11.11.2026): placeholder until the real price is in the kostgrunnlag
  ['FIBRAPLAST6-976x476', 'MDF malingsmelamin Fibraplast H Barnizable hvit/hvit 6 × 476 × 976 mm', 'Plater', 'stk', 60],
  // Textile with silicone edge, per m² incl. bleed. Blackback is the default for print (Bjørn 7.11.2026); Samba goes in
  // front of LED, which the app does not draw yet
  ['TRYKK-BLACKBACK', 'Trykt tekstil Blackback med silikonkant', 'Tekstil', 'm²', 180],
  ['TRYKK-SAMBA', 'Trykt tekstil Samba med silikonkant', 'Tekstil', 'm²', 160],
  ['TEKSTIL-HVIT', 'Hvit tekstil med silikonkant', 'Tekstil', 'm²', 100],
];

export const OWN_SUPPLIER = 'Egne innkjøp';

export const EXAMPLE_OWN_LIST: SupplierList = {
  supplier: `${OWN_SUPPLIER} (eksempelpriser)`,
  name: 'Eksempelliste, oppdiktede priser',
  date: '2026-11',
  currency: 'NOK',
  items: ROWS.map(([artnr, name, group, unit, price]): SupplierItem => ({ artnr, name, group, pack: 1, unit, price, broken: price })),
};
