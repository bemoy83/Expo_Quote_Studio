// Stand sketch → Foga structure. Reuses the same derivations as calc (built modules, beam layout, InFrame sizes),
// so the parts list and the quote always describe the same stand.
import { layoutBeams } from '../calc/beams';
import { production } from '../calc/production';
import type { Variant } from '../domain/types';
import { builtModules, wallPoints } from '../domain/walls';
import type { Rules } from '../rules/rules';
import type { BomSizes } from './engine';
import type { FogaStructure } from './structure';

export function fromVariant(v: Variant, rules: Rules): FogaStructure {
  const mods = builtModules(v);
  const points = wallPoints(mods);
  const beams = layoutBeams(v.stand, new Set(mods.map((m) => m.key)), points, rules.beam.max);
  const posts = new Set([...points.keys(), ...beams.posts.keys()]);
  return {
    posts: posts.size,
    modules: mods.map((m) => ({ plate: m.plate, opening: !!m.opening })),
    beams: beams.segments.map((s) => ({ lengthMm: Math.round(s.length * 1000) })),
    frames: production(v, rules.textile.inFrame, '').pieces.map((p) => ({ W: p.W, H: p.H, braces: p.braces })),
  };
}

/** Sizes from the rules, mm: post = system wall height without feet (2490), cc 1000. */
export const bomSizes = (rules: Rules): BomSizes => ({ postLength: Math.round(rules.wall.height * 1000), cc: Math.round(rules.wall.cc * 1000) });
