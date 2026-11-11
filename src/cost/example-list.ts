// Example supplier list with MADE-UP prices, so the cost engine runs and can be tested. Bjørn 7.11.2026: the real
// Foga list holds our purchase prices and must not be published (this repo and the site are open). The real list
// stays outside the repo and will come from the OMS. Only the parts the app builds with are here, by their real
// Foga art.nr; every price is invented. Broken pack is 30 % over full pack, as in Foga's lists.
import type { SupplierList, SupplierItem } from './prices';

type Row = [artnr: string, name: string, group: string, pack: number, unit: 'm' | 'stk', price: number];

const ROWS: Row[] = [
  ['873 062 22', 'Profil 94', 'Flex', 50, 'm', 100],
  ['873 042 22', 'Profil 91', 'Flex', 100, 'm', 50],
  ['873 043 22', 'Profil 91F', 'Flex', 50, 'm', 70],
  ['873 044 22', 'Profil 91FF', 'Flex', 50, 'm', 90],
  ['873 051 22', 'Profil 92', 'Flex', 100, 'm', 60],
  ['873 050 22', 'Profil 92L', 'Flex', 50, 'm', 70],
  ['873 060 22', 'Profil 93', 'Flex', 50, 'm', 80],
  ['873 001 22', 'Profil 01', 'Flex', 100, 'm', 30],
  ['873 040 22', 'Profil 90', 'Flex', 100, 'm', 40],
  ['873 080 22', 'Profil 292', 'Flex', 50, 'm', 120],
  ['873 805 22', 'Profil 43TX', 'Fabric', 50, 'm', 150],
  ['873 809 22', 'Profil 92LTX', 'Fabric', 50, 'm', 200],
  ['871 003 92', 'Coupling 600', 'Couplings', 100, 'stk', 25],
  ['871 031 92', 'Extension connector 604', 'Couplings', 100, 'stk', 20],
  ['871 037 92', 'Extension connector 609', 'Couplings', 100, 'stk', 25],
  ['871 045 92', 'In channel connector 617', 'Couplings', 100, 'stk', 30],
  ['876 520 22', 'Multi purpose fixing 520', 'Accessories', 100, 'stk', 15],
  ['876 503 95', 'Bevel nut M5 503', 'Accessories', 100, 'stk', 5],
  ['876 700 95', 'Insert 700 M10', 'Inserts', 100, 'stk', 5],
  ['896 232 95', 'Set screw M10x65', 'Set Screws', 20, 'stk', 5],
  ['876 730 92', 'Foot plate 730', 'Feets', 10, 'stk', 300],
  ['876 740 92', 'Foot plate 740', 'Feets', 10, 'stk', 400],
  ['876 750 93', 'Foot plate 750', 'Feets', 10, 'stk', 250],
  ['876 745 92', 'Pole for plate 795', 'Feets', 10, 'stk', 150],
];

export const EXAMPLE_LIST: SupplierList = {
  supplier: 'Foga System AB (eksempelpriser)',
  name: 'Eksempelliste, oppdiktede priser',
  date: '2022-06',
  currency: 'SEK',
  items: ROWS.map(([artnr, name, group, pack, unit, price]): SupplierItem => ({ artnr, name, group, pack, unit, price, broken: Math.round(price * 1.3 * 100) / 100 })),
};
