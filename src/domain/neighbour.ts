// Byggeregel N1 (Bjørn 28.11.2026): anything higher than the standard wall (a raised wall, a tall textile wall) closer
// than `rules.neighbour.distance` to a stand boundary shared with a neighbour, and parallel to it, needs the neighbour's
// approval and a neutral side toward them. The approval is always needed, a neutral side does not take it away. Only
// what the neighbour sees has to be neutral: white textile, a system wall or a plain painted plate in the organiser's
// colour, with no other colour, print or decal unless agreed with the neighbour. A textile's back behind a raised
// wall is hidden and needs nothing.
import { inward, openSides, SIDES } from './grid';
import { textileBox } from './textile/inFrame';
import { freeTextiles, mountedOn, wallTextiles } from './textile/mounts';
import type { Point, Side, Variant, Wall } from './types';
import type { BuiltModule } from './walls';
import { raiseTop, wallHeight, type Rules } from '../rules/rules';

export interface NeighbourNote {
  kind: 'wall' | 'textile';
  /** The wall or textile run. */
  id: string;
  /** The stand side the neighbour is on. */
  side: Side;
  /** From the item's nearest edge to the boundary, m. */
  distance: number;
  /** How high it reaches, mm. */
  top: number;
  /** What the neighbour sees is neutral (organiser's colour, white textile, nothing printed). */
  neutral: boolean;
}

const EPS = 1e-6;

/** The stand's sides with a neighbour behind them: every side that is not on an aisle. */
export const neighbourSides = (v: Pick<Variant, 'stand'>): Side[] => SIDES.filter((s) => !openSides(v.stand).includes(s));

/** Where side `side`'s boundary is, along the axis across it (y for back and front, x for left and right), m. */
const boundary = (v: Pick<Variant, 'stand'>, side: Side) => (side === 'back' || side === 'left' ? 0 : side === 'front' ? v.stand.depth : v.stand.width);
/** The axis across a side: 1 (y) for back and front, 0 (x) for left and right. */
const across = (side: Side): 0 | 1 => (side === 'back' || side === 'front' ? 1 : 0);

/** How far a line from `a` to `b`, `half` thick either side, is from a side's boundary, when parallel to it; else null. */
function parallelDistance(v: Pick<Variant, 'stand'>, side: Side, a: Point, b: Point, half: number): number | null {
  const k = across(side);
  if (Math.abs(a[k] - b[k]) > EPS) return null;
  return Math.max(0, Math.abs(a[k] - boundary(v, side)) - half);
}

/**
 * Everything over the standard wall top closer than the neighbour distance to a parallel neighbour boundary
 * (Byggeregel N1), with whether the side the neighbour sees is neutral.
 */
export function neighbourNotes(v: Variant, rules: Rules): NeighbourNote[] {
  const sides = neighbourSides(v);
  if (!sides.length) return [];
  const { distance } = rules.neighbour;
  const std = Math.round(wallHeight(rules) * 1000);
  const out: NeighbourNote[] = [];
  for (const w of v.walls) {
    if (!w.raise) continue;
    const top = raiseTop(w.raise, rules);
    for (const side of sides) {
      const d = parallelDistance(v, side, w.from, w.to, rules.wall.post / 2);
      if (d === null || d >= distance - EPS) continue;
      // The upper felts face the neighbour on the face away from the stand. A colour is no matter: a plate in the
      // organiser's colour stands back to back with it, toward the neighbour (Byggeregel V20, `backToBack`). Print and
      // decals on that face are
      const face = faceToward(w, side);
      const printed = v.foils.some((f) => f.wallId === w.id && f.upper && (f.side ?? 1) === face);
      out.push({ kind: 'wall', id: w.id, side, distance: d, top, neutral: !printed });
    }
  }
  for (const t of wallTextiles(v)) {
    const box = textileBox(t, rules);
    const top = Math.round((box.bottom + box.height) * 1000);
    if (top <= std) continue;
    const m = mountedOn(v, t.id);
    const run = v.textiles.find((x) => x.id === t.id);
    if (!m || !run) continue;
    for (const side of sides) {
      const d = parallelDistance(v, side, run.from, run.to, rules.textile.depth / 2);
      if (d === null || d >= distance - EPS) continue;
      // Toward the neighbour it shows either its textile (white is neutral) or, over its wall, the frame's back: hidden
      // behind a wall raised as high, else not neutral
      const towards = faceToward(m.wall, side) === m.side;
      const wallTop = m.wall.raise ? raiseTop(m.wall.raise, rules) : std;
      const neutral = towards ? t.fill === 'white' : top <= wallTop;
      out.push({ kind: 'textile', id: t.id, side, distance: d, top, neutral });
    }
  }
  // Byggeregel X18: a tall textile wall on foot plates the same way (one product); both its faces are seen, so the
  // one toward the neighbour must be white
  for (const t of freeTextiles(v)) {
    const top = Math.round((t.height ?? wallHeight(rules)) * 1000);
    if (top <= std) continue;
    for (const side of sides) {
      const d = parallelDistance(v, side, t.from, t.to, rules.textile.depth / 2);
      if (d === null || d >= distance - EPS) continue;
      const face = faceToward({ from: t.from, to: t.to }, side) === 1 ? 'a' : 'b';
      out.push({ kind: 'textile', id: t.id, side, distance: d, top, neutral: t[face]?.fill === 'white' });
    }
  }
  return out;
}

/**
 * Byggeregler V20, N1: the raised modules whose upper plate, in another colour than the organiser's (`neutralRal`), would
 * face a neighbour. A plate is coloured on both sides, so a second plate in the organiser's colour stands back to back
 * with it toward the neighbour: in practice a plate swap, the organiser's plate left facing the neighbour and only the
 * customer's side changed (Bjørn 28.11.2026). Each → the colour of that second plate.
 */
export function backToBack(v: Variant, rules: Rules, mods: readonly BuiltModule[], neutralRal: string): Map<BuiltModule, string> {
  const walls = new Set(neighbourNotes(v, rules).filter((n) => n.kind === 'wall').map((n) => n.id));
  return new Map(mods.filter((m) => m.raise && walls.has(m.wallId) && m.raise.ral !== neutralRal).map((m) => [m, neutralRal]));
}

/** The face of a wall (1 or −1) that looks toward a stand side. */
function faceToward(w: Pick<Wall, 'from' | 'to'>, side: Side): 1 | -1 {
  const [dx, dy] = [w.to[0] - w.from[0], w.to[1] - w.from[1]];
  const len = Math.hypot(dx, dy) || 1;
  // Face 1 is the left normal (−dy, dx), as the textile's side A
  const n: Point = [-dy / len, dx / len];
  const [ix, iy] = inward(side);
  const out: Point = [-ix, -iy];
  return n[0] * out[0] + n[1] * out[1] > 0 ? 1 : -1;
}

/** The text for a note: what it needs. */
export function neighbourText(n: Pick<NeighbourNote, 'neutral'>): string {
  return n.neutral ? 'Krever godkjenning fra nabo' : 'Krever godkjenning fra nabo og nøytral side mot naboen';
}

/** A wall's or a textile's note, if any. */
export const noteFor = (notes: readonly NeighbourNote[], id: string) => notes.find((n) => n.id === id);
