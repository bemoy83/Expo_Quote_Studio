// Shelves (hylle 6311): filling a whole face from the wall drawer's «Hyller og heng» (Bjørn 9.11.2026), «+ Hylle» felt
// by felt and row by row, «+ Hyllerad» a row at a time. Nothing gets chosen. Byggeregler H2, H5, H6.
import type { Rules } from '../../rules/rules';
import type { FaceSide } from '../faces';
import { fittingFelts } from '../fittings';
import type { Variant } from '../types';
import { fillHeights, fitsIn, putShelf } from './model';

/** The heights a face is filled at, row by row: the start height, then the one order of H4 from it (fillHeights), with
 *  the gaps between the ladder's heights split last, as in a felt. */
const rowHeights = (rules: Rules) => {
  const sh = rules.shelf;
  const ladder = [sh.min, ...sh.heights];
  return [sh.start, ...fillHeights(rules, sh.start, ladder)];
};

/**
 * «+ Hylle» for a whole face in the wall drawer (Bjørn 9.11.2026): felt by felt, row by row. The next shelf of the row
 * being filled (the start height first, then the order of H4, rowHeights), in the felt nearest the middle
 * that has room there (H5). So pressing on fills the wall as «+ Hyllerad» does, one shelf at a time. The id, or why not.
 */
export function addShelfToFace(v: Variant, rules: Rules, wallId: string, s: FaceSide): { v: Variant; id: string } | { error: string } {
  const felts = fittingFelts(v, wallId, s);
  if (!felts.length) return { error: 'Ingen felt på denne siden kan ta hylle' };
  for (const y of rowHeights(rules)) {
    const m = felts.find((x) => fitsIn(v, rules, wallId, x, s, y));
    if (m === undefined) continue;
    return putShelf(v, rules, wallId, m, s, y);
  }
  return { error: 'Ingen plass til flere hyller på denne siden' };
}

/**
 * «+ Hyllerad» for a whole face (Bjørn 9.11.2026): one shelf in every felt that can take one, all at one height. The
 * start height first, then the order of H4 (rowHeights); the first height every such felt has room at
 * (H5), else the one most felts have room at. So pressing on fills the wall row by row. The new shelves, or why not.
 */
export function addShelfRowToFace(v: Variant, rules: Rules, wallId: string, s: FaceSide): { v: Variant; ids: string[] } | { error: string } {
  const felts = fittingFelts(v, wallId, s);
  if (!felts.length) return { error: 'Ingen felt på denne siden kan ta hylle' };
  let best: { y: number; at: number[] } | null = null;
  for (const y of rowHeights(rules)) {
    const at = felts.filter((m) => fitsIn(v, rules, wallId, m, s, y));
    if (at.length > (best?.at.length ?? 0)) best = { y, at };
    if (at.length === felts.length) break;
  }
  if (!best) return { error: 'Ingen plass til flere hyller på denne siden' };
  let x = v;
  const ids: string[] = [];
  for (const m of [...best.at].sort((a, b) => a - b)) {
    const r = putShelf(x, rules, wallId, m, s, best.y);
    x = r.v;
    ids.push(r.id);
  }
  return { v: x, ids };
}
