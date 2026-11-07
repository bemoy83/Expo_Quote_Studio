// The stands and textile walls a change to the kostgrunnlag is judged by: the three stands Bjørn priced for the
// calibration (7.11.2026, the exhibitor pays walls and takdrager) and free-standing textile walls of 3 to 6 m, the
// catalog's sizes. The Kostgrunnlag page shows price, cost, DG and hours for each, before and after a change, so a new
// number is seen in what it does before it is saved. docs/kostmodell.md.
import type { Catalog } from '../catalog/types';
import type { Variant } from '../domain/types';
import { createVariant } from '../domain/variant';
import type { PricingData } from '../pricing/data';
import type { Rules } from '../rules/rules';
import { calc } from './calc';

export interface ReferenceCase {
  id: string;
  name: string;
  /** What it was calibrated against, shown beside it. */
  target?: string;
  variant: () => Variant;
}

const textile = (w: number): ReferenceCase => ({
  id: `tekstil-${w}`,
  name: `Frittstående tekstilvegg ${w} m`,
  variant: () => ({ ...createVariant('A', { width: 8, depth: 6, type: 'island' }), freeTextiles: [{ id: 'f1', from: [1, 3], to: [1 + w, 3] }] }),
});

export const REFERENCE_CASES: readonly ReferenceCase[] = [
  { id: 'hjorne-4x3', name: 'Hjørne 4 × 3', target: '6 202 kr, 1,84 t', variant: () => createVariant('A', { width: 4, depth: 3, type: 'corner', cornerSide: 'right' }) },
  { id: 'rekke-5x3', name: 'Rekke 5 × 3', target: '9 020 kr, 2,69 t', variant: () => createVariant('A', { width: 5, depth: 3, type: 'row' }) },
  { id: 'hjorne-7x4', name: 'Hjørne 7 × 4', target: '10 230 kr, 3,03 t', variant: () => createVariant('A', { width: 7, depth: 4, type: 'corner', cornerSide: 'right' }) },
  ...[3, 4, 5, 6].map(textile),
];

/** The exhibitor pays every wall: the calibration stands were priced so. */
const EXHIBITOR = { payer: 'utstiller', ral: '9010' } as const;

export interface ReferenceFigures {
  /** Sales sum, kr eks. mva. */
  price: number;
  /** Direct cost of the lines with cost, order cost included. */
  cost: number;
  dg: number;
  /** Person-hours over every step. */
  hours: number;
  /** Lines without cost. */
  unknown: number;
}

/** Price, cost, DG and hours of one case with the given price items. */
export function referenceFigures(c: ReferenceCase, rules: Rules, catalog: Catalog, pricing: PricingData): ReferenceFigures {
  const r = calc(c.variant(), rules, catalog, EXHIBITOR, pricing);
  const minutes = r.groups.flatMap((g) => g.lines).reduce((a, l) => a + Object.values(l.time).reduce((b, m) => b + (m ?? 0), 0), 0);
  return { price: r.sum, cost: r.margin.cost, dg: r.margin.dg, hours: minutes / 60, unknown: r.margin.unknown };
}
