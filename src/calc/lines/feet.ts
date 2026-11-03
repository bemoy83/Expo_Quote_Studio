// Støtteplater, per piece: the plate and putting it on. Under walls that stand free and under drawn takdrager's own
// posts (calc/wallSupports.ts, calc/innerBeams.ts), always the exhibitor's.
import { fogaPart } from '../../foga/parts';
import { RECIPES } from '../../foga/recipes';
import { ITEM } from '../../pricing/data';
import type { CalcContext } from '../context';
import type { CalcLine } from '../types';

export function footLines(c: CalcContext): CalcLine[] {
  const { wallFeet, freeWallFeet } = c;
  const foot = RECIPES.wall.support.foot;
  const heldFree = [...(freeWallFeet.length ? ['vegg'] : []), ...(c.beams.inner.feet.length ? ['takdrager'] : [])].join(' og ');
  return [
    c.line(c.sys.wallSupport, wallFeet.length, { ...c.built, meta: `${fogaPart(foot.code).name} · frittstående ${heldFree}` }, [
      { id: ITEM.foot(foot.code), qty: wallFeet.length },
      { id: ITEM.wallFootMount, qty: wallFeet.length },
    ]),
  ];
}
