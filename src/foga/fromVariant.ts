// Stand sketch → Foga structure. Built from the same derivations as calc (built modules, beam layout, InFrame
// sizes); calc passes its own so the quote, the picking list and the parts list count from one structure.
import { layoutBeams, type BeamLayout } from '../calc/beams';
import { production, type Production } from '../calc/production';
import type { Variant } from '../domain/types';
import { builtModules, wallPoints, type BuiltModule } from '../domain/walls';
import type { Rules } from '../rules/rules';
import type { BomSizes } from './engine';
import type { BeamSpec, FogaStructure } from './structure';

export interface Derived {
  mods: BuiltModule[];
  /** Wall posts and posts that only carry takdrager. */
  posts: number;
  beams: BeamLayout;
  production: Production;
  /** Plates swapped into stand walls the organiser builds. */
  swaps?: string[];
}

/** Takdrager lengths, post centre to post centre, mm. */
export const beamSpecs = (b: BeamLayout): BeamSpec[] => b.segments.map((s) => ({ lengthMm: Math.round(s.length * 1000) }));

export function structureOf(d: Derived): FogaStructure {
  return {
    posts: d.posts,
    modules: d.mods.map((m) => ({ plate: m.plate, opening: !!m.opening })),
    beams: beamSpecs(d.beams),
    frames: d.production.pieces.map((p) => ({ pos: p.pos, W: p.W, H: p.H, braces: p.braces })),
    ...(d.swaps?.length ? { swaps: d.swaps } : {}),
  };
}

/** Everything drawn, as if the exhibitor builds it all (no stand walls left to the organiser). */
export function fromVariant(v: Variant, rules: Rules): FogaStructure {
  const mods = builtModules(v);
  const points = wallPoints(mods);
  const beams = layoutBeams(v.stand, new Set(mods.map((m) => m.key)), points, rules.beam.max);
  const posts = new Set([...points.keys(), ...beams.posts.keys()]).size;
  return structureOf({ mods, posts, beams, production: production(v, rules.textile.inFrame, '') });
}

/** Sizes from the rules, mm: post = system wall height without feet (2490), cc 1000. */
export const bomSizes = (rules: Rules): BomSizes => ({ postLength: Math.round(rules.wall.height * 1000), cc: Math.round(rules.wall.cc * 1000) });
