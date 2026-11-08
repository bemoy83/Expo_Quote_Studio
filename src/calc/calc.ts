// The calculation of one variant: the quote lines (level 1), their cost and margin, and the key figures. Each product's
// lines are a block of their own (calc/lines/*, calc/textile/lines.ts) on a shared context (calc/context.ts), run here in
// the order the quote shows them; calc/summary.ts adds groups, margin, time, key figures and the BOM.
import type { Catalog } from '../catalog/types';
import type { StandWallTerms, Variant } from '../domain/types';
import { DEFAULT_STAND_WALLS } from '../domain/variant';
import { DEFAULT_PRICING, type PricingData } from '../pricing/data';
import type { Rules } from '../rules/rules';
import { calcContext } from './context';
import { beamLiftLines, beamLines } from './lines/beams';
import { decorLines } from './lines/decor';
import { doorLines } from './lines/doors';
import { footLines } from './lines/feet';
import { floorLines } from './lines/floor';
import { looseLines, objectLines } from './lines/objects';
import { swapLines } from './lines/swaps';
import { shelfLines } from './lines/shelves';
import { organiserWallLines, wallLines } from './lines/walls';
import { summary } from './summary';
import { frameLines, textileWallLines } from './textile/lines';
import type { CalcLine, CalcResult } from './types';

export type { CalcGroup, CalcLine, CalcResult, KeyFigures, Margin } from './types';

/** Pure: the quote lines, their cost and margin, and the key figures of one variant. `standWalls`: who pays the stand
 *  walls (from the project). */
export function calc(v: Variant, rules: Rules, catalog: Catalog, standWalls: StandWallTerms = DEFAULT_STAND_WALLS, pricing: PricingData = DEFAULT_PRICING): CalcResult {
  const c = calcContext(v, rules, catalog, standWalls, pricing);
  // Level 1 only: what the customer buys. The articles behind wall, takdrager and textile (plates, posts, rails,
  // profiles) are on the picking list, counted from the same Foga structure; `foga` marks the lines they replace there.
  // Each line's cost is the sum of what is actually built for it. A line with nothing in it is left out.
  const beams = beamLines(c);
  const lines: CalcLine[] = [
    ...wallLines(c),
    ...footLines(c),
    ...swapLines(c),
    ...beams.lines,
    ...beamLiftLines(c),
    ...doorLines(c),
    ...frameLines(c),
    ...textileWallLines(c),
    ...decorLines(c),
    ...shelfLines(c),
    ...floorLines(c),
    ...objectLines(c),
    ...looseLines(c),
  ].filter((l) => l.qty > 0);
  // The organiser's stand walls, then its takdrager (it pays them when they follow its stand walls)
  return summary(c, lines, [...organiserWallLines(c), ...beams.organiser]);
}
