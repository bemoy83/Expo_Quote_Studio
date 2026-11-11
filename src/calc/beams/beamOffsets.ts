// Mållinjer for fritt plasserte innvendige takdragere (Byggeregel T15, Bjørn 10.11.2026): from each end of a drawn beam
// off the 1 m grid, along the wall or beam it hangs on, to the nearest fixed point there (a post, or another hook), so the
// montør can measure it out. The plan shows them on the beam being moved or selected, the work order for every one.
import { offGrid } from '../../domain/innerBeams';
import { pointKey } from '../../domain/grid';
import type { Point, Variant } from '../../domain/types';
import type { CalcResult } from '../calc';

export interface BeamOffset {
  beamId: string;
  /** The beam's end, on the wall or beam it hangs on. */
  from: Point;
  /** The nearest post or hook along that wall or beam. */
  to: Point;
  /** Distance, m. */
  length: number;
}

const EPS = 1e-6;

/** The measures of every drawn beam off the grid, or of one (`id`). */
export function beamOffsets(v: Variant, res: Pick<CalcResult, 'posts' | 'hooks' | 'lift'>, id?: string): BeamOffset[] {
  const fixed = [...res.posts, ...res.hooks.map((h) => h.at)];
  const hung = new Set([...res.hooks.map((h) => h.at), ...(res.lift?.walls ?? []), ...(res.lift?.hooks ?? [])].map(pointKey));
  const out: BeamOffset[] = [];
  for (const b of v.innerBeams ?? []) {
    if ((id && b.id !== id) || !offGrid(b)) continue;
    const h = b.from[1] === b.to[1];
    // Across the beam: x for a beam along y, y for one along x
    const ax = h ? 1 : 0;
    for (const e of [b.from, b.to]) {
      if (!hung.has(pointKey(e))) continue;
      let best: Point | null = null;
      for (const p of fixed) {
        if (Math.abs(p[1 - ax] - e[1 - ax]) > EPS || Math.abs(p[ax] - e[ax]) < EPS) continue;
        if (!best || Math.abs(p[ax] - e[ax]) < Math.abs(best[ax] - e[ax])) best = p;
      }
      if (best) out.push({ beamId: b.id, from: e, to: best, length: Math.round(Math.abs(best[ax] - e[ax]) * 1000) / 1000 });
    }
  }
  return out;
}
