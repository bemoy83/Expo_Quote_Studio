// Shelves (hylle 6311): one line, the same price per shelf alone or in a row (Bjørn 8.11.2026). Its cost is the brackets
// as counted (end 91F, twin 91FF between two boards), the boards, the work per shelf, and picking once for the order.
// The picking list shows the brackets and boards (foga/engine.ts). Byggeregler H2, H7 (docs/byggeregler.md).
import { shelfBrackets } from '../../domain/shelves/brackets';
import { ITEM } from '../../pricing/data';
import type { CalcContext } from '../context';
import type { CalcLine } from '../types';

export function shelfLines(c: CalcContext): CalcLine[] {
  const { boards, end, twin } = shelfBrackets(c.v);
  if (!boards) return [];
  return [
    c.line(c.sys.shelf, boards, c.built, [
      { id: ITEM.shelfEnd, qty: end },
      { id: ITEM.shelfTwin, qty: twin },
      { id: ITEM.shelfBoard, qty: boards },
      { id: ITEM.shelfMount, qty: boards },
      { id: ITEM.shelfPick, qty: 1 },
    ]),
  ];
}
