// Shelves (hylle 6311): one line, the same price per shelf alone, in a row or in a corner (Bjørn 8.11.2026, 10.11.2026).
// Its cost is the brackets as counted (end 91F, twin 91FF between two boards), in corners the short 91 and the 01 rails,
// the boards by kind, the work per shelf, and picking once for the order. The picking list shows the brackets, rails and
// boards (foga/engine.ts). Byggeregler H2, H7, H10, H11, H12 (docs/byggeregler.md).
import { shelfBrackets } from '../../domain/shelves/brackets';
import { ITEM } from '../../pricing/data';
import type { CalcContext } from '../context';
import type { CalcLine } from '../types';

export function shelfLines(c: CalcContext): CalcLine[] {
  const { boards, kinds, end, twin, short, rails } = shelfBrackets(c.v, c.rules);
  if (!boards) return [];
  const k = kinds ?? { standard: boards };
  return [
    c.line(c.sys.shelf, boards, c.built, [
      { id: ITEM.shelfEnd, qty: end },
      { id: ITEM.shelfTwin, qty: twin },
      { id: ITEM.shelfShort, qty: short ?? 0 },
      ...Object.entries(rails ?? {}).map(([l, qty]) => ({ id: ITEM.shelfRail(Number(l)), qty })),
      { id: ITEM.shelfBoard, qty: k.standard ?? 0 },
      { id: ITEM.shelfBoardCorner, qty: k.corner ?? 0 },
      { id: ITEM.shelfBoardNarrow, qty: k.narrow ?? 0 },
      { id: ITEM.shelfBoardTwoThirds, qty: k.twoThirds ?? 0 },
      { id: ITEM.shelfMount, qty: boards },
      { id: ITEM.shelfPick, qty: 1 },
    ]),
  ];
}
