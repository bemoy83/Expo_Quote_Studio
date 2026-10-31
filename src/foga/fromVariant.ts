// Stand sketch → Foga structure. Reuses the same derivations as calc (built modules, beam layout, InFrame sizes),
// so the parts list and the quote always describe the same stand.
import { layoutBeams } from '../calc/beams';
import { production } from '../calc/production';
import { pointKey } from '../domain/grid';
import type { Variant } from '../domain/types';
import { builtModules, wallPoints } from '../domain/walls';
import type { Rules } from '../rules/rules';
import type { FogaStructure, PostSpec } from './structure';

export function fromVariant(v: Variant, rules: Rules): FogaStructure {
  const mods = builtModules(v);
  const points = wallPoints(mods);
  const beams = layoutBeams(v.stand, new Set(mods.map((m) => m.key)), points, rules.beam.max);

  // Arms per wall point, and whether two of them meet at a right angle
  const arms = new Map<string, { h: number; v: number }>();
  for (const m of mods)
    for (const p of [m.a, m.b]) {
      const k = pointKey(p);
      const a = arms.get(k) ?? { h: 0, v: 0 };
      a[m.orientation]++;
      arms.set(k, a);
    }
  const posts: PostSpec[] = [...points.keys()].map((key) => {
    const a = arms.get(key) ?? { h: 0, v: 0 };
    return { key, arms: a.h + a.v, corner: a.h === 1 && a.v === 1, beamOnly: false };
  });
  for (const key of beams.posts.keys()) if (!points.has(key)) posts.push({ key, arms: 0, corner: false, beamOnly: true });

  const prod = production(v, rules.textile.inFrame, '');
  return {
    posts,
    modules: mods.map((m) => ({ key: m.key, plate: m.opening ? null : m.plate, opening: m.opening?.product ?? null })),
    beams: beams.segments.map((s) => ({ lengthMm: Math.round(s.length * 1000) })),
    frames: prod.pieces.map((p) => ({ pos: p.pos, W: p.W, H: p.H, braces: p.braces })),
  };
}
