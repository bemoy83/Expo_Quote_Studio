// Stand sketch → Foga structure. Built from the same derivations as calc (built modules, beam layout, InFrame
// sizes); calc passes its own so the quote, the picking list and the parts list count from one structure.
// Byggeregel P3 (docs/byggeregler.md).
import { liftBeams, withJoins } from '../calc/beams/beamLift';
import { beamHooks, hookCount } from '../calc/beams/beamHooks';
import { variantBeams } from '../calc/beams/beams';
import type { BeamLayout } from '../calc/beams/beamSegments';
import { production, type Production } from '../calc/textile/production';
import { builtCounterParts } from '../domain/counters';
import { shelfBrackets } from '../domain/shelves/brackets';
import type { Variant } from '../domain/types';
import { builtModules, raisedPosts, wallPoints, type BuiltModule } from '../domain/walls';
import type { Rules } from '../rules/rules';
import type { CounterParts } from './counter';
import type { BomSizes } from './engine';
import type { BeamSpec, FogaStructure, ShelfSpec } from './structure';

export interface Derived {
  mods: BuiltModule[];
  /** Wall posts and posts that only carry takdrager. */
  posts: number;
  beams: BeamLayout;
  /** Hooks a takdrager hangs on another beam or a wall's top rail with, by kind (calc/beams/beamHooks.ts). */
  hooks?: { oneWay: number; twoWay: number };
  /** Takdrager lifted over a textile wall: posts extended, mixed-level hook points and ends on a wall (T15). */
  lift?: { posts: number; hooks: number; walls?: number };
  production: Production;
  /** Plates swapped into stand walls the organiser builds. */
  swaps?: string[];
  /** Støtteplater under free-standing system walls, and how many of them stand under a post in `posts`. */
  wallFeet?: number;
  barePosts?: number;
  /** Whether an opening's product is a curtain (catalog); without it every opening counts as a door. */
  curtain?: (product: string) => boolean;
  /** Shelves and their brackets (domain/shelves/brackets.ts). */
  shelves?: ShelfSpec;
  /** Counters drawn and built on site (domain/counters.ts). */
  counters?: CounterParts;
  /** Inserts 700 under counters over a foot plate (domain/counters.ts counterInserts, K23). */
  counterInserts?: number;
  /** Ceiling wires on raised walls (Byggeregel S10): an eyebolt with its 503 in the top rail for each. */
  wires?: number;
  /** Every built module, the organiser's too: a raise is always the exhibitor's (Byggeregel V18). Defaults to `mods`. */
  all?: BuiltModule[];
}

/** The raised modules and the 94 joined onto their posts (Byggeregel V18). */
export function raisesOf(mods: readonly BuiltModule[]): FogaStructure['raises'] | undefined {
  const raised = mods.filter((m) => m.raise);
  if (!raised.length) return undefined;
  const byLen = new Map<number, number>();
  for (const { len } of raisedPosts(raised).values()) byLen.set(len, (byLen.get(len) ?? 0) + 1);
  return {
    modules: raised.map((m) => ({ plate: m.raise!.ral, len: m.raise!.len, ...(m.cc < 1 - 1e-6 && { cc: Math.round(m.cc * 1000) }) })),
    posts: [...byLen].sort(([a], [b]) => b - a).map(([len, qty]) => ({ len, qty })),
  };
}

/** Takdrager lengths, post centre to post centre, mm. A length in whole and half metres is never cut to it (Byggeregel
 *  T18, Bjørn 15.11.2026): the whole length and a 500 (cut 460) joined onto its end with a standing 92, no post there. */
export const beamSpecs = (b: BeamLayout): BeamSpec[] =>
  b.segments.flatMap((s): BeamSpec[] => {
    const mm = Math.round(s.length * 1000);
    const whole = mm - HALF_MM;
    if (mm % 1000 !== HALF_MM) return [{ lengthMm: mm }];
    return whole ? [{ lengthMm: whole }, { lengthMm: HALF_MM, joined: true }] : [{ lengthMm: HALF_MM }];
  });

/** The half metre of a takdrager, centres, mm (Byggeregel T18). */
const HALF_MM = 500;

export function structureOf(d: Derived): FogaStructure {
  const raises = raisesOf(d.all ?? d.mods);
  return {
    posts: d.posts,
    modules: d.mods.map((m) => ({ plate: m.plate, opening: !!m.opening, ...(m.opening && d.curtain?.(m.opening.product) && { curtain: true }), ...(m.cc < 1 - 1e-6 && { cc: Math.round(m.cc * 1000) }) })),
    beams: beamSpecs(d.beams),
    frames: [...d.production.pieces, ...d.production.free].map((f) => ({ pos: f.pos, parts: f.parts })),
    ...(d.production.cornerPosts.length ? { cornerPosts: d.production.cornerPosts } : {}),
    ...(d.hooks && d.hooks.oneWay + d.hooks.twoWay ? { beamHooks: d.hooks } : {}),
    ...(d.lift && d.lift.posts + d.lift.hooks + (d.lift.walls ?? 0) ? { beamLift: { posts: d.lift.posts, hooks: d.lift.hooks, ...(d.lift.walls ? { walls: d.lift.walls } : {}) } } : {}),
    ...(d.swaps?.length ? { swaps: d.swaps } : {}),
    ...(d.wallFeet ? { wallFeet: d.wallFeet } : {}),
    ...(d.barePosts ? { barePosts: d.barePosts } : {}),
    ...(d.shelves?.boards ? { shelves: d.shelves } : {}),
    ...(d.counters ? { counters: d.counters } : {}),
    ...(d.counterInserts ? { counterInserts: d.counterInserts } : {}),
    ...(raises ? { raises } : {}),
    ...(d.wires ? { wires: d.wires } : {}),
  };
}

/** Everything drawn, as if the exhibitor builds it all (no stand walls left to the organiser). */
export function fromVariant(v: Variant, rules: Rules): FogaStructure {
  const mods = builtModules(v);
  const points = wallPoints(mods);
  const { all: laid } = variantBeams(v, mods, points, rules.beam.max);
  const posts = new Set([...points.keys(), ...laid.posts.keys()]).size;
  const lift = liftBeams(v, rules, laid, points, mods);
  const beams = withJoins(laid, lift);
  const hooks = hookCount(beamHooks(beams, points, lift));
  return structureOf({ mods, posts, beams, hooks, lift: { posts: lift.posts.length, hooks: lift.hooks.length, walls: lift.walls.length }, production: production(v, rules, ''), shelves: shelfBrackets(v, rules), counters: builtCounterParts(v) });
}

/** Sizes from the rules, mm: post = system wall height without feet (2490), cc 1000. */
export const bomSizes = (rules: Rules): BomSizes => ({ postLength: Math.round(rules.wall.height * 1000), cc: Math.round(rules.wall.cc * 1000) });
