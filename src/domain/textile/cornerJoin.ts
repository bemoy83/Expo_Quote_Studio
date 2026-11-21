// Byggeregler X7, X10, M5: «Løs opp hjørnet» and «Koble hjørnet» on a 92LTX between two frames on system walls. Both
// are geometry only (Bjørn 21.11.2026), nothing is stored about the corner: let go, the frame on the shorter wall moves
// along its wall until it stands against the other frame's face, keeping its length; joined, it moves back so each frame
// is drawn to the other wall's line, and the frames meet at a 92LTX again (coupleCorners). Pure.
import { RULES } from '../../rules/rules';
import { wallDirection, wallLength } from '../grid';
import { sideOf } from '../faces';
import type { Point, TextileWall, Variant, Wall } from '../types';
import { cornerEnds, same } from './corners';
import { MOUNT_INSET, MOUNT_OFFSET, SPAN_REACH, frameCorners, mountedOn, wallTextiles, withOnWall } from './mounts';

const EPS = 1e-6;
const r6 = (x: number) => Math.round(x * 1e6) / 1e6 + 0;

/** A corner between two frames on system walls: where their centre lines cross, the two frames, and whether a 92LTX
 *  joins them there now. */
export interface WallCorner {
  at: Point;
  ids: [string, string];
  joined: boolean;
}

const isHorizontal = (w: Wall) => Math.abs(w.from[1] - w.to[1]) < EPS;

/** Where along wall `on` the line of wall `o` crosses it, m. */
function lineOn(on: Wall, o: Wall): number {
  const [dx, dy] = wallDirection(on);
  return (o.from[0] - on.from[0]) * dx + (o.from[1] - on.from[1]) * dy;
}

/** The frame with the end of its span nearest the other wall's line moved there, its width kept. */
function drawnTo(t: TextileWall, on: Wall, o: Wall): TextileWall {
  const j = lineOn(on, o);
  const lo = Math.abs(t.from - j) <= Math.abs(t.from + t.width - j);
  return { ...t, from: r6(lo ? j : j - t.width) };
}

/** The frames on system walls that meet in a corner, joined or let go (X7). A pair let go is one that joins when each
 *  is drawn to the other's wall line again (it moved no further than a frame round the corner reaches). */
export function wallCorners(v: Variant): WallCorner[] {
  const out: WallCorner[] = [];
  const corners = cornerEnds(v);
  const views = wallTextiles(v);
  const wall = (t: TextileWall) => v.walls.find((w) => w.id === t.wallId);
  for (let i = 0; i < views.length; i++) {
    for (let j = i + 1; j < views.length; j++) {
      const [a, b] = [views[i], views[j]];
      const [wa, wb] = [wall(a), wall(b)];
      if (!wa || !wb || isHorizontal(wa) === isHorizontal(wb)) continue;
      const ra = v.textiles.find((t) => t.id === a.id)!;
      const rb = v.textiles.find((t) => t.id === b.id)!;
      // Joined: they share an end, and it is a corner
      const shared = [ra.from, ra.to].find((p) => same(p, rb.from) || same(p, rb.to));
      if (shared && (corners.get(a.id)?.from || corners.get(a.id)?.to)) {
        out.push({ at: shared, ids: [a.id, b.id], joined: true });
        continue;
      }
      // Let go: each span ends no further from the other's wall line than a dissolve moves it
      const near = (t: TextileWall, on: Wall, o: Wall) => {
        const k = lineOn(on, o);
        return Math.min(Math.abs(t.from - k), Math.abs(t.from + t.width - k)) <= SPAN_REACH + EPS;
      };
      if (!near(a, wa, wb) || !near(b, wb, wa)) continue;
      const joined = join(v, a, wa, b, wb);
      const p = joined && cornerPoint(joined, a.id, b.id);
      if (p) out.push({ at: p, ids: [a.id, b.id], joined: false });
    }
  }
  return out;
}

/** The two frames drawn to each other's wall lines, written so coupleCorners joins them; null when they do not meet. */
function join(v: Variant, a: TextileWall, wa: Wall, b: TextileWall, wb: Wall): Variant | null {
  const moved = new Map([
    [a.id, drawnTo(a, wa, wb)],
    [b.id, drawnTo(b, wb, wa)],
  ]);
  const x = withOnWall(v, wallTextiles(v).map((t) => moved.get(t.id) ?? t));
  return cornerPoint(x, a.id, b.id) ? x : null;
}

/** The point where runs a and b meet in a corner, if they do. */
function cornerPoint(v: Variant, a: string, b: string): Point | null {
  const ra = v.textiles.find((t) => t.id === a);
  const rb = v.textiles.find((t) => t.id === b);
  const e = cornerEnds(v).get(a);
  if (!ra || !rb || !e) return null;
  for (const key of ['from', 'to'] as const) if (e[key] && (same(ra[key], rb.from) || same(ra[key], rb.to))) return ra[key];
  return null;
}

const cornerAt = (v: Variant, at: Point) => wallCorners(v).find((c) => same(c.at, at));

/**
 * Byggeregel X10, M5: «Løs opp hjørnet». The frame on the longer wall stays (on equal walls the one along x) and stops
 * short of the corner as a frame alone does (X2). The other keeps its length and moves along its wall until it stands
 * against the first one's face: away from an inside corner, out past the end round an outside one. How far is worked out
 * from the volumes (post, frame depth, side deduction and air), never a fixed number. Frames after it on the same face
 * move as far as they would otherwise overlap. v itself when no frames are joined at `at`.
 */
export function letGoCorner(v: Variant, at: Point): Variant {
  const c = cornerAt(v, at);
  if (!c?.joined) return v;
  const views = wallTextiles(v);
  const [a, b] = c.ids.map((id) => views.find((t) => t.id === id)!);
  const [wa, wb] = [a, b].map((t) => v.walls.find((w) => w.id === t.wallId)!);
  const keepA = wallLength(wa) > wallLength(wb) + EPS || (Math.abs(wallLength(wa) - wallLength(wb)) < EPS && isHorizontal(wa));
  const [move, wall] = keepA ? [b, wb] : [a, wa];
  // Which end is in the corner, and whether it is inside (the span runs on past the frame to the other wall's line)
  const ends = frameCorners(v, move.id);
  const low = !!ends.lo && same(cornerEndPoint(v, move.id, 'lo'), at);
  const inside = (low ? ends.lo : ends.hi) === 1;
  // Inside: from where a frame alone stops (half the side deduction and air from the line) to the other frame's face
  // (half a post and a whole frame depth); outside: past the line to the other frame's outer face
  const face = MOUNT_OFFSET + RULES.textile.depth / 2;
  const by = (inside ? face - MOUNT_INSET : -(face + MOUNT_INSET)) * (low ? 1 : -1);
  const moved = new Map<string, TextileWall>([[move.id, { ...move, from: r6(move.from + by), fit: undefined }]]);
  // The frames after it on the same face, as far as they would overlap (X10)
  const s = sideOf(v, move);
  const row = views
    .filter((t) => t.id !== move.id && t.wallId === wall.id && sideOf(v, t) === s)
    .sort((p, q) => (low ? p.from - q.from : q.from - p.from));
  let prev = moved.get(move.id)!;
  for (const t of row) {
    const gap = low ? t.from - (prev.from + prev.width) : prev.from - (t.from + t.width);
    if ((low ? t.from < move.from : t.from > move.from) || gap > -EPS) continue;
    const next = { ...t, from: r6(t.from + (low ? -gap : gap)), fit: undefined };
    moved.set(t.id, next);
    prev = next;
  }
  return withOnWall(v, views.map((t) => moved.get(t.id) ?? t));
}

/** The run end of frame `id` at the low or high end of its span. */
function cornerEndPoint(v: Variant, id: string, end: 'lo' | 'hi'): Point {
  const m = mountedOn(v, id)!;
  const t = v.textiles.find((x) => x.id === id)!;
  const [dx, dy] = wallDirection(m.wall);
  const along = (p: Point) => (p[0] - m.wall.from[0]) * dx + (p[1] - m.wall.from[1]) * dy;
  const lowEnd = along(t.from) <= along(t.to) ? t.from : t.to;
  return end === 'lo' ? lowEnd : lowEnd === t.from ? t.to : t.from;
}

/** Byggeregel X7, M5: «Koble hjørnet». The frames of a corner let go drawn to each other's wall lines again, so a 92LTX
 *  joins them. v itself when there is no such corner at `at`. */
export function joinCorner(v: Variant, at: Point): Variant {
  const c = cornerAt(v, at);
  if (!c || c.joined) return v;
  const views = wallTextiles(v);
  const [a, b] = c.ids.map((id) => views.find((t) => t.id === id)!);
  const [wa, wb] = [a, b].map((t) => v.walls.find((w) => w.id === t.wallId)!);
  return join(v, a, wa, b, wb) ?? v;
}
