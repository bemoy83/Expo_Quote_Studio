// Byggeregler M1–M5: what hangs together among inner walls and free-standing textile walls, and moving it as one.
// Only what the building system fastens is joined (Bjørn 21.11.2026): two system walls where an end of one stands on
// the other (a corner, a T, end to end), and two free-standing textile walls in a 92LTX corner. A textile wall up against
// a system wall, or a wall up against a textile wall, only stands there: no fitting holds them together. A textile wall
// mounted on a wall is a coupling too, but it is part of that wall (X13), not a part of its own here. A coupling is
// never stored, it is read from where they stand like V10. The parts joined that way are a group: walls only, or
// textile walls only. A group of walls joined to a wall that stands still (a stand wall or a room wall) is anchored. Pure.
import type { Rules } from '../rules/rules';
import { onSpan, wallModules } from './grid';
import { replaceWalls } from './replaceWalls';
import { blocked, runLength, textileStep } from './textile/free';
import type { FreeTextile, Point, Variant, Wall } from './types';
import { isStandWall, standWallKeys } from './walls';
import { freeTextiles, mountedOn, withOnFeet } from './textile/mounts';

const EPS = 1e-6;

/** A part that can be moved: an inner wall or a free-standing textile wall. */
export type Part = { kind: 'wall' | 'textile'; id: string };

/** Byggeregel M1: the parts joined to one another, and whether any of them is joined to a wall that stands still. */
export interface Group {
  walls: string[];
  textiles: string[];
  anchored: boolean;
}

type Seg = Pick<Wall, 'from' | 'to'>;

/** Walls that are moved by the user: inner walls. Stand walls and room walls stand still (a room moves its own). */
const movable = (w: Wall) => !w.room && !isStandWall(w);

/** An end of one lies on the other: a corner, a T or end to end in line (M1). Axis-aligned segments. */
export const joined = (a: Seg, b: Seg) =>
  onSpan(b.from, b.to, a.from) || onSpan(b.from, b.to, a.to) || onSpan(a.from, a.to, b.from) || onSpan(a.from, a.to, b.to);

/** Byggeregel M1: the group `start` belongs to. */
export function groupOf(v: Variant, start: Part): Group {
  const walls = v.walls.filter(movable);
  const fixed = v.walls.filter((w) => !movable(w));
  const all: { part: Part; seg: Seg }[] = [
    ...walls.map((w) => ({ part: { kind: 'wall', id: w.id } as Part, seg: w as Seg })),
    ...freeTextiles(v).map((t) => ({ part: { kind: 'textile', id: t.id } as Part, seg: t as Seg })),
  ];
  const key = (p: Part) => `${p.kind}:${p.id}`;
  const first = all.find((x) => key(x.part) === key(start));
  if (!first) return { walls: [], textiles: [], anchored: false };
  const seen = new Set([key(start)]);
  const queue = [first];
  const members: typeof all = [];
  while (queue.length) {
    const x = queue.shift()!;
    members.push(x);
    for (const y of all) {
      // Only like with like: a wall and a textile wall are never joined (M1)
      if (seen.has(key(y.part)) || y.part.kind !== x.part.kind || !joined(x.seg, y.seg)) continue;
      seen.add(key(y.part));
      queue.push(y);
    }
  }
  return {
    walls: members.filter((x) => x.part.kind === 'wall').map((x) => x.part.id),
    textiles: members.filter((x) => x.part.kind === 'textile').map((x) => x.part.id),
    anchored: members.some((x) => x.part.kind === 'wall' && fixed.some((f) => joined(x.seg, f))),
  };
}

export const groupSize = (g: Group) => g.walls.length + g.textiles.length;

const inStand = (v: Variant, p: Point) => p[0] >= -EPS && p[1] >= -EPS && p[0] <= v.stand.width + EPS && p[1] <= v.stand.depth + EPS;

/** True when every free-standing textile wall can stand where it is (none crossed by a wall that moved). */
function textilesStand(v: Variant, rules: Rules): boolean {
  return freeTextiles(v).every((t) => !blocked(v, rules, t, freeTextiles(v).filter((o) => o.id !== t.id)));
}

/**
 * Byggeregel M2: move a whole group by (dx, dy) as one thing. Doors, foils, shelves and textiles on its walls go with
 * them, and each wall keeps where its doors split it (D8). Null when it cannot stand there: outside the stand, onto a
 * stand wall, or a textile wall would cross a wall.
 */
export function moveGroup(v: Variant, rules: Rules, g: Group, dx: number, dy: number): Variant | null {
  if (!dx && !dy) return v;
  return placeGroup(v, rules, g, (p) => [p[0] + dx, p[1] + dy]);
}

/** The group with every point of its walls and textile walls put where `to` says (a move, or a turn, M6); what stands
 *  on its walls goes with them. Null when it cannot stand there. */
export function placeGroup(v: Variant, rules: Rules, g: Group, to: (p: Point) => Point): Variant | null {
  const r = (x: number) => Math.round(x * 1000) / 1000;
  const shift = (p: Point): Point => {
    const q = to(p);
    return [r(q[0]), r(q[1])];
  };
  const ws = new Set(g.walls);
  const ts = new Set(g.textiles);
  const moved = v.walls.filter((w) => ws.has(w.id)).map((w) => ({ ...w, from: shift(w.from), to: shift(w.to) }));
  const runs = freeTextiles(v).map((t) => (ts.has(t.id) ? { ...t, from: shift(t.from), to: shift(t.to) } : t));
  if (![...moved, ...runs.filter((t) => ts.has(t.id))].every((s) => inStand(v, s.from) && inStand(v, s.to))) return null;
  const locked = standWallKeys(v);
  if (moved.some((w) => wallModules(w).some((m) => locked.has(m.key)))) return null;
  const on = <T extends { wallId: string }>(xs: readonly T[]) => xs.filter((x) => ws.has(x.wallId));
  // Frames mounted on its walls go with them (X13)
  const onMoved = (id: string) => ws.has(mountedOn(v, id)?.wall.id ?? '');
  const mounted = v.textiles.filter((t) => onMoved(t.id)).map((t) => ({ ...t, from: shift(t.from), to: shift(t.to) }));
  const off = <T extends { wallId: string }>(xs: readonly T[]) => xs.filter((x) => !ws.has(x.wallId));
  const rest = replaceWalls(
    {
      ...v,
      openings: off(v.openings),
      textiles: v.textiles.filter((t) => mountedOn(v, t.id) && !onMoved(t.id)),
      foils: off(v.foils),
      ...(v.shelves ? { shelves: off(v.shelves) } : {}),
    },
    [...v.walls.filter((w) => !ws.has(w.id)), ...moved],
  );
  const breaks = new Map(v.walls.filter((w) => ws.has(w.id) && w.breaks).map((w) => [w.id, w.breaks]));
  const next: Variant = {
    ...rest,
    walls: rest.walls.map((w) => (breaks.has(w.id) ? { ...w, breaks: breaks.get(w.id) } : w)),
    openings: [...rest.openings, ...on(v.openings)],
    textiles: [...rest.textiles, ...mounted, ...runs],
    foils: [...rest.foils, ...on(v.foils)],
    ...(v.shelves ? { shelves: [...(rest.shelves ?? []), ...on(v.shelves)] } : {}),
  };
  return textilesStand(next, rules) ? next : null;
}

/** Byggeregel M4: how close an end has to come to another part to snap onto it, m (as a counter onto a counter, ONTO). */
export const MAGNET = 0.3;

/**
 * Byggeregel M4: (dx, dy) with the small extra shift, at most MAGNET on each axis, that brings an end of the moved group
 * onto a part it can be joined to (M1): a wall's end onto another wall, its end first, else its line; a textile wall's
 * end onto another textile wall's end (a 92LTX corner). Never a wall onto a textile wall or the other way: they may
 * stand up against each other, but the magnet does not pull them there. Unchanged when an end already meets one, or
 * none is near.
 */
export function magnet(v: Variant, g: Group, dx: number, dy: number): Point {
  const ws = new Set(g.walls);
  const ts = new Set(g.textiles);
  type Kinded = { seg: Seg; wall: boolean };
  const mine: Kinded[] = [...v.walls.filter((w) => ws.has(w.id)).map((seg) => ({ seg, wall: true })), ...freeTextiles(v).filter((t) => ts.has(t.id)).map((seg) => ({ seg, wall: false }))];
  const others: Kinded[] = [...v.walls.filter((w) => !ws.has(w.id)).map((seg) => ({ seg, wall: true })), ...freeTextiles(v).filter((t) => !ts.has(t.id)).map((seg) => ({ seg, wall: false }))];
  const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, Math.min(a, b)), Math.max(a, b));
  let best: Point | null = null;
  let bd = Infinity;
  for (const { seg: s, wall } of mine) {
    for (const e of [s.from, s.to]) {
      const p: Point = [e[0] + dx, e[1] + dy];
      for (const { seg: o, wall: ow } of others) {
        if (ow !== wall) continue;
        const line: Point = [clamp(p[0], o.from[0], o.to[0]), clamp(p[1], o.from[1], o.to[1])];
        // Its ends pull a little harder than its line, so a corner closes rather than a T. A textile wall has no T
        const targets: [Point, number][] = wall ? [[o.from, 0.05], [o.to, 0.05], [line, 0]] : [[o.from, 0.05], [o.to, 0.05]];
        for (const [q, bias] of targets) {
          const ex = q[0] - p[0];
          const ey = q[1] - p[1];
          if (Math.abs(ex) > MAGNET + EPS || Math.abs(ey) > MAGNET + EPS) continue;
          const d = Math.hypot(ex, ey);
          if (d < EPS) return [dx, dy];
          if (alongside(s, o, dx + ex, dy + ey)) continue;
          if (d - bias < bd) {
            bd = d - bias;
            best = [ex, ey];
          }
        }
      }
    }
  }
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return best ? [r(dx + best[0]), r(dy + best[1])] : [dx, dy];
}

/** True when s moved by (dx, dy) would lie along o, on its line and overlapping it: never a joint. */
function alongside(s: Seg, o: Seg, dx: number, dy: number): boolean {
  const h = horizontal(s);
  if (h !== horizontal(o)) return false;
  const i = h ? 0 : 1;
  const c = h ? 1 : 0;
  if (Math.abs(s.from[c] + (h ? dy : dx) - o.from[c]) > EPS) return false;
  const shift = h ? dx : dy;
  const lo = Math.max(Math.min(s.from[i], s.to[i]) + shift, Math.min(o.from[i], o.to[i]));
  const hi = Math.min(Math.max(s.from[i], s.to[i]) + shift, Math.max(o.from[i], o.to[i]));
  return hi - lo > EPS;
}

/** Byggeregel M4: move a group that stands free, snapped onto a part near it when that can stand; else as dragged. */
export function moveGroupNear(v: Variant, rules: Rules, g: Group, dx: number, dy: number): Variant | null {
  const [mx, my] = magnet(v, g, dx, dy);
  return ((mx !== dx || my !== dy) && moveGroup(v, rules, g, mx, my)) || moveGroup(v, rules, g, dx, dy);
}

/**
 * Byggeregel M4: true when `part`, as it stands in `after`, is joined to a part it was not joined to in `before`: a
 * release here couples them, which the plan says while dragging («Slipp for å koble»).
 */
export function joinsNew(before: Variant, after: Variant, part: Part): boolean {
  const was = groupOf(before, part);
  const now = groupOf(after, part);
  const w = new Set(was.walls);
  const t = new Set(was.textiles);
  return now.walls.some((id) => !w.has(id)) || now.textiles.some((id) => !t.has(id));
}

/** Byggeregel M5: a part on its own, as if nothing were joined to it («Løsne», Alt + dra). */
export const alone = (p: Part): Group => ({ walls: p.kind === 'wall' ? [p.id] : [], textiles: p.kind === 'textile' ? [p.id] : [], anchored: false });

const horizontal = (s: Seg) => Math.abs(s.from[1] - s.to[1]) < EPS;
const samePoint = (p: Point, q: Point) => Math.abs(p[0] - q[0]) < EPS && Math.abs(p[1] - q[1]) < EPS;

/**
 * Byggeregel M2: drag a free-standing textile wall by (dx, dy) on the textile grid (250, so Shift or «Fin» changes
 * nothing). Its group (textile walls in 92LTX corners, M1) moves as one and snaps onto a textile wall
 * near it (M4); `loose` («Løsne», M5) moves it alone. A textile group is never anchored: nothing holds it to a wall.
 * Null when it cannot stand there.
 */
export function moveTextileGroup(v: Variant, rules: Rules, id: string, dx: number, dy: number, loose = false): Variant | null {
  const t = freeTextiles(v).find((x) => x.id === id);
  if (!t) return null;
  const g = loose ? alone({ kind: 'textile', id }) : groupOf(v, { kind: 'textile', id });
  return moveGroupNear(v, rules, g, textileStep(rules, dx), textileStep(rules, dy));
}

/**
 * Byggeregel M6: a free-standing textile wall moved across itself by (ox, oy) while the textile walls cornered to it
 * grow or shrink, so the corner holds: an arm dragged by a corner grip. Null when it cannot stand there.
 */
export function slideTextile(v: Variant, rules: Rules, id: string, ox: number, oy: number): Variant | null {
  const t = freeTextiles(v).find((x) => x.id === id);
  if (!t) return null;
  if (horizontal(t) ? ox : oy) return null;
  if (!ox && !oy) return v;
  const shift = (p: Point): Point => [Math.round((p[0] + ox) * 1000) / 1000, Math.round((p[1] + oy) * 1000) / 1000];
  const run: FreeTextile = { ...t, from: shift(t.from), to: shift(t.to) };
  if (!inStand(v, run.from) || !inStand(v, run.to)) return null;
  // Corners at its ends grow or shrink with it
  const runs = freeTextiles(v).map((o) => {
    if (o.id === id) return run;
    let next = o;
    for (const e of ['from', 'to'] as const) {
      if (samePoint(o.from, t[e])) next = { ...next, from: run[e] };
      if (samePoint(o.to, t[e])) next = { ...next, to: run[e] };
    }
    return next;
  });
  if (runs.some((o) => runLength(o) < rules.textile.freeMin - EPS)) return null;
  const next = withOnFeet(v, runs);
  return textilesStand(next, rules) ? next : null;
}
