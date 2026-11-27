// Work above the height limit (cost rule 6, Bjørn 7.11 and 27.11.2026): montering and demontering up there take `factor`
// times as long. The extra minutes go on the line as price items of their own, so the cost, the engine's price and the
// work order's time all follow, and the lift (`liftCost` in summary.ts) is rented for the same time. Any line whose work
// reaches above the limit uses it: raised walls and their wires now, tall textile and snekkervegger later.
import { heightExtra, needsLift } from '../cost/model';
import { ITEM } from '../pricing/data';
import type { Use } from '../pricing/model';
import type { CalcContext } from './context';

/** The uses of work reaching `top` mm, with the extra minutes of montering and demontering when that is over the limit. */
export function atHeight(c: CalcContext, uses: Use[], top: number): Use[] {
  const h = c.pricing.height;
  if (!needsLift(top, h)) return uses;
  let up = 0;
  let down = 0;
  for (const u of uses) {
    const t = c.pricing.items.get(u.id)?.time;
    up += (t?.montering ?? 0) * u.qty;
    down += (t?.demontering ?? 0) * u.qty;
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return [...uses, { id: ITEM.heightMontering, qty: r(heightExtra(up, h)) }, { id: ITEM.heightDemontering, qty: r(heightExtra(down, h)) }];
}
