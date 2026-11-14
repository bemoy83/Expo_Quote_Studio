// Example catalog for the PoC. Art.nr are made up, groups are subgroup ids from groups.ts; prices are examples eks. mva. (F1, H6).
// Later this comes from the OMS export (Bærer, Art.nr, Beskrivelse, Pris).
import { RECIPES } from '../foga/recipes';
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

/** Counter built of Foga profiles, the size in stock (Byggeregler K1–K5), placed and colliding like furniture. Price
 *  from Bjørn (11.11.2026). It replaces the made-up counters 5410, 5415 and 5420 (OLD_COUNTERS). */
const counter = (id: string, name: string, price: number): Product => {
  const { length, depth } = RECIPES.counter.stock;
  const h = RECIPES.counter.height;
  return {
    ...one(id, name, 'object', 'stk', 'disk.disker', price, {
      dim: `${length / 10} × ${depth / 10} · h ${h / 10}`,
      footprint: { w: length / 1000, d: depth / 1000, h: h / 1000 },
      counter: { length, depth },
    }),
    variants: [{ artnr: id, name, price }],
  };
};

/** Disker og podier (Byggeregler K10–K13): a product per function (subgroup) for every counter or podie drawn of
 *  sections and not exactly a standard item, built on site and priced by the cost engine (K13). Its name is what it is
 *  called everywhere: pen, pill, drawer, calc, quote (Bjørn 14.11.2026). Art.nr is temporary until Bjørn gives one; the
 *  price is a placeholder per m² of top, used only when the cost basis lacks a price. Footprint and `counter`: one
 *  section of 500 × 500, as the pen starts. */
const podium = (id: string, name: string, group: string, pricePerM2: number): Product => {
  const side = 500 + 2 * RECIPES.counter.face;
  const h = 1000 + RECIPES.counter.railHeight;
  return one(id, name, 'object', 'stk', group, pricePerM2, {
    dim: 'bygget på stedet',
    footprint: { w: side / 1000, d: side / 1000, h: h / 1000 },
    counter: { length: side, depth: side },
    podium: true,
    pricing: 'sum',
  });
};

/** Podie 50 × 50 (Byggeregel K22, Bjørn 14.11.2026): a standard podie of Disker og podier, one tight section
 *  500 × 500, each height its own variant and price (domain/podiumStock.ts builds them). Listed by height; 25 cm came
 *  last and has the last art.nr, so 5450-1, -2 and -3 keep meaning 50, 75 and 100 cm. Placeholder prices. */
const podie = (id: string, name: string, heights: [suffix: number, cm: number, price: number][]): Product => {
  const side = 500 + 2 * RECIPES.counter.face;
  const top = Math.max(...heights.map(([, cm]) => cm)) * 10 + RECIPES.counter.railHeight;
  return {
    ...one(id, name, 'object', 'stk', 'disk.podier', heights[0][2], {
      dim: `${side / 10} × ${side / 10}`,
      footprint: { w: side / 1000, d: side / 1000, h: top / 1000 },
      counter: { length: side, depth: side },
    }),
    variants: heights.map(([n, cm, price]) => ({ artnr: `${id}-${n}`, name: `${cm} cm`, price, placeholder: true })),
  };
};

/** A furniture set (Møbel by use, Bjørn 14.11.2026): its pieces and the kortnavn of its function on the pill. The key
 *  is internal, not an art.nr: a set is never a line, each piece is. Its price is the pieces' sum, filled in below. */
const furnitureSet = (id: string, name: string, short: string, set: Product['set']): Product => ({
  ...one(id, name, 'object', 'stk', 'mob.grupper', 0, { short, set, pricing: 'sum', dim: 'sett' }),
});

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

// Price (Bjørn 7.11.2026): everything in the catalog (standard deliveries: Foga walls, doors, curtains, takdrager) is
// sold at its fixed stk price from the OMS ('fast'); the cost engine gives only cost, DG and time in the kalkyle, from
// what is drawn. Only what the catalog does not cover, custom sizes from the drawing, is priced as a sum ('sum').
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
    pricing: 'fast',
    // 765 kr per m is what a wall sells for today (Bjørn 7.11.2026)
    variants: PLATES.map(([ral, name, color]) => ({ artnr: `6120-${ral}`, name, ral, color, price: 765 })),
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
    pricing: 'fast',
    variants: PLATES.map(([ral, name, color]) => ({ artnr: `6125-${ral}`, name, ral, color, price: 400, placeholder: true })),
  },
  // Foot plate under a post of a system wall that stands free (no takdrager): always the exhibitor's (Bjørn 1.11.2026).
  // Art.nr 6115 is a placeholder.
  one('6115', 'Støtteplate systemvegg', 'system', 'stk', 'vegg.vegger', 120, { dim: '500 × 80 mm under stolpe, montert', pricing: 'fast' }),
  // 121 kr per m: what Bjørn's three priced stands give for takdrager (7.11.2026), still a placeholder
  one('6110', 'Takdrager 80 × 20 mm', 'system', 'lm', 'vegg.takdrager', 121, { dim: 'stolper inkludert', pricing: 'fast' }),
  // A takdrager lifted over a textile wall: the post (or hook point) extended with 94 (Bjørn 6.11.2026). Own line: a beam
  // can be lifted higher later and cost more. Art.nr 6111 is a placeholder.
  one('6111', 'Skjøt takdrager over tekstilvegg', 'system', 'stk', 'vegg.takdrager', 90, { dim: '94 × 80 mm på stolpe eller oppå tverrgående takdrager, montert', pricing: 'fast' }),
  one('6130', 'Dør med overstykke', 'object', 'stk', 'vegg.dorer', 2620, { opening: 'door', pricing: 'fast', short: 'Dør' }),
  one('6131', 'Forheng med overstykke', 'object', 'stk', 'vegg.dorer', 870, { dim: 'i åpning 960 mm', opening: 'curtain', pricing: 'fast', short: 'Forheng',
    fabrics: [
      { key: 'sort', name: 'Sort', color: '#26272B' },
      { key: 'gra', name: 'Grå', color: '#7C7F84' },
      { key: 'bla', name: 'Blå', color: '#33507A' },
    ] }),
  // Vegger: level 2 articles. No price: an article is never sold on its own, and the kalkyle takes its cost from the
  // cost engine (pricing/data.ts), and the names are the same as there and on the picking list. The product list shows them as «Artikkel · plukkes, selges ikke» (Bjørn 7.11.2026).
  {
    id: '6290',
    name: 'Veggplate',
    kind: 'system',
    unit: 'stk',
    group: 'vegg.plater',
    article: true,
    dim: '976 × 2440 mm',
    variants: PLATES.map(([ral, name, color]) => ({ artnr: `6290-${ral}`, name, ral, color, price: 0 })),
  },
  one('6101', 'Stolpe 94 med justeringsfot', 'system', 'stk', 'vegg.stolper', 0, { article: true }),
  one('6102', 'Toppskinne 92, 960 mm, med 600', 'system', 'stk', 'vegg.skinner', 0, { article: true }),
  one('6103', 'Bunnskinne 91, 960 mm, med 600', 'system', 'stk', 'vegg.skinner', 0, { article: true }),
  // Profilering. Textile walls: the frame (rental) and the textile (sale, the customer can bring it back) are two lines
  // in the kalkyle and one on the quote (Bjørn 31.10.2026). One frame whatever it is mounted on, on a wall with 520
  // or on foot plates (Bjørn 7.11.2026), per piece by size (price per m² of B × H); textile per m² of visible face.
  one('8000', 'Tekstilramme, leie', 'system', 'm²', 'prof.tekstil', 450, { dim: 'på vegg eller fotplater', pricing: 'sum' }),
  one('8040', 'Tekstil med trykk', 'system', 'm²', 'prof.tekstil', 650, { dim: 'silikonkant, montert', pricing: 'sum' }),
  one('8041', 'Tekstil hvit', 'system', 'm²', 'prof.tekstil', 420, { dim: 'uten grafikk, montert', pricing: 'sum' }),
  one('8042', 'Montering av kundens tekstil', 'system', 'm²', 'prof.tekstil', 170, { dim: 'duk i samme størrelse', pricing: 'sum' }),
  // Shelf in a wall module, drawn with its own tool (Bjørn 8.11.2026): same price alone or in a row, like a wall.
  // Brackets and board are on the picking list (Byggeregler H1–H3)
  {
    ...one('6311', 'Rett hylle, d:30cm', 'system', 'stk', 'hyll.hyller', 247, { dim: '976 × 300 mm i veggfelt', pricing: 'fast' }),
    variants: [{ artnr: '6311', name: 'Rett hylle, d:30cm', price: 247 }],
  },
  one('8020', 'Foliedekor, dekal', 'system', 'm²', 'prof.folie', 520),
  one('8021', 'Foliedekor, helt veggfelt 960 × 2420 mm', 'system', 'm²', 'prof.folie', 520),
  // Print on a counter of Disker og podier: its own article, the sizes cut on the line (Bjørn 13.11.2026, K20)
  one('8023', 'Foliedekor, diskfelt', 'system', 'm²', 'prof.folie', 520, { dim: 'helt felt på disk, kuttet per plate og dør' }),
  one('8022', 'Tilpasning av trykkfil over flere plater', 'system', 'stk', 'prof.folie', 450, { dim: 'ett motiv, delt per plate' }),
  // Floor
  {
    id: 'flis',
    name: 'Teppefliser',
    short: 'Fliser',
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
    short: 'Engangsteppe',
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
    short: 'Vinyl',
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
  // Bjørn 14.11.2026: the table of Møtesett, price from him
  { ...one('5221', 'Bord, sort plate/krom, 120 × 60', 'object', 'stk', 'mob.bord', 606, { dim: '120 × 60 · h 73', footprint: { w: 1.2, d: 0.6, h: 0.73 } }), variants: [{ artnr: '5221', name: 'Bord, sort plate/krom, 120 × 60', price: 606 }] },
  // Drawn since the furniture sets (Bjørn 14.11.2026); sizes are estimates until measured
  { ...counted('5190', 'Konferansestol', 'mob.sitte', 220, ['Sort', 'Hvit', 'Grå']), kind: 'object', dim: '50 × 52 · anslag', footprint: { w: 0.5, d: 0.52, h: 0.82 } },
  { ...counted('5210', 'Sofa 2-seter', 'mob.sitte', 1450, ['Grå', 'Sort']), kind: 'object', dim: '150 × 80 · anslag', footprint: { w: 1.5, d: 0.8, h: 0.8 } },
  // Counted (placed later)
  counted('5280', 'Møtebord 120 × 80', 'mob.bord', 690),
  { ...counted('5285', 'Kafébord ø70', 'mob.bord', 450), kind: 'object', dim: 'ø 70 · h 74 · anslag', footprint: { w: 0.7, d: 0.7, h: 0.74, round: true } },
  counted('5300', 'Loungegruppe', 'mob.grupper', 3900),
  // Furniture sets by use (Bjørn 14.11.2026): placed and moved together, each piece its own line
  furnitureSet('sett-mote', 'Møtesett', 'Møte', [
    { artnr: '5221', x: 0, y: 0, rot: 0 },
    { artnr: '5190-1', x: -0.3, y: -0.5, rot: 180 },
    { artnr: '5190-1', x: 0.3, y: -0.5, rot: 180 },
    { artnr: '5190-1', x: -0.3, y: 0.5, rot: 0 },
    { artnr: '5190-1', x: 0.3, y: 0.5, rot: 0 },
  ]),
  furnitureSet('sett-lounge', 'Loungesett', 'Lounge', [
    { artnr: '5210-1', x: 0, y: -0.4, rot: 0 },
    { artnr: '5285', x: 0, y: 0.55, rot: 0 },
  ]),
  furnitureSet('sett-mingle', 'Minglesett', 'Mingle', [
    { artnr: '5276', x: 0, y: 0, rot: 0 },
    { artnr: '5186', x: -0.6, y: 0, rot: 0 },
    { artnr: '5186', x: 0.6, y: 0, rot: 0 },
  ]),
  counter('6560', 'Bardisk', 1320),
  podium('6571', 'Disk', 'disk.disker', 2640),
  podie('5450', 'Podie 50 × 50', [
    [4, 25, 290],
    [1, 50, 380],
    [2, 75, 460],
    [3, 100, 540],
  ]),
  podium('6572', 'Podie', 'disk.podier', 2640),
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
// Per art.nr, or per product for all its variants; standard counters and podier are white plates (K6)
const OBJECT_COLORS: Record<string, string> = { '6560': FURNITURE_WHITE, '5450': FURNITURE_WHITE, '6571': FURNITURE_WHITE, '6572': FURNITURE_WHITE, '5276': BLACK, '5275': FURNITURE_WHITE, '5296': BLACK, '5186': BLACK, '5196': BLACK, '5195': FURNITURE_WHITE };
for (const p of products) for (const v of p.variants) if (OBJECT_COLORS[v.artnr] ?? OBJECT_COLORS[p.id]) v.color = OBJECT_COLORS[v.artnr] ?? OBJECT_COLORS[p.id];

// A set's price: the sum of its pieces
for (const p of products) {
  if (!p.set) continue;
  const price = p.set.reduce((sum, x) => sum + (products.flatMap((q) => q.variants).find((v) => v.artnr === x.artnr)?.price ?? 0), 0);
  p.variants = p.variants.map((v) => ({ ...v, price }));
}

// Cost and handling time of the products without a recipe (furniture, floor, foil, services) come from the kostgrunnlag
// (`katalog`, src/cost/itemDefs.ts EXAMPLE_CATALOG) until the OMS gives them per product.

export const DEFAULT_CATALOG: Catalog = {
  products,
  system: {
    wall: '6120',
    plateSwap: '6125',
    wallSupport: '6115',
    beam: '6110',
    beamLift: '6111',
    textile: '8000',
    textileFill: { print: '8040', white: '8041', reuse: '8042' },
    foil: '8020',
    foilFull: '8021',
    foilCounter: '8023',
    printSetup: '8022',
    floorProtection: '5911',
    shelf: '6311',
  },
};

/** «Hylle 1 m» (6180, Rett and Skrå) was a counted product until the drawn shelf 6311 replaced it (Bjørn 8.11.2026). A
 *  sketch that has it keeps it as a loose line at its price then (persistence/file.ts). */
export const OLD_SHELF = { prefix: '6180-', name: 'Hylle 1 m', price: 290, variants: ['Rett', 'Skrå'] } as const;

/** The made-up counters before 6560 (Bjørn 11.11.2026): a sketch that has them keeps them as loose lines at their
 *  price (persistence/file.ts). */
export const OLD_COUNTERS: Readonly<Record<string, { name: string; price: number }>> = {
  '5410': { name: 'Disk 100, lav', price: 1350 },
  '5415': { name: 'Disk 100, høy med lås', price: 1890 },
  '5420': { name: 'Bardisk, buet', price: 2950 },
};

export const DOOR = '6130';
export const CURTAIN = '6131';
