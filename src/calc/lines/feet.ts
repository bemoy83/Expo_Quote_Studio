// Støtteplater, per piece: the plate and putting it on. Under walls that stand free and under drawn takdrager's own
// posts (calc/wallSupports.ts, calc/beams/innerBeams.ts), always the exhibitor's.
import { fogaPart } from '../../foga/parts';
import { RECIPES } from '../../foga/recipes';
import { ITEM } from '../../pricing/data';
import { raiseTop } from '../../rules/rules';
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

/** Ceiling wires on raised walls (Byggeregler S9, S10): per V, always the exhibitor's. */
export function wireLines(c: CalcContext): CalcLine[] {
  const n = c.wires.length;
  if (!n || !c.sys.wallWire) return [];
  // Hung from the top of the highest raised wall: worked from the lift (cost rule 6)
  const top = Math.max(...c.mods.map((m) => (m.raise ? raiseTop(m.raise.len, c.rules) : 0)));
  const line = c.line(c.sys.wallWire, n, { ...c.built, meta: 'hevet vegg' }, [
    { id: ITEM.wire, qty: n },
    { id: ITEM.wireMount, qty: n },
  ]);
  return [{ ...line, top }];
}
