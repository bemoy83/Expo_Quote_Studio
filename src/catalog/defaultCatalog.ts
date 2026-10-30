// Example catalog for the PoC. Art.nr and grouping are made up; prices are examples eks. mva. (F1, H6).
// Later this comes from the OMS export (Bærer, Art.nr, Beskrivelse, Pris).
import type { Catalog, Product, ProductKind, Unit } from './types';

const one = (
  id: string,
  name: string,
  kind: ProductKind,
  unit: Unit,
  category: string,
  price: number,
  extra: Partial<Product> = {},
): Product => ({ id, name, kind, unit, category, variants: [{ artnr: id, name, price, placeholder: true }], ...extra });

/** Counted product with optional named variants ("Sort;Hvit"). Art.nr gets a suffix per variant. */
const counted = (
  id: string,
  name: string,
  menu: string,
  category: string,
  subgroup: string,
  price: number,
  variants: string[] = [],
): Product => ({
  id,
  name,
  kind: 'counted',
  unit: 'stk',
  category,
  subgroup,
  menu,
  variants: variants.length
    ? variants.map((v, i) => ({ artnr: `${id}-${i + 1}`, name: v, price, placeholder: true }))
    : [{ artnr: id, name, price, placeholder: true }],
});

const PLATES: [ral: string, name: string, color: string][] = [
  ['9010', 'Hvit', '#F1EEE4'],
  ['7038', 'Lys grå', '#B5B8B1'],
  ['7012', 'Mørk grå', '#4E5754'],
  ['9005', 'Sort', '#141416'],
  ['5012', 'Lys blå', '#3B83BD'],
  ['5007', 'Mørk blå', '#3E5F8A'],
  ['3002', 'Rød', '#9B2423'],
];

const products: Product[] = [
  // Standsystem
  {
    id: '6120',
    name: 'Veggplate',
    kind: 'surface',
    unit: 'stk',
    category: 'Standvegger',
    menu: 'vegg',
    dim: '960 × 2420 mm',
    variants: PLATES.map(([ral, name, color]) => ({ artnr: `6120-${ral}`, name, ral, color, price: 330, placeholder: true })),
  },
  one('6101', 'Stolpe 40 × 40 mm, 2,5 m', 'system', 'stk', 'Stolper og profiler', 180),
  one('6102', 'Toppprofil 960 × 40 mm', 'system', 'stk', 'Stolper og profiler', 95),
  one('6103', 'Bunnprofil 960 × 30 mm', 'system', 'stk', 'Stolper og profiler', 85),
  one('6110', 'Takdrager 80 × 20 mm', 'system', 'lm', 'Takdrager', 240),
  // Openings
  one('6130', 'Dør med lås', 'object', 'stk', 'Dører og forheng', 2400, { menu: 'vegg' }),
  one('6131', 'Forheng', 'object', 'stk', 'Dører og forheng', 650, { menu: 'vegg', dim: 'i åpning 960 mm' }),
  one('6132', 'Overstykke over åpning', 'system', 'stk', 'Dører og forheng', 220),
  // Textile and foil
  one('8010', 'Aluminiumsramme 40 mm', 'system', 'lm', 'Tekstilvegger', 310),
  one('8011', 'Trykt tekstil', 'system', 'm²', 'Tekstilvegger', 380),
  one('8020', 'Foliedekor, dekal', 'system', 'm²', 'Profilering', 520),
  one('8021', 'Foliedekor, helt veggfelt 960 × 2420 mm', 'system', 'm²', 'Profilering', 520),
  // Floor
  {
    id: 'flis',
    name: 'Teppefliser 50 × 50',
    kind: 'surface',
    unit: 'm²',
    category: 'Gulv',
    menu: 'gulv',
    variants: [
      ['5902', 'Grå', '#A9ACAF'],
      ['5903', 'Mørk grå', '#6E7276'],
      ['5904', 'Antrasitt', '#3A3D40'],
      ['5901', 'Blå', '#2E5A9B'],
      ['5900', 'Rød', '#A8352F'],
      ['5905', 'Grønn', '#3F7F57'],
    ].map(([artnr, name, color]) => ({ artnr, name, color, price: 150, placeholder: true })),
  },
  {
    id: 'eng',
    name: 'Engangsteppe',
    kind: 'surface',
    unit: 'm²',
    category: 'Gulv',
    menu: 'gulv',
    variants: [
      ['5920', 'Grå', '#A3A6A9'],
      ['5921', 'Sort', '#2B2D2F'],
      ['5922', 'Rød', '#A9322B'],
    ].map(([artnr, name, color]) => ({ artnr, name, color, price: 95, placeholder: true })),
  },
  {
    id: '5930',
    name: 'Vinylgulv',
    kind: 'surface',
    unit: 'm²',
    category: 'Gulv',
    menu: 'gulv',
    variants: [{ artnr: '5930', name: 'Eik', color: '#C2A27A', price: 240, placeholder: true }],
  },
  one('5911', 'Monteringsbeskyttelse 0,1 mm', 'system', 'm²', 'Gulv', 30),
  // Placed furniture
  one('5276', 'Ståbord sort, rund', 'object', 'stk', 'Møbler', 500, {
    menu: 'mob', subgroup: 'Bord', dim: 'ø 70 · h 111', footprint: { w: 0.7, d: 0.7, h: 1.11, round: true },
  }),
  one('5275', 'Ståbord hvit, rund', 'object', 'stk', 'Møbler', 500, {
    menu: 'mob', subgroup: 'Bord', dim: 'ø 70 · h 111', footprint: { w: 0.7, d: 0.7, h: 1.11, round: true },
  }),
  one('5296', 'Ståbord sort, 70 × 70', 'object', 'stk', 'Møbler', 550, {
    menu: 'mob', subgroup: 'Bord', dim: '70 × 70 · h 111', footprint: { w: 0.7, d: 0.7, h: 1.11 },
  }),
  one('5186', 'Barkrakk sort', 'object', 'stk', 'Møbler', 350, {
    menu: 'mob', subgroup: 'Sittemøbler', dim: 'sittehøyde 80', footprint: { w: 0.4, d: 0.4, h: 0.8, round: true },
  }),
  one('5196', 'Barstol sort/krom', 'object', 'stk', 'Møbler', 350, {
    menu: 'mob', subgroup: 'Sittemøbler', dim: 'justerbar 58–78', footprint: { w: 0.42, d: 0.42, h: 0.78, round: true },
  }),
  one('5195', 'Barstol hvit/krom', 'object', 'stk', 'Møbler', 350, {
    menu: 'mob', subgroup: 'Sittemøbler', dim: 'justerbar 58–78', footprint: { w: 0.42, d: 0.42, h: 0.78, round: true },
  }),
  // Counted (placed later)
  counted('5190', 'Konferansestol', 'mob', 'Møbler', 'Sittemøbler', 220, ['Sort', 'Hvit', 'Grå']),
  counted('5210', 'Sofa 2-seter', 'mob', 'Møbler', 'Sittemøbler', 1450, ['Grå', 'Sort']),
  counted('5280', 'Møtebord 120 × 80', 'mob', 'Møbler', 'Bord', 690),
  counted('5285', 'Kafébord ø70', 'mob', 'Møbler', 'Bord', 450),
  counted('5300', 'Loungegruppe', 'mob', 'Møbler', 'Møbelgrupper', 3900),
  counted('5410', 'Disk 100, lav', 'disk', 'Disker og podier', 'Disker', 1350),
  counted('5415', 'Disk 100, høy med lås', 'disk', 'Disker og podier', 'Disker', 1890),
  counted('5420', 'Bardisk, buet', 'disk', 'Disker og podier', 'Disker', 2950),
  counted('5450', 'Podie 50 × 50', 'disk', 'Disker og podier', 'Podier', 380, ['50 cm', '75 cm', '100 cm']),
  counted('6180', 'Hylle 1 m', 'hyll', 'Hyller og heng', 'Hyller', 290, ['Rett', 'Skrå']),
  counted('6185', 'Kleskrok, 5 kroker', 'hyll', 'Hyller og heng', 'Heng', 160),
  counted('6186', 'Klesstativ', 'hyll', 'Hyller og heng', 'Heng', 340),
  counted('6190', 'Låsbart skap', 'hyll', 'Hyller og heng', 'Skap', 1100),
  counted('7010', 'Strømuttak 230 V, 2 kW', 'lys', 'Strøm og lys', 'Strøm', 1250),
  counted('7015', 'Strømuttak 3-faset 16 A', 'lys', 'Strøm og lys', 'Strøm', 2900),
  counted('7020', 'Grenuttak 6-veis', 'lys', 'Strøm og lys', 'Strøm', 120),
  counted('7100', 'LED-spot på takdrager', 'lys', 'Strøm og lys', 'Lys og oppheng', 390),
  counted('7110', 'Strømskinne 1 m', 'lys', 'Strøm og lys', 'Lys og oppheng', 450),
  counted('7120', 'Vegglampe på arm', 'lys', 'Strøm og lys', 'Lys og oppheng', 340),
  counted('7510', 'Skjerm 55"', 'av', 'Lyd og bilde', 'Skjermer', 3200, ['Veggfeste', 'Stativ']),
  counted('7520', 'Skjerm 75" på stativ', 'av', 'Lyd og bilde', 'Skjermer', 5400),
  counted('7550', 'Høyttaler med mikrofon', 'av', 'Lyd og bilde', 'Lyd', 1900),
  counted('9010', 'Plante, liten', 'plant', 'Planter', 'Planter', 290),
  counted('9015', 'Plante, stor', 'plant', 'Planter', 'Planter', 590),
  counted('9030', 'Fruktkurv', 'plant', 'Planter', 'Fruktkurv', 450),
  counted('9510', 'Brosjyrestativ', 'tilb', 'Tilbehør', 'Tilbehør', 420),
  counted('9520', 'Avfallsbøtte', 'tilb', 'Tilbehør', 'Tilbehør', 90),
  counted('9530', 'Kjøleskap 120 l', 'tilb', 'Tilbehør', 'Tilbehør', 950),
  counted('8030', 'Diskprofilering, folie', 'prof', 'Profilering', 'Disk og frontbord', 890),
  counted('6160', 'Frontplate med logo', 'prof', 'Profilering', 'Disk og frontbord', 1650),
  one('9900', 'Montering og demontering', 'system', 't', 'Montering', 750),
];

export const DEFAULT_CATALOG: Catalog = {
  products,
  system: {
    post: '6101',
    topRail: '6102',
    bottomRail: '6103',
    beam: '6110',
    header: '6132',
    frame: '8010',
    print: '8011',
    foil: '8020',
    foilFull: '8021',
    floorProtection: '5911',
    labour: '9900',
  },
};

export const DOOR = '6130';
export const CURTAIN = '6131';
