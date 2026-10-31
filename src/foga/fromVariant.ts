// Stand sketch → Foga structure. Reuses the same derivations as calc (built modules, beam layout, InFrame sizes),
// so the parts list and the quote always describe the same stand.
import { layoutBeams } from '../calc/beams';
import { production } from '../calc/production';
import type { Variant } from '../domain/types';
import { builtModules, wallPoints } from '../domain/walls';
import type { Rules } from '../rules/rules';
import type { FogaStructure, PostSpec } from './structure';

export function fromVariant(v: Variant, rules: Rules): FogaStructure {
  const mods = builtModules(v);
  const points = wallPoints(mods);
  const beams = layoutBeams(v.stand, new Set(mods.map((m) => m.key)), points, rules.beam.max);

  const posts: PostSpec[] = [...points.keys()].map((key) => ({ key, beamOnly: false }));
  for (const key of beams.posts.keys()) if (!points.has(key)) posts.push({ key, beamOnly: true });

  const prod = production(v, rules.textile.inFrame, '');
  const byId = new Map(v.textiles.map((t) => [t.id, t]));
  return {
    posts,
    modules: mods.map((m) => ({ key: m.key, plate: m.opening ? null : m.plate, opening: m.opening?.product ?? null })),
    beams: beams.segments.map((s) => ({ lengthMm: Math.round(s.length * 1000) })),
    frames: prod.pieces.map((p) => {
      const t = byId.get(p.textileId)!;
      const end = t.from + t.width;
      const joinedToNext = v.textiles.some((o) => o !== t && o.wallId === t.wallId && (o.side ?? 1) === (t.side ?? 1) && Math.abs(o.from - end) < 1e-6);
      return { pos: p.pos, W: p.W, H: p.H, braces: p.braces, joinedToNext };
    }),
  };
}

/** Sizes from the rules, mm: post = system wall height without feet (2490), cc 1000. */
export const bomSizes = (rules: Rules) => ({ postLength: Math.round(rules.wall.height * 1000), cc: Math.round(rules.wall.cc * 1000) });
