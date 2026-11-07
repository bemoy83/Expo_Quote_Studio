// The numbers the cost engine runs on. One place, so they can be checked and changed without touching the rules.
// Marked per number: Bjørn = confirmed by Bjørn; forslag = a starting value until OMS has history. Kostmodell:
// docs/kostmodell.md.
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
  /** Owned equipment that is rented out. */
  owned: {
    /** Years before it is replaced. Bjørn 7.11.2026: say every second year. */
    lifetimeYears: number;
    /** Times it goes out a year. Forslag, until OMS has history. */
    usesPerYear: number;
    /** Interest on the money tied up, a share of the purchase price per year. Forslag. */
    interest: number;
    /** Damage and loss, a share of the purchase price per year. Forslag. */
    damage: number;
    /** Storage and upkeep per unit and year, kr. Forslag: not known yet. */
    storagePerYear: number;
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
    /** Overtime surcharge on the hours that fall on overtime. Bjørn 7.11.2026: 100 %. */
    overtimeSurcharge: number;
  };
  height: {
    /** Above this, mm, a 5-step ladder does not reach and a lift is needed (Bjørn 7.11.2026). */
    limit: number;
    /** Montering minutes for what stands above the limit are multiplied by this. Forslag. */
    factor: number;
    /** Lift rental per day, kr. Not known yet. */
    liftPerDay: number;
  };
}

const index = (from: number, to: number, rate: number) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, rate]));

/** Bjørn's index from his calculator: 2023 +10 %, 2024 +6,7 %, 2025 and 2026 +6 %, then +5 % a year. */
const BJORN_INDEX: IndexSeries = { 2023: 0.1, 2024: 0.067, 2025: 0.06, 2026: 0.06, ...index(2027, 2035, 0.05) };

export const DEFAULT_COST_PARAMS: CostParams = {
  rates: { NOK: 1, SEK: 1 },
  freightShare: 0,
  materialIndex: BJORN_INDEX,
  labourIndex: BJORN_INDEX,
  owned: { lifetimeYears: 2, usesPerYear: 10, interest: 0.05, damage: 0.05, storagePerYear: 0 },
  cut: { reuse: 0.25, waste: 0.1, minutes: 5 },
  boughtWaste: 0.05,
  labour: { baseRate: 391.4, baseYear: 2022, billableShare: 1, overtimeSurcharge: 1 },
  height: { limit: 3000, factor: 1.25, liftPerDay: 0 },
};

/** Per-order costs from Bjørn's calculator, counted once per quote (Bjørn 7.11.2026): start-up for printed textile,
 *  and admin/picking and delivery out and in at 10 minutes for two. */
export const ORDER_COSTS = [
  { id: 'startkost-trykk', name: 'Startkost trykk, per ordre', cost: 500, baseYear: 2022 },
  { id: 'administrasjon', name: 'Administrasjon og vareplukk', personMinutes: 20 },
  { id: 'transport', name: 'Varelevering ut og inn', personMinutes: 20 },
] as const;
