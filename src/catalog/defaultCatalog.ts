// Example catalog for the PoC. Art.nr are made up, groups are subgroup ids from groups.ts; prices are examples eks. mva. (F1, H6).
// Later this comes from the OMS export (Bærer, Art.nr, Beskrivelse, Pris).
import type { Time } from '../pricing/model';
import type { Catalog, Product, ProductKind, Unit } from './types';

const one = (
  id: string,
  name: string,
  kind: ProductKind,
  unit: Unit,
  group: string,
  price: number,
  extra: Partial<Product> = {},
): Product => ({ id, name, kind, unit, group, variants: [{ artnr: id, name, price, placeholder: true }], ...extra });

/** Counted product with optional named variants ("Sort;Hvit"). Art.nr gets a suffix per variant. */
const counted = (
  id: string,
  name: string,
  group: string,
  price: number,
  variants: string[] = [],
): Product => ({
  id,
  name,
  kind: 'counted',
  unit: 'stk',
  group,
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

// Two levels (Bjørn 31.10.2026). Level 1 is what the customer buys: one line on the quote, with the sales price.
// Level 2 (article: true) is what the montør picks; the picking list counts it from the drawing. A level 1 product is
// a nominal bundle of articles (wall: plate, 2 posts, top and bottom rail per metre), never shown on the quote.
const products: Product[] = [
  // Vegger: level 1
  {
    id: '6120',
    name: 'Rammevegg m/plate, komplett',
    kind: 'surface',
    unit: 'lm',
    group: 'vegg.vegger',
    dim: '1 × 2,5 m per meter',
    pricing: 'sum',
    variants: PLATES.map(([ral, name, color]) => ({ artnr: `6120-${ral}`, name, ral, color, price: 870, placeholder: true })),
  },
  // Coloured plate in a stand wall the organiser pays: the exhibitor pays the plate and swapping it (docs/vegger.md).
  // Art.nr 6125 is a placeholder.
  {
    id: '6125',
    name: 'Platebytte standvegg',
    kind: 'system',
    unit: 'lm',
    group: 'vegg.vegger',
    dim: 'plate i RAL med montering og demontering',
    pricing: 'sum',
    variants: PLATES.map(([ral, name, color]) => ({ artnr: `6125-${ral}`, name, ral, color, price: 400, placeholder: true })),
  },
  // Foot plate under a post of a system wall that stands free (no takdrager): always the exhibitor's (Bjørn 1.11.2026).
  // Art.nr 6115 is a placeholder.
  one('6115', 'Støtteplate systemvegg', 'system', 'stk', 'vegg.vegger', 120, { dim: '500 × 80 mm under stolpe, montert', pricing: 'sum' }),
  one('6110', 'Takdrager 80 × 20 mm', 'system', 'lm', 'vegg.takdrager', 420, { dim: 'stolper inkludert', pricing: 'sum' }),
  one('6130', 'Dør med overstykke', 'object', 'stk', 'vegg.dorer', 2620, { opening: 'door', pricing: 'sum' }),
  one('6131', 'Forheng med overstykke', 'object', 'stk', 'vegg.dorer', 870, { dim: 'i åpning 960 mm', opening: 'curtain', pricing: 'sum' }),
  // Vegger: level 2 articles
  {
    id: '6290',
    name: 'Veggplate',
    kind: 'system',
    unit: 'stk',
    group: 'vegg.plater',
    article: true,
    dim: '976 × 2440 mm',
    variants: PLATES.map(([ral, name, color]) => ({ artnr: `6290-${ral}`, name, ral, color, price: 330, placeholder: true })),
  },
  one('6101', 'Stolpe 40 × 40 mm, 2,5 m', 'system', 'stk', 'vegg.stolper', 180, { article: true }),
  one('6102', 'Toppprofil 960 × 40 mm', 'system', 'stk', 'vegg.skinner', 95, { article: true }),
  one('6103', 'Bunnprofil 960 × 30 mm', 'system', 'stk', 'vegg.skinner', 85, { article: true }),
  // Profilering. Textile walls: the frame (rental) and the textile (sale, the customer can bring it back) are two lines
  // in the kalkyle and one on the quote (Bjørn 31.10.2026). InFrame frame per piece by size (price per m² of B × H),
  // free-standing frame per metre, textile per m² of visible face.
  one('8000', 'Tekstilramme på systemvegg, leie', 'system', 'm²', 'prof.tekstil', 450, { pricing: 'sum' }),
  one('8010', 'Tekstilvegg frittstående, leie av ramme', 'system', 'lm', 'prof.tekstil', 1100, { dim: 'h 2,54 m, føtter og stag', pricing: 'sum' }),
  one('8040', 'Tekstil med trykk', 'system', 'm²', 'prof.tekstil', 650, { dim: 'silikonkant, montert', pricing: 'sum' }),
  one('8041', 'Tekstil hvit', 'system', 'm²', 'prof.tekstil', 420, { dim: 'uten grafikk, montert', pricing: 'sum' }),
  one('8042', 'Montering av kundens tekstil', 'system', 'm²', 'prof.tekstil', 170, { dim: 'duk i samme størrelse', pricing: 'sum' }),
  one('8020', 'Foliedekor, dekal', 'system', 'm²', 'prof.folie', 520),
  one('8021', 'Foliedekor, helt veggfelt 960 × 2420 mm', 'system', 'm²', 'prof.folie', 520),
  // Floor
  {
    id: 'flis',
    name: 'Teppefliser',
    kind: 'surface',
    unit: 'm²',
    group: 'gulv.belegg',
    tiles: true,
    dim: 'flis 100 × 100',
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
    group: 'gulv.belegg',
    roll: 2,
    dim: 'rull 2 m',
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
    group: 'gulv.belegg',
    variants: [{ artnr: '5930', name: 'Eik', color: '#C2A27A', price: 240, placeholder: true }],
  },
  one('5911', 'Monteringsbeskyttelse 0,1 mm', 'system', 'm²', 'gulv.beskyttelse', 30),
  // Placed furniture
  one('5276', 'Ståbord sort, rund', 'object', 'stk', 'mob.bord', 500, {
    dim: 'ø 70 · h 111', footprint: { w: 0.7, d: 0.7, h: 1.11, round: true },
  }),
  one('5275', 'Ståbord hvit, rund', 'object', 'stk', 'mob.bord', 500, {
    dim: 'ø 70 · h 111', footprint: { w: 0.7, d: 0.7, h: 1.11, round: true },
  }),
  one('5296', 'Ståbord sort, 70 × 70', 'object', 'stk', 'mob.bord', 550, {
    dim: '70 × 70 · h 111', footprint: { w: 0.7, d: 0.7, h: 1.11 },
  }),
  one('5186', 'Barkrakk sort', 'object', 'stk', 'mob.sitte', 350, {
    dim: 'sittehøyde 80', footprint: { w: 0.4, d: 0.4, h: 0.8, round: true },
  }),
  one('5196', 'Barstol sort/krom', 'object', 'stk', 'mob.sitte', 350, {
    dim: 'justerbar 58–78', footprint: { w: 0.42, d: 0.42, h: 0.78, round: true },
  }),
  one('5195', 'Barstol hvit/krom', 'object', 'stk', 'mob.sitte', 350, {
    dim: 'justerbar 58–78', footprint: { w: 0.42, d: 0.42, h: 0.78, round: true },
  }),
  // Counted (placed later)
  counted('5190', 'Konferansestol', 'mob.sitte', 220, ['Sort', 'Hvit', 'Grå']),
  counted('5210', 'Sofa 2-seter', 'mob.sitte', 1450, ['Grå', 'Sort']),
  counted('5280', 'Møtebord 120 × 80', 'mob.bord', 690),
  counted('5285', 'Kafébord ø70', 'mob.bord', 450),
  counted('5300', 'Loungegruppe', 'mob.grupper', 3900),
  counted('5410', 'Disk 100, lav', 'disk.disker', 1350),
  counted('5415', 'Disk 100, høy med lås', 'disk.disker', 1890),
  counted('5420', 'Bardisk, buet', 'disk.disker', 2950),
  counted('5450', 'Podie 50 × 50', 'disk.podier', 380, ['50 cm', '75 cm', '100 cm']),
  counted('6180', 'Hylle 1 m', 'hyll.hyller', 290, ['Rett', 'Skrå']),
  counted('6185', 'Kleskrok, 5 kroker', 'hyll.heng', 160),
  counted('6186', 'Klesstativ', 'hyll.heng', 340),
  counted('6190', 'Låsbart skap', 'hyll.skap', 1100),
  counted('7010', 'Strømuttak 230 V, 2 kW', 'lys.strom', 1250),
  counted('7015', 'Strømuttak 3-faset 16 A', 'lys.strom', 2900),
  counted('7020', 'Grenuttak 6-veis', 'lys.strom', 120),
  counted('7100', 'LED-spot på takdrager', 'lys.lys', 390),
  counted('7110', 'Strømskinne 1 m', 'lys.lys', 450),
  counted('7120', 'Vegglampe på arm', 'lys.lys', 340),
  counted('7510', 'Skjerm 55"', 'av.skjermer', 3200, ['Veggfeste', 'Stativ']),
  counted('7520', 'Skjerm 75" på stativ', 'av.skjermer', 5400),
  counted('7550', 'Høyttaler med mikrofon', 'av.lyd', 1900),
  counted('9010', 'Plante, liten', 'plant.planter', 290),
  counted('9015', 'Plante, stor', 'plant.planter', 590),
  counted('9030', 'Fruktkurv', 'plant.frukt', 450),
  counted('9510', 'Brosjyrestativ', 'tilb.tilbehor', 420),
  counted('9520', 'Avfallsbøtte', 'tilb.tilbehor', 90),
  counted('9530', 'Kjøleskap 120 l', 'tilb.tilbehor', 950),
  counted('8030', 'Diskprofilering, folie', 'prof.disk', 890),
  counted('6160', 'Frontplate med logo', 'prof.disk', 1650),
  // Montering of our own products is in their price (handling). Hours are sold only as help with the customer's own equipment.
  one('9900', 'Arbeidstimer, hjelp med kundens eget utstyr', 'counted', 't', 'tjen.montering', 750),
];

// Colours for drawing placed furniture (product data, not tokens).
const BLACK = '#2B2C2E';
export const FURNITURE_WHITE = '#F3F2EE';
const OBJECT_COLORS: Record<string, string> = { '5276': BLACK, '5275': FURNITURE_WHITE, '5296': BLACK, '5186': BLACK, '5196': BLACK, '5195': FURNITURE_WHITE };
for (const p of products) for (const v of p.variants) if (OBJECT_COLORS[v.artnr]) v.color = OBJECT_COLORS[v.artnr];

// Example cost (from the OMS later) for the fast-priced products in these groups: 55 % of the price. The rest have no
// cost yet, so the kalkyle shows them as without margin.
const COSTED = ['gulv.', 'mob.', 'prof.folie', 'tjen.montering'];
for (const p of products)
  if (!p.pricing && !p.article && COSTED.some((g) => p.group.startsWith(g))) for (const v of p.variants) v.cost = Math.round(v.price * 0.55);

// Example handling time per unit (minutes per step), by subgroup prefix. From the OMS later.
const TIME: [prefix: string, time: Time][] = [
  ['mob.', { plukk: 1, vask: 2, transport: 2, montering: 1, demontering: 1 }],
  ['gulv.belegg', { plukk: 0.5, vask: 1, transport: 0.5, montering: 6, demontering: 3 }],
  ['gulv.beskyttelse', { montering: 1, demontering: 0.5 }],
  ['prof.folie', { montering: 15, demontering: 5 }],
];
for (const p of products) {
  const t = !p.pricing && !p.article && TIME.find(([g]) => p.group.startsWith(g));
  if (t) p.time = t[1];
}

export const DEFAULT_CATALOG: Catalog = {
  products,
  system: {
    wall: '6120',
    plateSwap: '6125',
    wallSupport: '6115',
    beam: '6110',
    textile: '8000',
    freeTextile: '8010',
    textileFill: { print: '8040', white: '8041', reuse: '8042' },
    foil: '8020',
    foilFull: '8021',
    floorProtection: '5911',
  },
};

export const DOOR = '6130';
export const CURTAIN = '6131';
