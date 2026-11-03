// Plate swap: the plate in the exhibitor's colour, swapped into the organiser's stand wall (docs/vegger.md).
import { ITEM } from '../../pricing/data';
import { countBy, type CalcContext } from '../context';
import type { CalcLine } from '../types';

export function swapLines(c: CalcContext): CalcLine[] {
  return [...countBy(c.swaps)].map(([ral, n]) =>
    c.line(`${c.sys.plateSwap}-${ral}`, n * c.rules.wall.cc, { ...c.built, meta: `i standvegg · RAL ${ral}` }, [
      { id: ITEM.plate, qty: n },
      { id: ITEM.plateSwap, qty: n },
    ]),
  );
}
