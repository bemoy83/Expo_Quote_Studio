// The numbers the cost engine runs on. One place, so they can be checked and changed without touching the rules.
// Marked per number: Bjørn = confirmed by Bjørn; forslag = a starting value until OMS has history. Kostmodell:
// docs/kostmodell.md.
import type { PartKind } from '../foga/parts';
import type { Currency } from './prices';

/** Yearly change from the year before, e.g. 2023: 0,10 = 10 % up from 2022. */
export type IndexSeries = Readonly<Record<number, number>>;

export interface CostParams {
  /** NOK per unit of the currency. Forslag: SEK 1,00 is a placeholder, not a real rate. */
  rates: Readonly<Record<Currency, number>>;
  /** Freight and duty on top of the purchase price, as a share of it. Bjørn 7.11.2026: maybe 1 700 kr per order
   *  from Foga, not checked; 0 until it is. */
  freightShare: number;
  /** Purchase prices move with this from the list's date. Bjørn's own index (his calculator), as a start. */
  materialIndex: IndexSeries;
  /** The montør's hourly cost moves with this from `labour.baseYear`. */
  labourIndex: IndexSeries;
  /** Owned equipment that is rented out. Storage and upkeep are indirect cost (`indirect`), not counted here. */
  owned: {
    /** Lifetime and use per article group (Foga part kind). Eksempeltall (Bjørn 7.11.2026); OMS gives real ones
     *  later. Uses per year = metres (or pieces) out per year / metres in stock. */
    groups: Readonly<Record<PartKind, OwnedGroup>>;
    /** Interest a year on the money tied up. Charged on the average, half the purchase price, since the value falls
     *  to nothing over the lifetime. Forslag. */
    interest: number;
    /** Share of the purchase price lost or broken beyond repair on one job. Wear is the lifetime. Forslag. */
    lossPerUse: number;
  };
  /** A profile cut to a length outside the range (byggeregel X9). */
  cut: {
    /** Share of the cut piece expected to be used again. Forslag. */
    reuse: number;
    /** Offcut and wrong cuts, a share of the material. Forslag. */
    waste: number;
    /** Person-minutes to measure, cut and deburr one cut. Forslag. */
    minutes: number;
  };
  /** Bought for the job (printed textile, foil, tape): waste, a share of the material. Forslag. */
  boughtWaste: number;
  labour: {
    /** Kr per hour incl. social costs. Bjørn 7.11.2026: 391,40, 2022 level. */
    baseRate: number;
    baseYear: number;
    /** Share of paid hours that can be billed. 1 = the rate already covers it. Forslag. */
    billableShare: number;
    /** Overtime surcharge on the hours that fall on overtime, on the wage. Bjørn 7.11.2026: 100 %. */
    overtimeSurcharge: number;
    /** Share of `baseRate` that is wage; the surcharge is not paid on the rest (social costs). Forslag. */
    wageShare: number;
  };
  /** Indirect cost (admin, premises, storage, vans, management) as one share of direct cost, shown as its own line in
   *  the kalkyle, where DG is counted on direct cost (Bjørn 7.11.2026). What the engine prices carries it in the price
   *  (cost × (1 + indirect) / (1 − DG target)); OMS prices are used as they are. Eksempeltall. */
  indirect: number;
  /** DG target per kind of price item: rented equipment, work, and what is sold. From Bjørn's calculator, as DG: markup
   *  300 % = 75 %, 125 % = 56 %, 30 % = 23 %. Eksempeltall until set per group. */
  dg: Readonly<Record<DgGroup, number>>;
  /** Engangsteppe (roll carpet): internal cost, used only to rank the ways to lay a fill and to show the waste in kr.
   *  Never in the sum: the customer pays laid m². The work is at the montør's hourly cost, the same as for Foga, textile
   *  and furniture (Bjørn 7.11.2026: the same montør lays it). Forslag. */
  carpet: CarpetParams;
  height: {
    /** Above this, mm, a 5-step ladder does not reach and a lift is needed (Bjørn 7.11.2026). */
    limit: number;
    /** Montering minutes for what stands above the limit are multiplied by this. Forslag. */
    factor: number;
    /** Lift rental per day, kr. Not known yet. */
    liftPerDay: number;
  };
}

export interface CarpetParams {
  /** kr per m² taken from the roll. */
  material: number;
  /** kr per lm tape. */
  tapeMaterial: number;
  /** Minutes per m² laid, per lm cut, per lm seam and per lm tape. */
  minLay: number;
  minCut: number;
  minSeam: number;
  minTape: number;
}

/** The carpet rates with the montør's hourly cost for the basis year (pricing/data.ts `pricingFrom`). */
export interface CarpetRates extends CarpetParams {
  /** kr per hour of work. */
  hour: number;
}

export interface OwnedGroup {
  /** Years before it is replaced. */
  lifetimeYears: number;
  /** Times it goes out a year. */
  usesPerYear: number;
}

/** What a price item is, for its DG target. */
export type DgGroup = 'utleie' | 'arbeid' | 'salg';

const index = (from: number, to: number, rate: number) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, rate]));

/** Bjørn's index from his calculator: 2023 +10 %, 2024 +6,7 %, 2025 and 2026 +6 %, then +5 % a year. Material. */
const MATERIAL_INDEX: IndexSeries = { 2023: 0.1, 2024: 0.067, 2025: 0.06, 2026: 0.06, ...index(2027, 2035, 0.05) };
/** Wages move on their own (tariff). Same numbers as material until real ones are set. Eksempeltall. */
const LABOUR_INDEX: IndexSeries = { 2023: 0.1, 2024: 0.067, 2025: 0.06, 2026: 0.06, ...index(2027, 2035, 0.05) };

/** Calibrated 7.11.2026 against three stands Bjørn priced (what is sold today: 765 kr per m wall), with the real
 *  Foga list and the times in pricing/data.ts: profiles and plates 14 uses in their lifetime, couplings, feet and
 *  accessories 25. His calculator had 4 and 10, which made a wall about three times today's price. Textile frame
 *  profiles 4, calibrated against the catalog's textile walls. Replaced every second year (Bjørn 7.11.2026).
 *  docs/kostmodell.md. */
const OWNED_GROUPS: Record<PartKind, OwnedGroup> = {
  profile: { lifetimeYears: 2, usesPerYear: 7 },
  // Textile frame profiles (43TX, 92LTX, 90): 4 uses, as in Bjørn's calculator (slitasjefaktor 4 for 43TX and 90). Cut
  // to size for the job, so fewer reuses than the wall's standard lengths. Example number, to be checked against the
  // stock (Bjørn 7.11.2026)
  frame: { lifetimeYears: 2, usesPerYear: 2 },
  plate: { lifetimeYears: 2, usesPerYear: 7 },
  coupling: { lifetimeYears: 2, usesPerYear: 12.5 },
  foot: { lifetimeYears: 2, usesPerYear: 12.5 },
  accessory: { lifetimeYears: 2, usesPerYear: 12.5 },
};

export const DEFAULT_COST_PARAMS: CostParams = {
  rates: { NOK: 1, SEK: 1 },
  freightShare: 0,
  materialIndex: MATERIAL_INDEX,
  labourIndex: LABOUR_INDEX,
  owned: { groups: OWNED_GROUPS, interest: 0.05, lossPerUse: 0.01 },
  cut: { reuse: 0.25, waste: 0.1, minutes: 5 },
  boughtWaste: 0.05,
  labour: { baseRate: 391.4, baseYear: 2022, billableShare: 1, overtimeSurcharge: 1, wageShare: 0.8 },
  indirect: 0.1,
  dg: { utleie: 3 / 4, arbeid: 1.25 / 2.25, salg: 0.3 / 1.3 },
  carpet: { material: 38, tapeMaterial: 3, minLay: 1.5, minCut: 0.5, minSeam: 1.5, minTape: 0.6 },
  height: { limit: 3000, factor: 1.25, liftPerDay: 0 },
};

/** Per-order costs, counted once per quote (Bjørn 7.11.2026): start-up for printed textile, admin/picking at 10 minutes
 *  for two (Bjørn's calculator), and walking to and from the stand for one montør, 10 minutes each way, at montering
 *  (on the work order) and at demontering (in the cost only), Bjørn 10.11.2026. */
export const ORDER_COSTS = [
  // Bjørn's calculator (7.11.2026): Megaprint start 400 kr (2022), 10 min × 2 men each for admin and delivery
  { id: 'startkost-trykk', name: 'Startkost trykk', cost: 400, baseYear: 2022, when: 'trykk' },
  { id: 'administrasjon', name: 'Administrasjon og vareplukk', personMinutes: 20 },
  { id: 'gange-montering', name: 'Gange til og fra montering', personMinutes: 20, workOrder: true },
  { id: 'gange-demontering', name: 'Gange til og fra demontering', personMinutes: 20 },
] as const;
