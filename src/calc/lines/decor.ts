// Foil (decal within one plate, and full plate) and print setup: one motif stretched over several plates (paint
// bucket with «Print»), where the file is fitted and cut per plate.
import { stretchedRuns } from '../../domain/print';
import type { CalcContext } from '../context';
import type { CalcLine } from '../types';

/** Foil m², decal and full plate, for the lines and the key figures. */
export function foilAreas(c: CalcContext): { decal: number; full: number; fullCount: number } {
  const { v, rules } = c;
  const wallIds = new Set(v.walls.map((w) => w.id));
  const fullFelt = (rules.wall.plate.width * rules.wall.plate.height) / 1e6;
  const foils = v.foils.filter((f) => wallIds.has(f.wallId));
  const fullCount = foils.filter((f) => f.full).length;
  return { decal: foils.filter((f) => !f.full).reduce((a, f) => a + f.width * f.height, 0), full: fullCount * fullFelt, fullCount };
}

export function decorLines(c: CalcContext): CalcLine[] {
  const { rules, sys } = c;
  const plateSize = `${rules.wall.plate.width} × ${rules.wall.plate.height} mm`;
  const foil = foilAreas(c);
  const runs = [...stretchedRuns(c.v).values()];
  return [
    c.line(sys.foil, foil.decal, { meta: 'innenfor ett veggfelt' }),
    c.line(sys.foilFull, foil.full, { meta: `${foil.fullCount} felt · ${plateSize}` }),
    c.line(sys.printSetup, runs.length, { meta: runs.map((r) => `${r.length} plater`).join(' · ') }),
  ];
}
