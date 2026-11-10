// The price items the calc builds lines from, as structure: id, name, unit and whether it is rented or sold. Every
// number for them (minutes per handling step, what each is made of) is in the kostgrunnlag (src/cost/basis.ts); the
// examples here are what the app ships with. Kostmodell: docs/kostmodell.md.
import type { ItemRecipe } from '../cost/items';
import { RULES } from '../rules/rules';
import type { PriceItem, Time } from './model';

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
  /** A post or hook point extended with 94 × 80 so a takdrager passes over a textile wall (Bjørn 6.11.2026). */
  beamLift: 'skjot-takdrager',
  frame: 'handtering-ramme',
  /** Free-standing frame, up and down, per coupling (Bjørn 31.10.2026). */
  frameCoupling: 'montering-ramme-kobling',
  /** Textile pressed into the frame along its whole perimeter, up and down. */
  textileEdge: 'montering-tekstil-omkrets',
  /** Shelf brackets with their 600, at a row's end (91F) and between two boards (91FF), and the board (Byggeregler H2, H3). */
  shelfEnd: 'hylleknekt-91F',
  shelfTwin: 'hylleknekt-91FF',
  shelfBoard: 'hylleplate',
  /** Putting up one shelf (Bjørn 8.11.2026: 3 min). */
  shelfMount: 'montering-hylle',
  /** Picking shelves for an order, once whatever the number (Bjørn 8.11.2026: 10 min per product type). */
  shelfPick: 'vareplukk-hyller',
} as const;

/** A price item without its numbers: the kostgrunnlag gives its time, and the cost engine its cost and price. */
export type ItemDef = Pick<PriceItem, 'id' | 'name' | 'unit' | 'transfer'>;

const def = (id: string, name: string, unit: PriceItem['unit'], transfer: PriceItem['transfer'] = 'leie'): ItemDef => ({ id, name, unit, transfer });

/** Takdrager 292 in every standard length: centres 1–6 m, cut 40 shorter, couplings mounted. */
const BEAM_M = [1, 2, 3, 4, 5, 6] as const;
const beamLen = (m: number) => m * 1000 - 40;

export const ITEM_DEFS: readonly ItemDef[] = [
  // Level 2: articles the montør picks
  def(ITEM.post, 'Stolpe 94 med justeringsfot', 'stk'),
  def(ITEM.rail('92', 960), 'Toppskinne 92, 960 mm, med 600', 'stk'),
  def(ITEM.rail('91', 960), 'Bunnskinne 91, 960 mm, med 600', 'stk'),
  def(ITEM.plate, 'Veggplate 976 × 2440 mm', 'stk'),
  def(ITEM.headerPlate, 'Veggplate, overstykke', 'stk'),
  def(ITEM.door, 'Dør 292 med lås 410', 'stk'),
  def(ITEM.curtain, 'Forheng', 'stk'),
  ...BEAM_M.map((m) => def(ITEM.beam(beamLen(m)), `Takdrager 292, ${beamLen(m)} mm, med 600`, 'stk')),
  // Braces have no standard length (they follow the textile height): per metre plus per piece (couplings, handling)
  def(ITEM.braceM, 'Støttestag 90, per meter', 'm'),
  def(ITEM.bracePiece, 'Støttestag 90, kobling og håndtering per stk', 'stk'),
  // Level 3 picked directly (textile walls have no article)
  def(ITEM.frameProfileM, '43TX, per meter', 'm'),
  def(ITEM.cornerPostM, '92LTX hjørnestolpe, per meter', 'm'),
  def(ITEM.corner, '617 kobling i kanal (hjørner)', 'stk'),
  def(ITEM.splice, '609 skjøtekobling', 'stk'),
  def(ITEM.spliceSlide, '604 forlenger i kanal', 'stk'),
  def(ITEM.wallFixing, '520 brakett', 'stk'),
  def(ITEM.foot('740'), '740 fotplate 400 × 400 mm', 'stk'),
  def(ITEM.foot('750'), '750 fotplate 500 × 80 mm med 795', 'stk'),
  def(ITEM.foot('730'), '730 fotplate 250 × 300 mm', 'stk'),
  // Textile is sold (the customer keeps it and can bring it back)
  def(ITEM.print, 'Trykt tekstil med silikonkant, per m²', 'm²', 'salg'),
  def(ITEM.white, 'Hvit tekstil med silikonkant, per m²', 'm²', 'salg'),
  // Handling that belongs to the product (montering on site, up and down), at the montør's rate
  def(ITEM.module, 'Montering per veggmodul', 'stk'),
  def(ITEM.wallFootMount, 'Montering av støtteplate under stolpe', 'stk'),
  def(ITEM.plateSwap, 'Platebytte i eksisterende vegg', 'stk'),
  def(ITEM.beamLm, 'Montering takdrager per meter', 'm'),
  def(ITEM.beamPost, 'Montering takdragerstolpe', 'stk'),
  def(ITEM.beamLift, 'Skjøt 94 × 80 mm med kobling, med montering', 'stk'),
  def(ITEM.frame, 'Håndtering av løse rammedeler per ramme', 'stk'),
  def(ITEM.frameCoupling, 'Montering ramme per kobling', 'stk'),
  def(ITEM.textileEdge, 'Montering tekstil per meter omkrets', 'm'),
  // Shelves: brackets and board picked, the work per shelf and the picking once per order
  def(ITEM.shelfEnd, 'Hylleknekt 91F, 290 mm, med 600', 'stk'),
  def(ITEM.shelfTwin, 'Hylleknekt 91FF, 290 mm, med 600', 'stk'),
  def(ITEM.shelfBoard, 'Hylleplate melamin hvit 18 × 300 × 976 mm', 'stk'),
  def(ITEM.shelfMount, 'Montering per hylle', 'stk'),
  def(ITEM.shelfPick, 'Vareplukk hyller, per ordre', 'stk'),
];

/** Minutes per handling step. Picking, washing and transport of one article; on site up (montering) and down (demontering). */
const pvt = (plukk: number, vask: number, transport: number): Time => ({ plukk, vask, transport });
const onSite = (montering: number, demontering: number): Time => ({ montering, demontering });

/**
 * Person-minutes per unit and handling step. Wall and takdrager items are calibrated against three stands Bjørn priced
 * (7.11.2026: corner 4 × 3, row 5 × 3, corner 7 × 4, the exhibitor paying walls and takdrager): about 14 minutes per
 * metre of wall and 2 per metre of takdrager for the whole goods journey. The first estimates were scaled by 0,34 (wall)
 * and 0,15 (takdrager) to get there; the numbers here are the scaled ones, so the number shown is the number used.
 * Items with no time here take none (the per-metre parts of a textile frame: handled per frame).
 */
export const EXAMPLE_TIMES: Readonly<Record<string, Time>> = {
  [ITEM.post]: pvt(0.34, 0.34, 0.34),
  [ITEM.rail('92', 960)]: pvt(0.17, 0.17, 0.17),
  [ITEM.rail('91', 960)]: pvt(0.17, 0.17, 0.17),
  [ITEM.plate]: pvt(0.34, 1.02, 0.34),
  [ITEM.headerPlate]: pvt(0.17, 0.51, 0.17),
  [ITEM.door]: pvt(0.68, 1.02, 0.68),
  [ITEM.curtain]: pvt(0.34, 1.7, 0.34),
  ...Object.fromEntries(BEAM_M.map((m) => [ITEM.beam(beamLen(m)), pvt(0.15, 0.15, 0.15)])),
  [ITEM.bracePiece]: pvt(0.5, 0.5, 0.5),
  [ITEM.foot('740')]: pvt(0.5, 0.5, 0.5),
  [ITEM.foot('750')]: pvt(0.17, 0.17, 0.17),
  [ITEM.foot('730')]: pvt(0.5, 0.5, 0.5),
  [ITEM.module]: onSite(6.12, 4.08),
  [ITEM.wallFootMount]: onSite(1.02, 0.68),
  [ITEM.plateSwap]: onSite(2.04, 1.36),
  [ITEM.beamLm]: onSite(0.9, 0.45),
  [ITEM.beamPost]: onSite(1.35, 0.9),
  [ITEM.beamLift]: { ...pvt(0.08, 0.08, 0.08), ...onSite(0.45, 0.3) },
  [ITEM.frame]: pvt(3, 2, 2),
  [ITEM.frameCoupling]: onSite(2, 1),
  [ITEM.textileEdge]: onSite(4, 2),
  // Bjørn 8.11.2026: 3 min direct montering per shelf, picking 10 min for the product type; demontering is an example
  [ITEM.shelfMount]: onSite(3, 1.5),
  [ITEM.shelfPick]: { plukk: 10 },
};

const POST_M = RULES.wall.height;
/** A rail of one module: profile cut to cc − post width, with a 600 in each end. */
const rail = (code: string): ItemRecipe => ({ parts: [[code, 0.96], ['600', 2]], dg: 'utleie' });
const work: ItemRecipe = { dg: 'arbeid' };

/** What each price item is made of, per unit. Foga parts by code in the list's unit (m or stk), own purchases by
 *  art.nr (src/cost/own-list.ts). Every item has one: an item without a recipe has no cost and shows as missing. */
export const EXAMPLE_RECIPES: Readonly<Record<string, ItemRecipe>> = {
  [ITEM.post]: { parts: [['94', POST_M], ['700', 1], ['M10x65', 1]], dg: 'utleie' },
  [ITEM.rail('92', 960)]: rail('92'),
  [ITEM.rail('91', 960)]: rail('91'),
  [ITEM.plate]: { own: [['HDF-976x2440', 1, 'plate']], dg: 'utleie' },
  // The header over a door or curtain is cut from a plate: about a fifth of it
  [ITEM.headerPlate]: { own: [['HDF-976x2440', 0.2, 'plate']], dg: 'utleie' },
  [ITEM.door]: { own: [['DOR-292-410', 1, 'accessory']], dg: 'utleie' },
  [ITEM.curtain]: { own: [['FORHENG', 1, 'accessory']], dg: 'utleie' },
  ...Object.fromEntries(BEAM_M.map((m): [string, ItemRecipe] => [ITEM.beam(beamLen(m)), { parts: [['292', m - 0.04], ['600', 4]], dg: 'utleie' }])),
  [ITEM.foot('750')]: { parts: [['750', 1], ['795', 1]], dg: 'utleie' },
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
  [ITEM.shelfEnd]: { parts: [['91F', 0.29], ['600', 1]], dg: 'utleie' },
  [ITEM.shelfTwin]: { parts: [['91FF', 0.29], ['600', 1]], dg: 'utleie' },
  [ITEM.shelfBoard]: { own: [['HYLLEPLATE-976x300', 1, 'plate']], dg: 'utleie' },
  [ITEM.shelfMount]: work,
  [ITEM.shelfPick]: work,
};

/** Catalog products without a recipe here (furniture, floor, foil, services): what they cost and take, per subgroup
 *  prefix of the product group, until the OMS gives them per product. A product's own cost or time wins. Eksempeltall. */
export const EXAMPLE_CATALOG: { cost: Readonly<Record<string, number>>; time: Readonly<Record<string, Time>> } = {
  /** Cost as a share of the product's sales price. */
  cost: { 'gulv.': 0.55, 'mob.': 0.55, 'prof.folie': 0.55, 'tjen.montering': 0.55 },
  time: {
    'mob.': { plukk: 1, vask: 2, transport: 2, montering: 1, demontering: 1 },
    'gulv.belegg': { plukk: 0.5, vask: 1, transport: 0.5, montering: 6, demontering: 3 },
    'gulv.beskyttelse': { montering: 1, demontering: 0.5 },
    'prof.folie': { montering: 15, demontering: 5 },
  },
};
