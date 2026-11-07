// The price items the calc builds lines from: name, unit, time per handling step, and cost and price. Items with a
// recipe below (system wall, takdrager and textile frame parts, textile and work) get cost from the cost engine and
// price from the DG target (src/cost/items.ts, docs/kostmodell.md); the rest keep the example numbers here. The price
// is only used by sum-priced products (textile walls); catalog products keep their OMS price and use the cost. Change
// numbers here or in the kostgrunnlag, never in calc code.
import { EXAMPLE_BASIS, type CostBasis } from '../cost/basis';
import { basisYear, costItems, type ItemRecipe } from '../cost/items';
import { orderCost } from '../cost/model';
import { RULES } from '../rules/rules';
import type { PriceItem, PriceList, Time, Transfer } from './model';

const item = (id: string, name: string, unit: PriceItem['unit'], cost: number, price: number, time?: Time, transfer: Transfer = 'leie'): PriceItem => ({
  id,
  name,
  unit,
  cost,
  price,
  transfer,
  ...(time ? { time } : {}),
});

/** Minutes per handling step. Picking, washing and transport of one article; on site up (montering) and down (demontering). */
const pvt = (plukk: number, vask: number, transport: number): Time => ({ plukk, vask, transport });
const onSite = (montering: number, demontering: number): Time => ({ montering, demontering });

/** Ids the calc builds from the Foga structure. Rails and beams per standard length, the rest per piece, m or m². */
export const ITEM = {
  post: 'stolpe-94',
  rail: (code: string, lengthMm: number) => `skinne-${code}-${lengthMm}`,
  plate: 'veggplate',
  headerPlate: 'veggplate-overstykke',
  door: 'dor',
  curtain: 'forheng',
  beam: (lengthMm: number) => `takdrager-292-${lengthMm}`,
  braceM: 'stag-90-m',
  bracePiece: 'stag-90-stk',
  frameProfileM: '43TX',
  cornerPostM: '92LTX',
  corner: '617',
  splice: '609',
  spliceSlide: '604',
  wallFixing: '520',
  foot: (code: string) => `fotplate-${code}`,
  /** Støtteplate under a system wall post, on and off (Bjørn 1.11.2026). */
  wallFootMount: 'montering-stotteplate',
  print: 'trykk',
  white: 'tekstil-hvit',
  module: 'montering-modul',
  /** Swapping the plate of an existing stand wall: plate out and the new one in, both ways. */
  plateSwap: 'platebytte',
  beamLm: 'montering-takdrager',
  beamPost: 'montering-takdragerstolpe',
  /** A drawn takdrager's end hung on another beam: the hook and hanging it. Placeholder. */
  beamHook: 'krok-takdrager',
  /** A post or hook point extended with 94 × 80 so a takdrager passes over a textile wall (Bjørn 6.11.2026). */
  beamLift: 'skjot-takdrager',
  frame: 'handtering-ramme',
  /** Free-standing frame, up and down, per coupling (Bjørn 31.10.2026). */
  frameCoupling: 'montering-ramme-kobling',
  /** Textile pressed into the frame along its whole perimeter, up and down. */
  textileEdge: 'montering-tekstil-omkrets',
} as const;

// Takdrager 292 in every standard length (centres 1–6 m, cut 40 shorter), couplings mounted
const beams = [1, 2, 3, 4, 5, 6].map((m) => {
  const len = m * 1000 - 40;
  return item(ITEM.beam(len), `Takdrager 292, ${len} mm, med 600`, 'stk', 8 + 7 * m, 25 + 20 * m, pvt(1, 1, 1));
});

const ITEMS: PriceItem[] = [
  // Level 2: articles the montør picks (cost incl. plukk, vask, transport)
  item(ITEM.post, 'Stolpe 94 med justeringsfot', 'stk', 45, 80, pvt(1, 1, 1)),
  item(ITEM.rail('92', 960), 'Toppskinne 92, 960 mm, med 600', 'stk', 18, 35, pvt(0.5, 0.5, 0.5)),
  item(ITEM.rail('91', 960), 'Bunnskinne 91, 960 mm, med 600', 'stk', 17, 35, pvt(0.5, 0.5, 0.5)),
  item(ITEM.plate, 'Veggplate 976 × 2440 mm', 'stk', 85, 150, pvt(1, 3, 1)),
  item(ITEM.headerPlate, 'Veggplate, overstykke', 'stk', 30, 55, pvt(0.5, 1.5, 0.5)),
  item(ITEM.door, 'Dør 292 med lås 410', 'stk', 180, 450, pvt(2, 3, 2)),
  item(ITEM.curtain, 'Forheng', 'stk', 140, 260, pvt(1, 5, 1)),
  ...beams,
  // Braces have no standard length (they follow the textile height): per metre plus per piece (couplings, handling)
  item(ITEM.braceM, 'Støttestag 90, per meter', 'm', 2, 6),
  item(ITEM.bracePiece, 'Støttestag 90, kobling og håndtering per stk', 'stk', 10, 20, pvt(0.5, 0.5, 0.5)),
  // Level 3 picked directly (textile walls have no article)
  item(ITEM.frameProfileM, '43TX, per meter', 'm', 4, 10),
  item(ITEM.cornerPostM, '92LTX hjørnestolpe, per meter', 'm', 7, 16),
  item(ITEM.corner, '617 kobling i kanal (hjørner)', 'stk', 1.5, 4),
  item(ITEM.splice, '609 skjøtekobling', 'stk', 2, 5),
  item(ITEM.spliceSlide, '604 forlenger i kanal', 'stk', 2, 5),
  item(ITEM.wallFixing, '520 brakett', 'stk', 2, 5),
  item(ITEM.foot('740'), '740 fotplate 400 × 400 mm', 'stk', 8, 18, pvt(0.5, 0.5, 0.5)),
  item(ITEM.foot('750'), '750 fotplate 500 × 80 mm med 795', 'stk', 6, 14, pvt(0.5, 0.5, 0.5)),
  item(ITEM.foot('730'), '730 fotplate 250 × 300 mm', 'stk', 6, 14, pvt(0.5, 0.5, 0.5)),
  // Textile is sold (the customer keeps it and can bring it back)
  item(ITEM.print, 'Trykt tekstil med silikonkant, per m²', 'm²', 260, 470, undefined, 'salg'),
  item(ITEM.white, 'Hvit tekstil med silikonkant, per m²', 'm²', 150, 280, undefined, 'salg'),
  // Handling that belongs to the product (montering on site, up and down), at the montør's rate
  item(ITEM.module, 'Montering per veggmodul', 'stk', 325, 590, onSite(18, 12)),
  item(ITEM.wallFootMount, 'Montering av støtteplate under stolpe', 'stk', 30, 55, onSite(3, 2)),
  item(ITEM.plateSwap, 'Platebytte i eksisterende vegg', 'stk', 110, 200, onSite(6, 4)),
  item(ITEM.beamLm, 'Montering takdrager per meter', 'm', 98, 175, onSite(6, 3)),
  item(ITEM.beamPost, 'Montering takdragerstolpe', 'stk', 163, 295, onSite(9, 6)),
  item(ITEM.beamHook, 'Krok for takdrager, med montering', 'stk', 25, 45, { ...pvt(0.5, 0.5, 0.5), ...onSite(2, 1) }),
  item(ITEM.beamLift, 'Skjøt 94 × 80 mm med kobling, med montering', 'stk', 30, 55, { ...pvt(0.5, 0.5, 0.5), ...onSite(3, 2) }),
  item(ITEM.frame, 'Håndtering av løse rammedeler per ramme', 'stk', 80, 140, pvt(3, 2, 2)),
  item(ITEM.frameCoupling, 'Montering ramme per kobling', 'stk', 35, 60, onSite(2, 1)),
  item(ITEM.textileEdge, 'Montering tekstil per meter omkrets', 'm', 70, 120, onSite(4, 2)),
];

const POST_M = RULES.wall.height;
/** A rail of one module: profile cut to cc − post width, with a 600 in each end. */
const rail = (code: string): ItemRecipe => ({ parts: [[code, 0.96], ['600', 2]], dg: 'utleie' });
const work: ItemRecipe = { dg: 'arbeid' };

/** What each costed item is made of, per unit. Foga parts by code in the list's unit (m or stk), own purchases by
 *  art.nr (src/cost/own-list.ts). Time is the item's own, above, as person-minutes. */
export const ITEM_RECIPES: Readonly<Record<string, ItemRecipe>> = {
  [ITEM.post]: { parts: [['94', POST_M], ['700', 1], ['M10x65', 1]], dg: 'utleie' },
  [ITEM.rail('92', 960)]: rail('92'),
  [ITEM.rail('91', 960)]: rail('91'),
  [ITEM.plate]: { own: [['HDF-976x2440', 1, 'plate']], dg: 'utleie' },
  // The header over a door or curtain is cut from a plate: about a fifth of it
  [ITEM.headerPlate]: { own: [['HDF-976x2440', 0.2, 'plate']], dg: 'utleie' },
  [ITEM.door]: { own: [['DOR-292-410', 1, 'accessory']], dg: 'utleie' },
  [ITEM.curtain]: { own: [['FORHENG', 1, 'accessory']], dg: 'utleie' },
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((m): [string, ItemRecipe] => [ITEM.beam(m * 1000 - 40), { parts: [['292', m - 0.04], ['600', 4]], dg: 'utleie' }])),
  [ITEM.foot('750')]: { parts: [['750', 1], ['795', 1]], dg: 'utleie' },
  [ITEM.beamHook]: { own: [['KROK', 1, 'accessory']], dg: 'utleie' },
  [ITEM.beamLift]: { parts: [['94', 0.08], ['609', 1]], dg: 'utleie' },
  // Textile walls (kostmotor, tekstil): the frame parts rented out, the textile bought for the job, the work
  [ITEM.frameProfileM]: { parts: [['43TX', 1]], dg: 'utleie' },
  [ITEM.cornerPostM]: { parts: [['92LTX', 1]], dg: 'utleie' },
  [ITEM.corner]: { parts: [['617', 1]], dg: 'utleie' },
  [ITEM.splice]: { parts: [['609', 1]], dg: 'utleie' },
  [ITEM.spliceSlide]: { parts: [['604', 1]], dg: 'utleie' },
  [ITEM.wallFixing]: { parts: [['520', 1], ['503', 1]], dg: 'utleie' },
  [ITEM.braceM]: { parts: [['90', 1]], dg: 'utleie' },
  [ITEM.bracePiece]: { parts: [['600', 2]], dg: 'utleie' },
  [ITEM.foot('740')]: { parts: [['740', 1]], dg: 'utleie' },
  [ITEM.foot('730')]: { parts: [['730', 1]], dg: 'utleie' },
  [ITEM.print]: { bought: [['TRYKK-BLACKBACK', 1]], dg: 'salg' },
  [ITEM.white]: { bought: [['TEKSTIL-HVIT', 1]], dg: 'salg' },
  [ITEM.frame]: work,
  [ITEM.frameCoupling]: work,
  [ITEM.textileEdge]: work,
  [ITEM.module]: work,
  [ITEM.wallFootMount]: work,
  [ITEM.plateSwap]: work,
  [ITEM.beamLm]: work,
  [ITEM.beamPost]: work,
};

export interface PricingData {
  items: PriceList;
  /** By product id, or by the quote key of lines the quote shows as one: what the quote tells the customer when it is
   *  part rental, part sale. */
  terms: Record<string, string>;
  /** Cost once per quote (kostgrunnlag `ordrekost`), in kr for the basis year: in the kalkyle's cost, not in a price. */
  orderCosts: readonly { id: string; name: string; cost: number; when?: 'trykk' }[];
}

/**
 * Time calibrated against three stands Bjørn priced (7.11.2026: corner 4 × 3, row 5 × 3, corner 7 × 4, the exhibitor
 * paying walls and takdrager). His estimate is person-hours for the whole goods journey, montering and demontering
 * included: about 14 minutes per metre of wall and 2 per metre of takdrager. The times above keep their split over the
 * steps and are scaled by this, wall items and takdrager items each by their own factor (docs/kostmodell.md).
 */
const TIME_FACTOR = { wall: 0.34, beam: 0.15 } as const;
const WALL_ITEMS: readonly string[] = [ITEM.post, ITEM.rail('92', 960), ITEM.rail('91', 960), ITEM.plate, ITEM.headerPlate, ITEM.door, ITEM.curtain, ITEM.module, ITEM.wallFootMount, ITEM.plateSwap, ITEM.foot('750')];
const BEAM_ITEMS: readonly string[] = [...beams.map((b) => b.id), ITEM.beamLm, ITEM.beamPost, ITEM.beamHook, ITEM.beamLift];

const scaleTime = (t: Time | undefined, k: number): Time | undefined =>
  t && Object.fromEntries(Object.entries(t).map(([step, m]) => [step, Math.round((m ?? 0) * k * 100) / 100]));
const calibrated = (x: PriceItem): PriceItem => {
  const k = WALL_ITEMS.includes(x.id) ? TIME_FACTOR.wall : BEAM_ITEMS.includes(x.id) ? TIME_FACTOR.beam : 1;
  return k === 1 ? x : { ...x, time: scaleTime(x.time, k) };
};

const EXAMPLE_ITEMS: PriceList = new Map(ITEMS.map((x) => [x.id, calibrated(x)]));

/** The price items with the costed ones from this kostgrunnlag. */
export const pricingFrom = (b: CostBasis): PricingData => ({
  ...DEFAULT_TERMS,
  items: costItems(EXAMPLE_ITEMS, ITEM_RECIPES, b),
  orderCosts: b.orderCosts.map((o) => ({ id: o.id, name: o.name, cost: orderCost([o], basisYear(b), b.params), ...(o.when ? { when: o.when } : {}) })),
});

const DEFAULT_TERMS: Omit<PricingData, 'items' | 'orderCosts'> = {
  terms: { tekstil: 'Leie av ramme, kjøp av tekstil', '8040': 'Kjøp av tekstil, montering inkludert', '8041': 'Kjøp av tekstil, montering inkludert' },
};

/** Costed from the example kostgrunnlag. The calc's default, and what the fasit tests run on. */
export const DEFAULT_PRICING: PricingData = pricingFrom(EXAMPLE_BASIS);
