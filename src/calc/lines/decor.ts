// Foil (decal within one plate, and full plate) and print setup: one motif stretched over several plates (paint
// bucket with «Print»), where the file is fitted and cut per plate. A counter of Disker og podier (Byggeregel K20): its
// print on its own article by the m² of the plates and doors it covers, with the sizes cut (Bjørn 13.11.2026), its
// decals on the decal line by their m², a setup per print stretched over more than one part.
import { podiumDecorAreas } from '../../domain/podiumDecor';
import { lockedParts } from '../../domain/podiumLocks';
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

/** Print and decals on the counters of Disker og podier, as they stand (a part against a wall is a plate, K16). */
export function podiumFoil(c: CalcContext): { decal: number; full: number; parts: number; runs: number; sizes: Map<string, number> } {
  const out = { decal: 0, full: 0, parts: 0, runs: 0, sizes: new Map<string, number>() };
  for (const o of c.v.objects) {
    if (!o.sections?.some((s) => s.sides)) continue;
    const a = podiumDecorAreas(o.sections, new Set(lockedParts(c.v, c.place, o)));
    out.decal += a.decal;
    out.full += a.full;
    out.parts += a.parts;
    out.runs += a.runs;
    for (const [k, n] of a.sizes) out.sizes.set(k, (out.sizes.get(k) ?? 0) + n);
  }
  return out;
}

/** «2 × 960 × 960 mm · 1 × 460 × 960 mm», largest first. */
const diskSizes = (sizes: Map<string, number>) =>
  [...sizes]
    .sort(([a], [b]) => area(b) - area(a))
    .map(([k, n]) => `${n} × ${k} mm`)
    .join(' · ');
const area = (k: string) => k.split(' × ').reduce((a, n) => a * Number(n), 1);

export function decorLines(c: CalcContext): CalcLine[] {
  const { rules, sys } = c;
  const plateSize = `${rules.wall.plate.width} × ${rules.wall.plate.height} mm`;
  const foil = foilAreas(c);
  const disk = podiumFoil(c);
  const runs = [...stretchedRuns(c.v).values()];
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const and = (s: string, extra: string | false) => [s, extra].filter(Boolean).join(' · ');
  return [
    c.line(sys.foil, r3(foil.decal + disk.decal), { meta: and(foil.decal > 0 || !disk.decal ? 'innenfor ett veggfelt' : '', disk.decal > 0 && 'dekal på disk') }),
    c.line(sys.foilFull, r3(foil.full), { meta: foil.fullCount ? `${foil.fullCount} felt · ${plateSize}` : '' }),
    c.line(sys.foilCounter, r3(disk.full), { meta: diskSizes(disk.sizes) }),
    c.line(sys.printSetup, runs.length + disk.runs, { meta: [...runs.map((r) => `${r.length} plater`), ...(disk.runs ? [`${disk.runs} på disk`] : [])].join(' · ') }),
  ];
}
