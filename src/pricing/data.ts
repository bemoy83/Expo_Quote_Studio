// Example price list (Bjørn 31.10.2026: example prices for now). In the real setup the OMS computes these from its
// cost model (docs/prismodell.md) and the app only reads them. Every number here is made up.
// Change numbers here, never in calc code.
import type { PriceItem, PriceList, Transfer } from './model';

const item = (id: string, name: string, unit: PriceItem['unit'], cost: number, price: number, hours = 0, transfer: Transfer = 'leie'): PriceItem => ({
  id,
  name,
  unit,
  cost,
  price,
  transfer,
  ...(hours ? { hours } : {}),
});

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
  corner: '613',
  wallFixing: '520',
  print: 'trykk',
  module: 'montering-modul',
  beamLm: 'montering-takdrager',
  beamPost: 'montering-takdragerstolpe',
  frame: 'handtering-ramme',
  textileM2: 'montering-tekstil',
} as const;

// Takdrager 292 in every standard length (centres 1–6 m, cut 40 shorter), couplings mounted
const beams = [1, 2, 3, 4, 5, 6].map((m) => {
  const len = m * 1000 - 40;
  return item(ITEM.beam(len), `Takdrager 292, ${len} mm, med 600`, 'stk', 8 + 7 * m, 25 + 20 * m, 0.05);
});

const ITEMS: PriceItem[] = [
  // Level 2: articles the montør picks (cost incl. plukk, vask, transport)
  item(ITEM.post, 'Stolpe 94 med justeringsfot', 'stk', 45, 80, 0.05),
  item(ITEM.rail('92', 960), 'Toppskinne 92, 960 mm, med 600', 'stk', 18, 35, 0.025),
  item(ITEM.rail('91', 960), 'Bunnskinne 91, 960 mm, med 600', 'stk', 17, 35, 0.025),
  item(ITEM.plate, 'Veggplate 976 × 2440 mm', 'stk', 85, 150, 0.08),
  item(ITEM.headerPlate, 'Veggplate, overstykke', 'stk', 30, 55, 0.04),
  item(ITEM.door, 'Dør 292 med lås 410', 'stk', 180, 450, 0.12),
  item(ITEM.curtain, 'Forheng', 'stk', 140, 260, 0.12),
  ...beams,
  // Braces have no standard length (they follow the textile height): per metre plus per piece (couplings, handling)
  item(ITEM.braceM, 'Støttestag 90, per meter', 'm', 2, 6),
  item(ITEM.bracePiece, 'Støttestag 90, kobling og håndtering per stk', 'stk', 10, 20, 0.02),
  // Level 3 picked directly (textile walls have no article)
  item(ITEM.frameProfileM, '43TX, per meter', 'm', 4, 10),
  item(ITEM.corner, '613 hjørnekobling', 'stk', 1.5, 4),
  item(ITEM.wallFixing, '520 brakett', 'stk', 2, 5),
  item(ITEM.print, 'Trykt tekstil med silikonkant, per m²', 'm²', 260, 470, 0, 'salg'),
  // Handling that belongs to the product (montering on site, up and down), at the montør's rate
  item(ITEM.module, 'Montering per veggmodul', 'stk', 325, 590, 0.5),
  item(ITEM.beamLm, 'Montering takdrager per meter', 'm', 98, 175, 0.15),
  item(ITEM.beamPost, 'Montering takdragerstolpe', 'stk', 163, 295, 0.25),
  item(ITEM.frame, 'Håndtering av løse rammedeler per ramme', 'stk', 80, 140, 0.12),
  item(ITEM.textileM2, 'Montering tekstil per m²', 'm²', 228, 380, 0.35),
];

export interface PricingData {
  items: PriceList;
  /** By product id: what the quote tells the customer when a product is part rental, part sale. */
  terms: Record<string, string>;
}

export const DEFAULT_PRICING: PricingData = {
  items: new Map(ITEMS.map((x) => [x.id, x])),
  terms: { '8000': 'Leie av ramme, kjøp av trykt tekstil' },
};
