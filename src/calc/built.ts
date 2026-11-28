// What is built, placed where it stands: made once by the calc, read by everything that draws the stand (3D first).
// Bjørn 28.11.2026: the stand is built once and 3D only shows what was built, never works a rule out again.
import { onSpan, pointKey } from '../domain/grid';
import { placedBrackets, type PlacedBracket } from '../domain/shelves/brackets';
import { raisedPosts, wallPoints, type BuiltModule } from '../domain/walls';
import type { Point, Shelf, Variant } from '../domain/types';
import { wallHeight, type Rules } from '../rules/rules';
import type { BeamLift } from './beams/beamLift';
import type { BeamSegment } from './beams/beamSegments';
import type { Production } from './textile/production';

export interface Built {
  /** Every wall module on the sketch, the organiser's stand walls too. */
  mods: BuiltModule[];
  /** Posts of raised walls, by point key, and the 94 joined on top of each, mm: the higher at a step (Byggeregler V18, V21). */
  raisedPosts: ReadonlyMap<string, { at: Point; len: number }>;
  /** Top of each wall from the floor, m: its highest module, raised or not. */
  wallTop: ReadonlyMap<string, number>;
  /** Top of each textile frame from the floor, m, by textile id: on a wall (X14 can be over the wall's top) or free. */
  textileTop: ReadonlyMap<string, number>;
  /** Top of the room's walls, m, by room id: the highest of its sides (V18). */
  roomTop: ReadonlyMap<string, number>;
  /** Top of the highest thing built, m: walls, raised walls, textile frames and lifted takdrager. */
  top: number;
  /** Takdrager as the pieces they are built of: each 292 between two centres (posts or a joint), cut 40 shorter. */
  beams: BuiltBeam[];
  /** The standing 92 a half metre is joined onto its whole length with (Byggeregel T18), no post there. */
  beamJoints: BuiltJoint[];
  /** The 94 pieces that lift takdrager (T13, T15, T19): on posts, on a wall between its posts, and at hook points. */
  liftPieces: { at: Point; bottom: number; length: number; onWall: boolean }[];
  /** The shelves that are built (on a module their wall has), and the brackets in their posts, placed (H2, H3). */
  shelves: Shelf[];
  brackets: PlacedBracket[];
}

/** One 292 of a takdrager: centre to centre `from` → `to`, plan m; `cut` the piece's length, m; `top` its top, m. */
export interface BuiltBeam {
  from: Point;
  to: Point;
  cut: number;
  top: number;
  /** The drawn takdrager it is part of (Byggeregel T8): picked as that beam. */
  drawn?: string;
}

/** A standing 92 at `at` between two lengths running along `dir`, its top at `top`, m. */
export interface BuiltJoint {
  at: Point;
  dir: Point;
  top: number;
  drawn?: string;
}

export function builtOf(v: Variant, rules: Rules, mods: BuiltModule[], prod: Production, lift: BeamLift, segments: readonly BeamSegment[]): Built {
  const H = wallHeight(rules);
  const wallTop = new Map<string, number>();
  for (const m of mods) wallTop.set(m.wallId, Math.max(wallTop.get(m.wallId) ?? H, H + (m.raise?.len ?? 0) / 1000));
  const textileTop = new Map<string, number>();
  for (const p of prod.pieces) textileTop.set(p.textileId, p.top / 1000);
  for (const f of prod.free) textileTop.set(f.textileId, f.H / 1000);
  const roomTop = new Map<string, number>();
  for (const w of v.walls) {
    if (!w.room) continue;
    roomTop.set(w.room.id, Math.max(roomTop.get(w.room.id) ?? H, wallTop.get(w.id) ?? H));
  }
  const lifted = lift.segments.size ? H + lift.length / 1000 : H;
  const top = Math.max(H, lifted, ...wallTop.values(), ...textileTop.values());
  const pieces = beamPieces(v, rules, segments, lift);
  return { mods, raisedPosts: raisedPosts(mods), wallTop, textileTop, roomTop, top, ...pieces, liftPieces: liftPieces(rules, mods, segments, lift), ...placedBrackets(v, rules) };
}

/** Half a metre of takdrager, centres, m (Byggeregel T18). */
const HALF = 0.5;
const EPS = 1e-6;

/** Each length as its 292 pieces: a length in whole and half metres is the whole length and a half metre joined onto
 *  it with a standing 92 (T18), at the whole-metre line, the half last on the run. */
function beamPieces(v: Variant, rules: Rules, segments: readonly BeamSegment[], lift: BeamLift): Pick<Built, 'beams' | 'beamJoints'> {
  const H = wallHeight(rules);
  const post = rules.wall.post;
  const beams: BuiltBeam[] = [];
  const beamJoints: BuiltJoint[] = [];
  for (const s of segments) {
    const top = H + (s.lifted ? lift.length / 1000 : 0);
    const drawn = s.inner ? v.innerBeams?.find((x) => onSpan(x.from, x.to, s.from) && onSpan(x.from, x.to, s.to))?.id : undefined;
    const tag = drawn ? { drawn } : {};
    const piece = (from: Point, to: Point) => beams.push({ from, to, cut: Math.max(0.001, Math.hypot(to[0] - from[0], to[1] - from[1]) - post), top, ...tag });
    const whole = Math.round(s.length * 1000) % 1000 === HALF * 1000 ? s.length - HALF : 0;
    if (whole < EPS) {
      piece(s.from, s.to);
      continue;
    }
    const L = Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]);
    const dir: Point = [(s.to[0] - s.from[0]) / L, (s.to[1] - s.from[1]) / L];
    // The joint is on a whole-metre line: the half metre at whichever end leaves it there, the to end when both do
    const at = (d: number): Point => [s.from[0] + dir[0] * d, s.from[1] + dir[1] * d];
    const onMetre = (p: Point) => Math.abs(p[0] * Math.abs(dir[0]) + p[1] * Math.abs(dir[1]) - Math.round(p[0] * Math.abs(dir[0]) + p[1] * Math.abs(dir[1]))) < EPS;
    const j = onMetre(at(whole)) || !onMetre(at(HALF)) ? at(whole) : at(HALF);
    piece(s.from, j);
    piece(j, s.to);
    beamJoints.push({ at: j, dir, top, ...tag });
  }
  return { beams, beamJoints };
}

/** The 94 pieces lifting takdrager: on each post under a lifted beam, on a wall a lifted beam ends on between its posts,
 *  and at a hook point between a lifted beam and one that is not, at the level of the beam hanging there. */
function liftPieces(rules: Rules, mods: BuiltModule[], segments: readonly BeamSegment[], lift: BeamLift): Built['liftPieces'] {
  if (!lift.segments.size) return [];
  const H = wallHeight(rules);
  const length = lift.length / 1000;
  const walls = wallPoints(mods);
  return [
    ...lift.posts.map((at) => ({ at, bottom: H, length, onWall: walls.has(pointKey(at)) })),
    ...lift.walls.map((at) => ({ at, bottom: H, length, onWall: false })),
    ...lift.hooks.map((at) => {
      const k = pointKey(at);
      const hanging = segments.filter((s) => pointKey(s.from) === k || pointKey(s.to) === k);
      return { at, bottom: hanging.some((s) => s.lifted) ? H : H - rules.beam.height, length, onWall: false };
    }),
  ];
}
