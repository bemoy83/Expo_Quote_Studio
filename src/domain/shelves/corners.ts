// Shelves (hylle 6311) in an inner corner: the post there has its face channel taken by the other wall, so the shelf's
// corner end rests on a 01 rail hung on the other wall's face (Bjørn 10.11.2026). A corner is the same wherever it is,
// at the end of a wall or in a T. Which board each shelf gets, which rails a corner takes and how long they are, all
// worked out from the shelves as drawn (like 91FF in brackets.ts). Byggeregler H6, H9, H10, H11, H12 (docs/byggeregler.md).
// Values: rules.shelf (m), RECIPES.shelf.corner (parts, mm).
import { RECIPES } from '../../foga/recipes';
import type { Rules } from '../../rules/rules';
import { wallHeight } from '../../rules/rules';
import { faceNormal, faces, sideOf, type FaceSide } from '../faces';
import { CHANNEL_TAKEN, channelTakers, feltBlocked, modulePosts } from '../fittings';
import { pointAlong, pointKey } from '../grid';
import type { BoardKind } from '../../foga/structure';
import type { Point, Shelf, Variant } from '../types';

export type { BoardKind };
import { fogaPart } from '../../foga/parts';

const C = RECIPES.shelf.corner;
const mm = (n: number) => n / 1000;
const EPS = 1e-6;
/** The 01 rail's width along the wall it hangs on and how far it stands out from that wall's rails, m. */
const [RAIL_W, RAIL_T] = fogaPart(C.rail).section!.map(mm);
/** Between a corner board's end and the face of the rail it rests by, m (Bjørn's STL). */
const END_PLAY = mm(4.5);
/** Between a 2/3 board's end and the rail with the twins, m (Bjørn's STL). */
const TWO_THIRDS_PLAY = mm(2);
const shelvesOf = (v: Variant): Shelf[] => v.shelves ?? [];
const shelvesIn = (v: Variant, wallId: string, module: number, s: FaceSide, skipId?: string) =>
  shelvesOf(v).filter((x) => x.wallId === wallId && x.module === module && sideOf(v, x) === s && x.id !== skipId);

/** A felt by wall, module and face. `end` is the post of the module at the corner: 0 its start, 1 its end. */
export interface CornerFelt {
  wallId: string;
  module: number;
  s: FaceSide;
  end: 0 | 1;
}

/** An inner corner seen from one of its two felts: the corner post, and the felt on the other wall that faces it. */
export interface Corner {
  post: Point;
  felt: CornerFelt;
  other: CornerFelt;
}

/**
 * The posts of a felt and what each has on the face's side (H6, H9): free, an inner corner with the felt that faces
 * it on the other wall, or taken in a way a shelf cannot use (more than one wall, or a face the other wall lacks).
 */
function postEnds(v: Variant, wallId: string, module: number, s: FaceSide): ('free' | 'taken' | Corner)[] {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return ['taken', 'taken'];
  const n = faceNormal(w, s);
  const posts = modulePosts(w, module);
  return posts.map((p, i) => {
    const takers = channelTakers(v, p, n);
    if (!takers.length) return 'free';
    const m = takers[0];
    const ow = v.walls.find((x) => x.id === m.wallId);
    if (takers.length > 1 || !ow) return 'taken';
    // The other wall's face that looks toward this felt
    const q = posts[1 - i];
    const os = ([1, -1] as const).find((x) => {
      const on = faceNormal(ow, x);
      return (q[0] - p[0]) * on[0] + (q[1] - p[1]) * on[1] > EPS;
    })!;
    if (!faces(v, ow).includes(os)) return 'taken';
    const end: 0 | 1 = pointKey(pointAlong(ow, m.index)) === pointKey(p) ? 0 : 1;
    return { post: p, felt: { wallId, module, s, end: i as 0 | 1 }, other: { wallId: ow.id, module: m.index, s: os, end } };
  });
}

/** The inner corner a felt stands in (H9), or null when neither post is one. */
export function feltCorner(v: Variant, wallId: string, module: number, s: FaceSide): Corner | null {
  const c = postEnds(v, wallId, module, s).find((x): x is Corner => typeof x === 'object');
  return c ?? null;
}

/**
 * Why a felt cannot take a shelf, or null when it can (H1, H6, H9): the felt can hold something, and each post has
 * its face channel free or is an inner corner whose other felt can carry the 01 rail. A felt with a corner at both
 * ends (a 1 m module between two walls) is not built yet.
 */
export function shelfBlocked(v: Variant, wallId: string, module: number, s: FaceSide): string | null {
  const why = feltBlocked(v, wallId, module, s, 'Hylle');
  if (why) return why;
  const ends = postEnds(v, wallId, module, s);
  if (ends.includes('taken')) return CHANNEL_TAKEN;
  const corners = ends.filter((x): x is Corner => typeof x === 'object');
  if (corners.length > 1) return 'Hylle mellom to hjørner kommer senere';
  const c = corners[0];
  if (c && feltBlocked(v, c.other.wallId, c.other.module, c.other.s)) return 'Naboveggen i hjørnet kan ikke ta 01-skinne';
  return null;
}

/** The shelves in the felt on the other wall of a felt's corner (H9: they keep the clear height across the corner). */
export function acrossCorner(v: Variant, wallId: string, module: number, s: FaceSide, skipId?: string): Shelf[] {
  const c = feltCorner(v, wallId, module, s);
  return c ? shelvesIn(v, c.other.wallId, c.other.module, c.other.s, skipId) : [];
}


/** A shelf in a corner: the corner it stands in, whether it meets a shelf on the other wall (and which), and its board
 *  along its own wall from the corner post's centre, m. */
export interface CornerShelf {
  corner: Corner;
  meets: string | null;
  board: BoardKind;
  from: number;
  to: number;
  depth: number;
}

/** A 01 rail in a corner (H12): on the felt it hangs on, its centre `along` that wall from the corner post's centre, m;
 *  the shelves it carries; from the wall's top down to `bottom` (m above the floor), in a standard `length` (mm). */
export interface ShelfRail {
  key: string;
  felt: CornerFelt;
  post: Point;
  along: number;
  kind: 'single' | 'meet';
  carries: string[];
  bottom: number;
  length: number;
}

/** From the corner post's centre to a 01 rail's centre along the wall it hangs on, m (H10, H11). */
export function railAlong(rules: Rules, kind: 'single' | 'meet'): number {
  const half = rules.wall.post / 2;
  return kind === 'single' ? half + mm(C.single) : half - mm(C.behind) + rules.shelf.board.depth + mm(C.play) + RAIL_W / 2;
}

/** The underside of the bracket a corner shelf at `y` rests on in its rail: a short 91 under the board when alone (H10),
 *  the twin's body around the flange when it meets another (H11), m above the floor. */
const bracketBottom = (rules: Rules, y: number, kind: 'single' | 'meet') =>
  y - rules.shelf.board.thickness - mm(kind === 'single' ? C.body : C.flange);

/**
 * The standard lengths of 01 rail (H12): one per quick height of H4 and the lowest, each reaching from the wall's top to
 * under a lone corner shelf's bracket there, rounded up to 10 mm. Longest first.
 */
export function railLengths(rules: Rules): number[] {
  const top = wallHeight(rules);
  const ys = [...new Set([rules.shelf.min, ...rules.shelf.heights])];
  return ys.map((y) => Math.ceil(Math.round((top - bracketBottom(rules, y, 'single')) * 1000) / 10) * 10).sort((a, b) => b - a);
}

/** The shortest standard rail reaching from the wall's top down to `bottom`, mm (H12). */
function railLength(rules: Rules, bottom: number): number {
  const need = Math.round((wallHeight(rules) - bottom) * 1000);
  const ls = railLengths(rules);
  return [...ls].reverse().find((l) => l >= need) ?? ls[0];
}

const feltKey = (f: Pick<CornerFelt, 'wallId' | 'module' | 's'>) => `${f.wallId}|${f.module}|${f.s}`;

/**
 * Every shelf in a corner with its board, and the rails the corners take (H9–H12). In each corner: two shelves at the
 * same height on its two felts meet; the wall drawn first gets the corner board, the other the 2/3 board and the
 * rail with the twins (H11). Every other shelf there is alone: a corner board on a short 91 in a rail on the other
 * wall (H10). Shelves of one kind on one felt share a rail (H12, Bjørn 10.11.2026: a lone shelf on a twin swings out).
 * A corner board with a rail from the other wall passing behind it is narrow (290).
 */
export function cornerLayout(v: Variant, rules: Rules): { shelves: Map<string, CornerShelf>; rails: ShelfRail[] } {
  const shelves = new Map<string, CornerShelf>();
  const rails = new Map<string, ShelfRail>();
  const order = (id: string) => v.walls.findIndex((w) => w.id === id);
  const all = shelvesOf(v).filter((f) => !shelfBlocked(v, f.wallId, f.module, sideOf(v, f)));
  const corners = new Map<string, Corner>();
  for (const f of all) {
    const c = feltCorner(v, f.wallId, f.module, sideOf(v, f));
    if (c) corners.set(feltKey(c.felt), c);
  }
  const onFelt = (x: Pick<CornerFelt, 'wallId' | 'module' | 's'>) => all.filter((f) => f.wallId === x.wallId && f.module === x.module && sideOf(v, f) === x.s);
  const rail = (c: Corner, on: CornerFelt, kind: 'single' | 'meet', f: Shelf) => {
    const key = `${feltKey(on)}|${kind}`;
    const r = rails.get(key) ?? { key, felt: on, post: c.post, along: railAlong(rules, kind), kind, carries: [], bottom: Infinity, length: 0 };
    r.carries.push(f.id);
    r.bottom = Math.min(r.bottom, bracketBottom(rules, f.y, kind));
    rails.set(key, r);
  };
  // The corner board starts by the face of the rail on the other wall, which stands out from that wall's rails
  const cornerFrom = rules.wall.post / 2 - mm(C.behind) + RAIL_T + END_PLAY;
  for (const c of corners.values()) {
    const across = onFelt(c.other);
    for (const f of onFelt(c.felt)) {
      const m = across.find((o) => Math.abs(o.y - f.y) < EPS);
      const last = m && order(c.felt.wallId) > order(c.other.wallId);
      if (m && last) {
        const from = railAlong(rules, 'meet') + RAIL_W / 2 + TWO_THIRDS_PLAY;
        shelves.set(f.id, { corner: c, meets: m.id, board: 'twoThirds', from, to: from + mm(C.boards.twoThirds.w), depth: rules.shelf.board.depth });
        rail(c, c.felt, 'meet', f);
      } else {
        shelves.set(f.id, { corner: c, meets: m?.id ?? null, board: 'corner', from: cornerFrom, to: cornerFrom + mm(C.boards.corner.w), depth: rules.shelf.board.depth });
        if (!m) rail(c, c.other, 'single', f);
      }
    }
  }
  const out = [...rails.values()].map((r) => ({ ...r, length: railLength(rules, r.bottom) }));
  // A corner board with a rail on its own felt (the other wall's, or the twins') passing behind it is narrow
  for (const [id, x] of shelves) {
    if (x.board !== 'corner') continue;
    const f = all.find((o) => o.id === id)!;
    const behind = out.some((r) => feltKey(r.felt) === feltKey(x.corner.felt) && r.along > x.from && r.along < x.to && f.y > r.bottom + EPS);
    if (behind) shelves.set(id, { ...x, board: 'narrow', depth: mm(C.boards.narrow.d) });
  }
  return { shelves, rails: out };
}
