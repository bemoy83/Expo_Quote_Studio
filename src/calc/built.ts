// What is built, placed where it stands: made once by the calc, read by everything that draws the stand (3D first).
// Bjørn 28.11.2026: the stand is built once and 3D only shows what was built, never works a rule out again.
import { raisedPosts, type BuiltModule } from '../domain/walls';
import type { Point, Variant } from '../domain/types';
import { wallHeight, type Rules } from '../rules/rules';
import type { BeamLift } from './beams/beamLift';
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
}

export function builtOf(v: Variant, rules: Rules, mods: BuiltModule[], prod: Production, lift: BeamLift): Built {
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
  const beams = lift.segments.size ? H + lift.length / 1000 : H;
  const top = Math.max(H, beams, ...wallTop.values(), ...textileTop.values());
  return { mods, raisedPosts: raisedPosts(mods), wallTop, textileTop, roomTop, top };
}
