// The price items the calc builds lines from, as structure: id, name, unit and whether it is rented or sold. Every
// number for them (minutes per handling step, what each is made of) is in the kostgrunnlag (src/cost/basis.ts); the
// examples here are what the app ships with. Kostmodell: docs/kostmodell.md.
import type { ItemRecipe, PriceItem } from './items';
import { railLengths } from '../domain/shelves/corners';
import { layoutBuild, profileMetres, type CounterBuild } from '../foga/counter';
import { counterBuildOf } from '../domain/counterShape';
import { outerHeight } from '../domain/podiums';
import { STOCK_COUNTERS, stockSize } from '../domain/podiumStock';
import { railHeight } from '../foga/plates';
import { RECIPES } from '../foga/recipes';
import { RULES } from '../rules/rules';
import type { Time } from './time';

/** Ids the calc builds from the Foga structure. Rails and beams per standard length, the rest per piece, m or m². */
export const ITEM = {
  post: 'stolpe-94',
  rail: (code: string, lengthMm: number) => `skinne-${code}-${lengthMm}`,
  plate: 'veggplate',
  /** A plate cut for a shorter module (Byggeregel V1), by width: 226, 476 or 726 mm. */
  cutPlate: (widthMm: number) => `veggplate-${widthMm}`,
  /** Cutting a rail or a plate for a shorter module, per piece (Bjørn 14.11.2026, placeholders). */
  railCut: 'kapp-skinne',
  plateCut: 'kapp-veggplate',
  headerPlate: 'veggplate-overstykke',
  /** Raised wall (Byggeregel V18): the 94 joined onto a post with its 609, by length; the upper felt's plate by its cut
   *  size (a stock size in CC 250, no cutting, Bjørn 27.11.2026); putting up and taking down one upper felt. */
  raisePost: (lengthMm: number) => `stolpeskjot-94-${lengthMm}`,
  raisePlate: (widthMm: number, heightMm: number) => `veggplate-ovre-${widthMm}x${heightMm}`,
  raiseModule: 'montering-ovre-felt',
  /** A ceiling wire on a raised wall (Byggeregler S9, S10): the V, its eyebolt and 503, and hanging it. */
  wire: 'vaieroppheng',
  wireMount: 'montering-vaier',
  /** A ceiling wire on a textile frame over its wall's top (Byggeregel X14): the V and its through-eyebolt. */
  textileWire: 'vaieroppheng-tekstil',
  /** One person-minute of montering or demontering more, for work above the height limit (cost rule 6). */
  heightMontering: 'hoyde-montering',
  heightDemontering: 'hoyde-demontering',
  door: 'dor',
  curtain: 'forheng',
  beam: (lengthMm: number) => `takdrager-292-${lengthMm}`,
  braceM: 'stag-90-m',
  bracePiece: 'stag-90-stk',
  frameProfileM: '43TX',
  /** 43TX cut for the job (Byggeregel X9, cost rule 2), per metre, and per cut. */
  frameCutM: '43TX-kapp',
  frameCut: 'kapp-43TX',
  /** A frame with any 43TX cut for it (Byggeregel X9): ordering, cutting, mitring and marking it as a special, once
   *  per frame (Bjørn 27.11.2026: the incentive to use standard lengths). */
  frameCutSetup: 'kapptillegg-ramme',
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
  /** A half metre joined onto a whole takdrager length with a standing 92 × 80 (Byggeregel T18, Bjørn 15.11.2026). */
  beamHalf: 'skjot-halvmeter-takdrager',
  frame: 'handtering-ramme',
  /** Free-standing frame, up and down, per coupling (Bjørn 31.10.2026). */
  frameCoupling: 'montering-ramme-kobling',
  /** Textile pressed into the frame along its whole perimeter, up and down. */
  textileEdge: 'montering-tekstil-omkrets',
  /** Shelf brackets with their 600, at a row's end (91F) and between two boards (91FF), and the board (Byggeregler H2, H3). */
  shelfEnd: 'hylleknekt-91F',
  shelfTwin: 'hylleknekt-91FF',
  shelfBoard: 'hylleplate',
  /** In an inner corner (Byggeregler H10–H12): the short 91 under a lone corner shelf, the 01 rail per standard length
   *  with its 01-kanal-krok, and the boards cut for the corner. */
  shelfShort: 'hylleknekt-91-80',
  shelfRail: (lengthMm: number) => `hylleskinne-01-${lengthMm}`,
  /** 960 × 300: no longer used since every corner board is 960 × 290 (H13); kept so saved kostgrunnlag files load. */
  shelfBoardCorner: 'hylleplate-hjorne',
  shelfBoardNarrow: 'hylleplate-hjorne-smal',
  shelfBoardTwoThirds: 'hylleplate-2-3',
  /** Putting up and taking down one shelf, direct time (Bjørn 10.11.2026: 1,5 min up, 1 min down). */
  shelfMount: 'montering-hylle',
  /** Picking shelves for an order, once whatever the number (Bjørn 8.11.2026: 10 min per product type). */
  shelfPick: 'vareplukk-hyller',
  /** A standard counter or podie, ready built and picked whole (Byggeregler K1, K22): its profiles, plates and boards,
   *  by outer size and, unless CC 1000, height CC. */
  counter: (length: number, depth: number, h: number = RECIPES.counter.top) => `disk-${length}x${depth}${h === RECIPES.counter.top ? '' : `-h${h}`}`,
  /** One of its plates swapped for a plate in another wall colour (Byggeregel K6), and back after the fair: per plate,
   *  as each plate may have its own colour (Bjørn 18.11.2026). */
  counterPlates: (length: number, depth: number, h: number = RECIPES.counter.top) => `disk-platebytte-plate-${length}x${depth}${h === RECIPES.counter.top ? '' : `-h${h}`}`,
  /** A counter drawn and built on site (Byggeregler K7–K9): its profiles by the metre, the 600, the plates by the m²
   *  (cut from wall plates), the boards by size, and the work per whole and half metre and per corner. */
  counterProfile: (code: string) => `disk-profil-${code}`,
  counterCoupling: 'disk-kobling-600',
  counterInsert: 'disk-innsats-700',
  counterPlateM2: 'disk-plate-m2',
  counterBoard: (w: number, d: number) => `disk-plate-${w}x${d}`,
  counterWhole: 'montering-disk-meter',
  counterHalf: 'montering-disk-halv',
  counterCorner: 'montering-disk-hjorne',
  /** Disker og podier: a sliding door (K17) and a shelf (K19) fitted, per piece. */
  counterDoor: 'montering-disk-skyvedor',
  counterShelf: 'montering-disk-hylle',
} as const;

/** A price item without its numbers: the kostgrunnlag gives its time, and the cost engine its cost and price. */
export type ItemDef = Pick<PriceItem, 'id' | 'name' | 'unit' | 'transfer'>;

const def = (id: string, name: string, unit: PriceItem['unit'], transfer: PriceItem['transfer'] = 'leie'): ItemDef => ({ id, name, unit, transfer });


/** The standard counters and podier (K22), each ready built: its outer size and build. */
const READY = STOCK_COUNTERS.map((s) => {
  const z = stockSize(s);
  const what = s.func === 'podier' ? 'Podie' : 'Bardisk';
  return { s, z, what, b: counterBuildOf({ sections: [...s.sections] }) };
});

/** The profiles a counter built on site is built of (K8), and its boards: the top of every section of Disker og podier,
 *  250 to 1000 c/c each way (K10) (long × short). */
const C = RECIPES.counter;
const COUNTER_PROFILES = [...new Set([...Object.values(C.nodes), C.rail, C.innerRail.code, C.bottomRail])];
const SECTION_CC = [250, 500, 750, 1000];
const COUNTER_BOARDS = [
  ...new Map(
    [
      ...SECTION_CC.flatMap((a) => SECTION_CC.filter((b) => b <= a).flatMap((b) => layoutBuild(C, { cells: [{ x: [0, a], z: [0, b], h: C.top }], open: [] }).boards)),
    ].map((b) => {
      const size = [Math.max(b.w, b.d), Math.min(b.w, b.d)] as const;
      return [size.join('x'), size] as const;
    }),
  ).values(),
];
const WALL_PLATE_M2 = (RECIPES.wall.plate.w * RECIPES.wall.plate.h) / 1e6;

/** A wall module's lengths c/c (Byggeregel V1): whole, and the shorter ones, mm. Rails are c/c − 40, plates c/c − 24. */
const WALL_CC = [1000, 750, 500, 250] as const;
const WALL_SHORT = WALL_CC.filter((cc) => cc < 1000);
const railMm = (cc: number) => cc - 40;
const plateMm = (cc: number) => RECIPES.wall.plate.w - (1000 - cc);
/** Raised wall (Byggeregler V18, V20): the 94 lengths offered, and the upper plate of each module length and raise: as tall as the 94
 *  less the 292 top rail (80), plus 20 into the rails (plates.ts raisePlate). */
const RAISE = RULES.wall.raise.lengths;
const RAISE_RAIL = RECIPES.wall.raise.topRail;
const raisePlateH = (len: number) => len - railHeight(RAISE_RAIL) + (RECIPES.wall.plate.h - RULES.wall.plate.height);
const RAISE_PLATES = WALL_CC.flatMap((cc) => RAISE.map((len) => [plateMm(cc), raisePlateH(len)] as const));

/** Takdrager 292 in every standard length: centres 1–6 m and the half metre joined on (T18), cut 40 shorter, couplings
 *  mounted. */
const BEAM_M = [0.5, 1, 2, 3, 4, 5, 6] as const;
const beamLen = (m: number) => m * 1000 - 40;

export const ITEM_DEFS: readonly ItemDef[] = [
  // Level 2: articles the montør picks
  def(ITEM.post, 'Stolpe 94 med justeringsfot', 'stk'),
  ...WALL_CC.flatMap((cc) => [
    def(ITEM.rail('92', railMm(cc)), `Toppskinne 92, ${railMm(cc)} mm, med 600`, 'stk'),
    def(ITEM.rail('91', railMm(cc)), `Bunnskinne 91, ${railMm(cc)} mm, med 600`, 'stk'),
  ]),
  def(ITEM.plate, 'Veggplate 976 × 2440 mm', 'stk'),
  ...WALL_SHORT.map((cc) => def(ITEM.cutPlate(plateMm(cc)), `Veggplate ${plateMm(cc)} × 2440 mm, kappet`, 'stk')),
  def(ITEM.railCut, 'Kapp av skinne til kort modul', 'stk'),
  def(ITEM.plateCut, 'Kapp av veggplate til kort modul', 'stk'),
  def(ITEM.headerPlate, 'Veggplate, overstykke', 'stk'),
  ...RAISE.map((len) => def(ITEM.raisePost(len), `Stolpeskjøt 94, ${len} mm, med 609`, 'stk')),
  ...WALL_CC.map((cc) => def(ITEM.rail(RAISE_RAIL, railMm(cc)), `Toppskinne ${RAISE_RAIL}, ${railMm(cc)} mm, med 600, hevet vegg`, 'stk')),
  ...RAISE_PLATES.map(([w, h]) => def(ITEM.raisePlate(w, h), `Veggplate ${w} × ${h} mm, øvre felt`, 'stk')),
  def(ITEM.raiseModule, 'Montering per øvre felt, hevet vegg', 'stk'),
  def(ITEM.wire, 'Vaieroppheng med øyebolt M5 og 503', 'stk'),
  def(ITEM.wireMount, 'Montering av vaieroppheng', 'stk'),
  def(ITEM.textileWire, 'Vaieroppheng med gjennomgående øyebolt, tekstilramme', 'stk'),
  def(ITEM.heightMontering, 'Arbeid i høyden, montering, per minutt', 'stk'),
  def(ITEM.heightDemontering, 'Arbeid i høyden, demontering, per minutt', 'stk'),
  def(ITEM.door, 'Dør 292 med lås 410', 'stk'),
  def(ITEM.curtain, 'Forheng', 'stk'),
  ...BEAM_M.map((m) => def(ITEM.beam(beamLen(m)), `Takdrager 292, ${beamLen(m)} mm, med 600`, 'stk')),
  // Braces have no standard length (they follow the textile height): per metre plus per piece (couplings, handling)
  def(ITEM.braceM, 'Støttestag 90, per meter', 'm'),
  def(ITEM.bracePiece, 'Støttestag 90, kobling og håndtering per stk', 'stk'),
  // Level 3 picked directly (textile walls have no article)
  def(ITEM.frameProfileM, '43TX, per meter', 'm'),
  def(ITEM.frameCutM, '43TX kappet til mål, per meter', 'm'),
  def(ITEM.frameCut, 'Kapp av 43TX, per kapp', 'stk'),
  def(ITEM.frameCutSetup, 'Kapptillegg per kappet ramme: bestille, kappe, gjære og merke', 'stk'),
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
  def(ITEM.beamHalf, 'Skjøt 92 × 80 mm stående, halvmeter på takdrager, med montering', 'stk'),
  def(ITEM.frame, 'Håndtering av løse rammedeler per ramme', 'stk'),
  def(ITEM.frameCoupling, 'Montering ramme per kobling', 'stk'),
  def(ITEM.textileEdge, 'Montering tekstil per meter omkrets', 'm'),
  // Shelves: brackets and board picked, the work per shelf and the picking once per order
  def(ITEM.shelfEnd, 'Hylleknekt 91F, 290 mm, med 600', 'stk'),
  def(ITEM.shelfTwin, 'Hylleknekt 91FF, 290 mm, med 600', 'stk'),
  def(ITEM.shelfBoard, 'Hylleplate melamin hvit 18 × 300 × 976 mm', 'stk'),
  def(ITEM.shelfShort, 'Hylleknekt 91, 80 mm, med 600', 'stk'),
  ...railLengths(RULES).map((l) => def(ITEM.shelfRail(l), `Hylleskinne 01, ${l} mm, med 01-kanal-krok`, 'stk')),
  def(ITEM.shelfBoardCorner, 'Hjørne hylleplate 18 × 300 × 960 mm', 'stk'),
  def(ITEM.shelfBoardNarrow, 'Hjørne hylleplate, smal, 18 × 290 × 960 mm', 'stk'),
  def(ITEM.shelfBoardTwoThirds, '2/3 hylleplate 18 × 300 × 655 mm', 'stk'),
  def(ITEM.shelfMount, 'Montering per hylle', 'stk'),
  def(ITEM.shelfPick, 'Vareplukk hyller, per ordre', 'stk'),
  ...READY.flatMap(({ s, z, what }) => [
    def(ITEM.counter(z.length, z.depth, z.h), `${what} ${z.length} × ${z.depth} × ${outerHeight(z.h)} mm, ferdig montert`, 'stk'),
    def(ITEM.counterPlates(z.length, z.depth, z.h), `Platebytte ${what.toLowerCase()} ${s.artnr}, per plate i RAL`, 'stk'),
  ]),
  ...COUNTER_PROFILES.map((code) => def(ITEM.counterProfile(code), `Disk bygget på stedet: profil ${code}, per meter`, 'm')),
  def(ITEM.counterCoupling, 'Disk bygget på stedet: kobling 600', 'stk'),
  def(ITEM.counterInsert, 'Innsats 700 under disk over fotplate', 'stk'),
  def(ITEM.counterPlateM2, 'Disk bygget på stedet: plate 3 mm, per m²', 'm²'),
  ...COUNTER_BOARDS.map(([w, d]) => def(ITEM.counterBoard(w, d), `Disk bygget på stedet: topp- og hylleplate ${w} × ${d} mm`, 'stk')),
  def(ITEM.counterWhole, 'Montering disk per hel meter', 'stk'),
  def(ITEM.counterHalf, 'Montering disk per halv meter', 'stk'),
  def(ITEM.counterCorner, 'Montering disk per hjørne', 'stk'),
  def(ITEM.counterDoor, 'Montering skyvedør i disk', 'stk'),
  def(ITEM.counterShelf, 'Montering hylle i disk', 'stk'),
];

/** Minutes per handling step. Picking, washing and transport of one article; on site up (montering) and down (demontering). */
const pvt = (plukk: number, vask: number, transport: number): Time => ({ plukk, vask, transport });
const onSite = (montering: number, demontering: number): Time => ({ montering, demontering });
/** The time of a counter's whole set of plates, per plate. */
const perPlate = (b: CounterBuild, t: Time): Time => Object.fromEntries(Object.entries(t).map(([k, n]) => [k, Math.round(((n as number) / b.plates.length) * 100) / 100])) as Time;

/**
 * Person-minutes per unit and handling step. Wall and takdrager items are calibrated against three stands Bjørn priced
 * (7.11.2026: corner 4 × 3, row 5 × 3, corner 7 × 4, the exhibitor paying walls and takdrager): about 14 minutes per
 * metre of wall and 2 per metre of takdrager for the whole goods journey. The first estimates were scaled by 0,34 (wall)
 * and 0,15 (takdrager) to get there; the numbers here are the scaled ones, so the number shown is the number used.
 * Items with no time here take none (the per-metre parts of a textile frame: handled per frame).
 */
export const EXAMPLE_TIMES: Readonly<Record<string, Time>> = {
  [ITEM.post]: pvt(0.34, 0.34, 0.34),
  ...Object.fromEntries(WALL_CC.flatMap((cc) => ['92', '91'].map((code) => [ITEM.rail(code, railMm(cc)), pvt(0.17, 0.17, 0.17)]))),
  [ITEM.plate]: pvt(0.34, 1.02, 0.34),
  ...Object.fromEntries(WALL_SHORT.map((cc) => [ITEM.cutPlate(plateMm(cc)), pvt(0.34, 1.02, 0.34)])),
  // Cutting for a shorter module (V1), placeholders agreed with Bjørn 14.11.2026: 2 min a rail, 3 a plate
  [ITEM.railCut]: { forhåndsmontering: 2 },
  [ITEM.plateCut]: { forhåndsmontering: 3 },
  [ITEM.headerPlate]: pvt(0.17, 0.51, 0.17),
  // Raised wall (V18), placeholders until Bjørn gives his: a joined post as a post, the 292 rail as a rail, the upper
  // plate as a wall plate, and an upper felt up and down as a module
  ...Object.fromEntries(RAISE.map((len) => [ITEM.raisePost(len), pvt(0.34, 0.34, 0.34)])),
  ...Object.fromEntries(WALL_CC.map((cc) => [ITEM.rail(RAISE_RAIL, railMm(cc)), pvt(0.17, 0.17, 0.17)])),
  ...Object.fromEntries(RAISE_PLATES.map(([w, h]) => [ITEM.raisePlate(w, h), pvt(0.34, 1.02, 0.34)])),
  [ITEM.raiseModule]: onSite(6.12, 4.08),
  // A ceiling wire (S9, S10), placeholders: picked and carried as a small part, 10 min up and 5 down
  [ITEM.wire]: pvt(0.5, 0.5, 0.5),
  [ITEM.textileWire]: pvt(0.5, 0.5, 0.5),
  [ITEM.wireMount]: onSite(10, 5),
  [ITEM.heightMontering]: onSite(1, 0),
  [ITEM.heightDemontering]: onSite(0, 1),
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
  [ITEM.beamHalf]: { ...pvt(0.08, 0.08, 0.08), ...onSite(0.45, 0.3) },
  [ITEM.frame]: pvt(3, 2, 2),
  // Placeholder until Bjørn has timed a special frame in the workshop
  [ITEM.frameCutSetup]: { forhåndsmontering: 30 },
  [ITEM.frameCoupling]: onSite(2, 1),
  [ITEM.textileEdge]: onSite(4, 2),
  // Bjørn 10.11.2026: direct time per shelf 1,5 min up and 1 min down (also in corners); picking 10 min for the product
  // type and walking per work order are indirect, per order
  [ITEM.shelfMount]: onSite(1.5, 1),
  [ITEM.shelfPick]: { plukk: 10 },
  // A standard counter or podie picked, washed and carried whole, set in place and taken back: as furniture until Bjørn
  // gives its own. Its plates in a wall colour (K6): the coloured plates picked and washed, the swap in the workshop
  // before and after the fair as six plates of a stand wall swap. Eksempeltall until Bjørn gives his
  ...Object.fromEntries(
    READY.flatMap(({ z, b }) => [
      [ITEM.counter(z.length, z.depth, z.h), { ...pvt(1, 2, 2), ...onSite(1, 1) }],
      // The swap of a whole counter (½, 1, 0 and 6, 4 min), shared by its plates
      [ITEM.counterPlates(z.length, z.depth, z.h), perPlate(b, { ...pvt(0.5, 1, 0), ...onSite(6, 4) })],
    ]),
  ),
  // A counter built on site (K9, Bjørn 12.11.2026: 20–30 min on 1 m): placeholders, 24 min in all per whole metre (its
  // parts picked, washed and carried, built up and taken down), about half that for a half, 6 more per corner. With 24 a
  // drawn 1,0 m prices at about the 1320 of the counter in stock (26 before the bottom rail at the back, 26.11.2026)
  [ITEM.counterWhole]: { ...pvt(2, 2, 2), ...onSite(12, 6) },
  [ITEM.counterHalf]: { ...pvt(1, 1, 1), ...onSite(6, 4) },
  [ITEM.counterCorner]: onSite(4, 2),
  // Disker og podier (Bjørn 13.11.2026, placeholders): a sliding door 2 min up and 1 down, a shelf as H7 (1,5 and 1)
  [ITEM.counterDoor]: onSite(2, 1),
  [ITEM.counterShelf]: onSite(1.5, 1),
  // K23: an insert 700 put in and taken out with the counter (placeholder)
  [ITEM.counterInsert]: onSite(0.25, 0.25),
};

const POST_M = RULES.wall.height;
/** A rail of one module: profile cut to cc − post width, with a 600 in each end; priced by its metres of profile, so a
 *  shorter one costs its share of the whole (Bjørn 14.11.2026). */
const rail = (code: string, mm = 960): ItemRecipe => ({ parts: [[code, mm / 1000], ['600', 2]], dg: 'utleie' });
const work: ItemRecipe = { dg: 'arbeid' };

/** What each price item is made of, per unit. Foga parts by code in the list's unit (m or stk), own purchases by
 *  art.nr (src/cost/own-list.ts). Every item has one: an item without a recipe has no cost and shows as missing. */
export const EXAMPLE_RECIPES: Readonly<Record<string, ItemRecipe>> = {
  [ITEM.post]: { parts: [['94', POST_M], ['700', 1], ['M10x65', 1]], dg: 'utleie' },
  ...Object.fromEntries(WALL_CC.flatMap((cc) => ['92', '91'].map((code): [string, ItemRecipe] => [ITEM.rail(code, railMm(cc)), rail(code, railMm(cc))]))),
  [ITEM.plate]: { own: [['HDF-976x2440', 1, 'plate']], dg: 'utleie' },
  // A cut plate is its share of a whole one by width (V1)
  ...Object.fromEntries(WALL_SHORT.map((cc): [string, ItemRecipe] => [ITEM.cutPlate(plateMm(cc)), { own: [['HDF-976x2440', Math.round((plateMm(cc) / RECIPES.wall.plate.w) * 1000) / 1000, 'plate']], dg: 'utleie' }])),
  [ITEM.railCut]: work,
  [ITEM.plateCut]: work,
  // The header over a door or curtain is cut from a plate: about a fifth of it
  [ITEM.headerPlate]: { own: [['HDF-976x2440', 0.2, 'plate']], dg: 'utleie' },
  // Raised wall (V18): the 94 piece by its metres and its 609; the 292 rail with two 600 in each end; the upper plate its
  // share of a whole one by area, no cutting (a stock size, Bjørn 27.11.2026)
  ...Object.fromEntries(RAISE.map((len): [string, ItemRecipe] => [ITEM.raisePost(len), { parts: [['94', len / 1000], ['609', 1]], dg: 'utleie' }])),
  ...Object.fromEntries(WALL_CC.map((cc): [string, ItemRecipe] => [ITEM.rail(RAISE_RAIL, railMm(cc)), { parts: [[RAISE_RAIL, railMm(cc) / 1000], ['600', 4]], dg: 'utleie' }])),
  ...Object.fromEntries(RAISE_PLATES.map(([w, h]): [string, ItemRecipe] => [ITEM.raisePlate(w, h), { own: [['HDF-976x2440', Math.round(((w * h) / (RECIPES.wall.plate.w * RECIPES.wall.plate.h)) * 1000) / 1000, 'plate']], dg: 'utleie' }])),
  [ITEM.raiseModule]: work,
  // The V of wire and the eyebolt are own purchases (placeholders), the 503 Foga's
  [ITEM.wire]: { own: [['VAIER-V', 1, 'accessory'], ['OYEBOLT-M5', 1, 'accessory']], parts: [['503', 1]], dg: 'utleie' },
  [ITEM.textileWire]: { own: [['VAIER-V', 1, 'accessory'], ['OYEBOLT-GJENNOM', 1, 'accessory']], dg: 'utleie' },
  [ITEM.wireMount]: work,
  [ITEM.heightMontering]: work,
  [ITEM.heightDemontering]: work,
  [ITEM.door]: { own: [['DOR-292-410', 1, 'accessory']], dg: 'utleie' },
  [ITEM.curtain]: { own: [['FORHENG', 1, 'accessory']], dg: 'utleie' },
  ...Object.fromEntries(BEAM_M.map((m): [string, ItemRecipe] => [ITEM.beam(beamLen(m)), { parts: [['292', m - 0.04], ['600', 4]], dg: 'utleie' }])),
  [ITEM.foot('750')]: { parts: [['750', 1], ['795', 1]], dg: 'utleie' },
  [ITEM.beamLift]: { parts: [['94', 0.08], ['609', 1]], dg: 'utleie' },
  [ITEM.beamHalf]: { parts: [['92', 0.08]], dg: 'utleie' },
  // Textile walls (kostmotor, tekstil): the frame parts rented out, the textile bought for the job, the work
  [ITEM.frameProfileM]: { parts: [['43TX', 1]], dg: 'utleie' },
  // The cut piece is mostly used up on the job: the DG of what is sold, so a cut costs more by its cut, not threefold
  [ITEM.frameCutM]: { cut: [['43TX', 1]], dg: 'salg' },
  [ITEM.frameCut]: { cuts: 1, dg: 'arbeid' },
  [ITEM.frameCutSetup]: work,
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
  [ITEM.shelfShort]: { parts: [['91', 0.08], ['600', 1]], dg: 'utleie' },
  ...Object.fromEntries(railLengths(RULES).map((l): [string, ItemRecipe] => [ITEM.shelfRail(l), { parts: [['01', l / 1000]], dg: 'utleie' }])),
  [ITEM.shelfBoardCorner]: { own: [['HYLLEPLATE-960x300', 1, 'plate']], dg: 'utleie' },
  [ITEM.shelfBoardNarrow]: { own: [['HYLLEPLATE-960x290', 1, 'plate']], dg: 'utleie' },
  [ITEM.shelfBoardTwoThirds]: { own: [['HYLLEPLATE-655x300', 1, 'plate']], dg: 'utleie' },
  [ITEM.shelfMount]: work,
  [ITEM.shelfPick]: work,
  ...Object.fromEntries(
    READY.flatMap(({ z, b }): [string, ItemRecipe][] => [
      [ITEM.counter(z.length, z.depth, z.h), counterRecipe(b)],
      [ITEM.counterPlates(z.length, z.depth, z.h), { own: [['HDF-976x2440', Math.round((plateShare(b) / b.plates.length) * 1000) / 1000, 'plate']], dg: 'utleie' }],
    ]),
  ),
  ...Object.fromEntries(COUNTER_PROFILES.map((code): [string, ItemRecipe] => [ITEM.counterProfile(code), { parts: [[code, 1]], dg: 'utleie' }])),
  [ITEM.counterCoupling]: { parts: [['600', 1]], dg: 'utleie' },
  [ITEM.counterInsert]: { parts: [['700', 1]], dg: 'utleie' },
  [ITEM.counterPlateM2]: { own: [['HDF-976x2440', Math.round((1 / WALL_PLATE_M2) * 1000) / 1000, 'plate']], dg: 'utleie' },
  ...Object.fromEntries(COUNTER_BOARDS.map(([w, d]): [string, ItemRecipe] => [ITEM.counterBoard(w, d), { own: [[`FIBRAPLAST6-${w}x${d}`, 1, 'plate']], dg: 'utleie' }])),
  [ITEM.counterWhole]: work,
  [ITEM.counterHalf]: work,
  [ITEM.counterCorner]: work,
  [ITEM.counterDoor]: work,
  [ITEM.counterShelf]: work,
};

/** A counter's plates as their share of a whole wall plate, cut from one (K4). */
function plateShare(b: CounterBuild): number {
  const plate = RECIPES.wall.plate;
  return Math.round((b.plates.reduce((s, p) => s + p.w * p.h, 0) / (plate.w * plate.h)) * 1000) / 1000;
}

/** A ready-built counter or podie (Byggeregler K1–K5, K22): its profiles by the metre and the 600, rented out; the
 *  plates as their share of a whole wall plate (cut from one), and its boards. */
function counterRecipe(b: CounterBuild): ItemRecipe {
  const boards = new Map<string, number>();
  for (const x of b.boards) {
    const id = `FIBRAPLAST6-${Math.max(x.w, x.d)}x${Math.min(x.w, x.d)}`;
    boards.set(id, (boards.get(id) ?? 0) + 1);
  }
  return {
    parts: [...Object.entries(profileMetres(b)).map(([code, m]): [string, number] => [code, Math.round(m * 1000) / 1000]), ['600', b.couplings]],
    own: [['HDF-976x2440', plateShare(b), 'plate'], ...[...boards].map(([id, n]): [string, number, 'plate'] => [id, n, 'plate'])],
    dg: 'utleie',
  };
}

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
