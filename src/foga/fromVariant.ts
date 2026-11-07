// Stand sketch → Foga structure. Built from the same derivations as calc (built modules, beam layout, InFrame
// sizes); calc passes its own so the quote, the picking list and the parts list count from one structure.
// Byggeregel P3 (docs/byggeregler.md).
import { liftBeams } from '../calc/beamLift';
import { variantBeams, type BeamLayout } from '../calc/beams';
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
  /** Ends of drawn takdrager hanging on another beam. */
  hooks?: number;
  /** Takdrager lifted over a textile wall: posts extended and mixed-level hook points. */
  lift?: { posts: number; hooks: number };
  production: Production;
  /** Plates swapped into stand walls the organiser builds. */
  swaps?: string[];
  /** Støtteplater under free-standing system walls, and how many of them stand under a post in `posts`. */
  wallFeet?: number;
  barePosts?: number;
  /** Whether an opening's product is a curtain (catalog); without it every opening counts as a door. */
  curtain?: (product: string) => boolean;
}

/** Takdrager lengths, post centre to post centre, mm. */
export const beamSpecs = (b: BeamLayout): BeamSpec[] => b.segments.map((s) => ({ lengthMm: Math.round(s.length * 1000) }));

export function structureOf(d: Derived): FogaStructure {
  return {
    posts: d.posts,
    modules: d.mods.map((m) => ({ plate: m.plate, opening: !!m.opening, ...(m.opening && d.curtain?.(m.opening.product) && { curtain: true }) })),
    beams: beamSpecs(d.beams),
    frames: [...d.production.pieces, ...d.production.free].map((f) => ({ pos: f.pos, parts: f.parts })),
    ...(d.production.cornerPosts.qty ? { cornerPosts: d.production.cornerPosts } : {}),
    ...(d.hooks ? { beamHooks: d.hooks } : {}),
    ...(d.lift && d.lift.posts + d.lift.hooks ? { beamLift: d.lift } : {}),
    ...(d.swaps?.length ? { swaps: d.swaps } : {}),
    ...(d.wallFeet ? { wallFeet: d.wallFeet } : {}),
    ...(d.barePosts ? { barePosts: d.barePosts } : {}),
  };
}

/** Everything drawn, as if the exhibitor builds it all (no stand walls left to the organiser). */
export function fromVariant(v: Variant, rules: Rules): FogaStructure {
  const mods = builtModules(v);
  const points = wallPoints(mods);
  const { all: beams, hooks } = variantBeams(v, mods, points, rules.beam.max);
  const posts = new Set([...points.keys(), ...beams.posts.keys()]).size;
  const lift = liftBeams(v, rules, beams, points);
  return structureOf({ mods, posts, beams, hooks, lift: { posts: lift.posts.length, hooks: lift.hooks.length }, production: production(v, rules, '') });
}

/** Sizes from the rules, mm: post = system wall height without feet (2490), cc 1000. */
export const bomSizes = (rules: Rules): BomSizes => ({ postLength: Math.round(rules.wall.height * 1000), cc: Math.round(rules.wall.cc * 1000) });
