// Walls per metre: the exhibitor's stand walls, then inner and room walls, each per colour. The organiser's stand walls,
// when it pays them, are a line of their own for the organiser.
import { ITEM } from '../../pricing/data';
import { countBy, toOrganiser, type CalcContext } from '../context';
import type { CalcLine } from '../types';

/** Wall per metre in one colour. A module with a door or curtain is never wall: it is in the opening product. */
function wallLine(c: CalcContext, ral: string, n: number, meta: string, postShare = c.ourShare): CalcLine {
  const hit = c.idx.wallByRal.get(ral);
  const uses = [{ id: ITEM.plate, qty: n }, ...c.moduleUses(n, postShare)];
  const extra = { ...c.built, meta: `${meta} · RAL ${ral}` };
  return hit ? c.line(hit.variant.artnr, n * c.rules.wall.cc, extra, uses) : c.line(`${c.sys.wall}-${ral}`, n * c.rules.wall.cc, { ...extra, group: 'vegg.vegger' }, uses);
}

export function wallLines(c: CalcContext): CalcLine[] {
  const ourWalled = c.ours.filter((m) => !m.opening);
  return [true, false].flatMap((stand) => {
    const byRal = countBy(ourWalled.filter((m) => (c.kindOf(m) === 'stand') === stand).map((m) => m.plate));
    return [...byRal].map(([ral, n]) => wallLine(c, ral, n, stand ? 'Standvegg' : 'Innervegg'));
  });
}

/** The organiser's stand walls, in the organiser's colour, on their own posts. */
export function organiserWallLines(c: CalcContext): CalcLine[] {
  const { theirs, theirPoints, standWalls } = c;
  return theirs.length ? [toOrganiser(wallLine(c, standWalls.ral, theirs.length, 'Standvegg', c.share(theirPoints.size, theirs.length)))] : [];
}
