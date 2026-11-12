// Counter (bardisk 6560) from its recipe, Byggeregler K1–K8 (docs/byggeregler.md): every profile, plate and board with
// its size and where it sits, so plan, 3D and the kalkyle read the same pieces. A counter is a grid of nodes, 500 or
// 1000 apart (K7), with a rail between each two (K3). The profile in a node follows the directions it joins (K8): two
// at a right angle a 92L, three a 93, four a 94; the rails are as long whatever stands in the node. Local coordinates
// in mm: x along the counter, z across it with the closed front at +z, y up from the floor. Nodes sit 10 mm in from
// the outer face, so the outer size is the nodes' c/c + 20.
import { RECIPES, type CounterRecipe } from './recipes';

export type Range = readonly [number, number];
export interface Box3 {
  x: Range;
  y: Range;
  z: Range;
}

/** Sides of a box-shaped counter. An open side has no plates and no bottom rail (K3, K4): the counter in stock is open
 *  at the back. */
export type CounterSide = 'front' | 'back' | 'left' | 'right';

/** A straight counter: its outer size, mm, and the sides left open (K7). */
export interface CounterShape {
  length: number;
  depth: number;
  open: readonly CounterSide[];
}

/** The counter in stock: open at the back, where the staff stand (K1). */
export const STOCK_OPEN: readonly CounterSide[] = ['back'];

/** A part of the counter between four nodes, carrying a top and a shelf (K5), in node coordinates, mm. */
export interface CounterCell {
  x: Range;
  z: Range;
}

/** What a counter is made of, in node coordinates (mm): its parts, and the stretches of its outside left open, each
 *  from one node to another. Any shape the parts make joins up by the same rules (K8). */
export interface CounterLayout {
  cells: readonly CounterCell[];
  open: readonly (readonly [Pt, Pt])[];
}

type Pt = readonly [number, number];
/** A direction along x or z: ±1 on one of them. */
type Dir = readonly [number, number];

export interface CounterProfile {
  code: string;
  role: 'post' | 'rail' | 'bottomRail';
  /** Cut length, mm. */
  len: number;
  /** Which way it runs: posts up (y), rails along their side. */
  axis: 'x' | 'y' | 'z';
  /** Its closed faces: −1 or 1 along x and z, 0 where it joins both ways or has none (a 94, a rail inside the
   *  counter). A rail on the outside has one, outward. */
  out: readonly [number, number];
  box: Box3;
}

export interface CounterPlate {
  /** Outward from the counter, along x or z. */
  out: Dir;
  level: 'lower' | 'upper';
  /** Order size, mm: along the side × high. */
  w: number;
  h: number;
  box: Box3;
}

export interface CounterBoard {
  role: 'top' | 'shelf';
  w: number;
  d: number;
  box: Box3;
}

export interface CounterBuild {
  /** Outer size, mm: the box around it. */
  length: number;
  depth: number;
  profiles: CounterProfile[];
  plates: CounterPlate[];
  boards: CounterBoard[];
  /** 600 in the rail ends. */
  couplings: number;
}

const EPS = 1e-6;
const key = (p: Pt) => `${Math.round(p[0] * 1000) / 1000},${Math.round(p[1] * 1000) / 1000}`;

/** The side of a box-shaped counter a plate or rail faces. */
export function sideOf(out: readonly [number, number]): CounterSide {
  return out[1] > 0 ? 'front' : out[1] < 0 ? 'back' : out[0] < 0 ? 'left' : 'right';
}

/** Where the nodes of a straight run fall, from 0 to `cc`: whole metres first, then a half (K7). */
export function runBreaks(r: CounterRecipe, cc: number): number[] {
  const out = [0];
  let at = 0;
  while (cc - at > EPS) {
    at += cc - at >= r.module.whole - EPS ? r.module.whole : r.module.half;
    out.push(Math.min(at, cc));
  }
  return out;
}

/** A straight counter as parts, centred on the origin, its front at +z (K7). */
export function straightLayout(r: CounterRecipe, shape: CounterShape): CounterLayout {
  const cc = shape.length - 2 * r.face;
  const D = (shape.depth - 2 * r.face) / 2;
  const xs = runBreaks(r, cc).map((x) => x - cc / 2);
  const cells = xs.slice(1).map((x, i): CounterCell => ({ x: [xs[i], x], z: [-D, D] }));
  const L = cc / 2;
  const sides: Record<CounterSide, [Pt, Pt]> = { front: [[-L, D], [L, D]], back: [[-L, -D], [L, -D]], left: [[-L, -D], [-L, D]], right: [[L, -D], [L, D]] };
  return { cells, open: shape.open.map((s) => sides[s]) };
}

interface Edge {
  a: Pt;
  b: Pt;
  /** On the outside: the direction out of the counter. Inside (between two parts): none. */
  out?: Dir;
  closed: boolean;
}

/** Every rail of the layout: the sides of its parts, split where another node lies on them, each once (K3). */
function edgesOf(l: CounterLayout): { nodes: Map<string, Pt>; edges: Edge[] } {
  const nodes = new Map<string, Pt>();
  for (const c of l.cells) for (const x of c.x) for (const z of c.z) nodes.set(key([x, z]), [x, z]);
  const pts = [...nodes.values()];
  const seen = new Map<string, Edge & { n: number }>();
  const onOpen = (a: Pt, b: Pt) =>
    l.open.some(([p, q]) => {
      const within = (v: Pt) => Math.abs((q[0] - p[0]) * (v[1] - p[1]) - (q[1] - p[1]) * (v[0] - p[0])) < EPS && v[0] >= Math.min(p[0], q[0]) - EPS && v[0] <= Math.max(p[0], q[0]) + EPS && v[1] >= Math.min(p[1], q[1]) - EPS && v[1] <= Math.max(p[1], q[1]) + EPS;
      return within(a) && within(b);
    });
  for (const c of l.cells) {
    const sides: [Pt, Pt, Dir][] = [
      [[c.x[0], c.z[1]], [c.x[1], c.z[1]], [0, 1]],
      [[c.x[0], c.z[0]], [c.x[1], c.z[0]], [0, -1]],
      [[c.x[0], c.z[0]], [c.x[0], c.z[1]], [-1, 0]],
      [[c.x[1], c.z[0]], [c.x[1], c.z[1]], [1, 0]],
    ];
    for (const [a, b, out] of sides) {
      const i = a[0] === b[0] ? 1 : 0;
      const cuts = [a[i], b[i], ...pts.filter((p) => Math.abs(p[1 - i] - a[1 - i]) < EPS && p[i] > a[i] + EPS && p[i] < b[i] - EPS).map((p) => p[i])].sort((u, v) => u - v);
      for (let k = 1; k < cuts.length; k++) {
        const p: Pt = i ? [a[0], cuts[k - 1]] : [cuts[k - 1], a[1]];
        const q: Pt = i ? [a[0], cuts[k]] : [cuts[k], a[1]];
        const id = `${key(p)}|${key(q)}`;
        const had = seen.get(id);
        if (had) had.n++;
        else seen.set(id, { a: p, b: q, out, closed: true, n: 1 });
      }
    }
  }
  const edges = [...seen.values()].map(({ a, b, out, n }): Edge => (n > 1 ? { a, b, closed: false } : { a, b, out, closed: !onOpen(a, b) }));
  return { nodes, edges };
}

/** The profile for a node joining these directions (K8). */
function nodeProfile(r: CounterRecipe, dirs: Dir[]): string {
  if (dirs.length >= 4) return r.nodes.cross;
  if (dirs.length === 3) return r.nodes.tee;
  return r.nodes.corner;
}

/** Every piece of a counter made of these parts (K2–K5, K7, K8). */
export function layoutBuild(r: CounterRecipe, l: CounterLayout): CounterBuild {
  const { nodes, edges } = edgesOf(l);
  const j = r.joint;
  const f = r.face;
  const rh = r.railHeight;
  const { inset, depth: ch } = r.channel;

  // K2, K8: a post in each node, full height, reaching `joint` toward each rail it takes and `face` elsewhere
  const posts = [...nodes.values()].map((p): CounterProfile => {
    const dirs: Dir[] = [];
    for (const e of edges) {
      const other = key(e.a) === key(p) ? e.b : key(e.b) === key(p) ? e.a : null;
      if (other) dirs.push([Math.sign(other[0] - p[0]), Math.sign(other[1] - p[1])]);
    }
    const has = (d: Dir) => dirs.some((x) => x[0] === d[0] && x[1] === d[1]);
    const reach = (axis: 0 | 1): Range => {
      const lo: Dir = axis ? [0, -1] : [-1, 0];
      const hi: Dir = axis ? [0, 1] : [1, 0];
      return [p[axis] - (has(lo) ? j : f), p[axis] + (has(hi) ? j : f)];
    };
    // Closed faces: the way it does not join (both for a 92L, one for a 93, none for a 94)
    const ox = has([1, 0]) && has([-1, 0]) ? 0 : has([1, 0]) ? -1 : 1;
    const oz = has([0, 1]) && has([0, -1]) ? 0 : has([0, 1]) ? -1 : 1;
    return { code: nodeProfile(r, dirs), role: 'post', len: r.height, axis: 'y', out: [ox, oz], box: { x: reach(0), y: [0, r.height], z: reach(1) } };
  });

  /** The band from `a` to `b` in from the outer face of edge `e` (centred on it inside), along it less `end` each end. */
  const band = (e: Edge, a: number, b: number, end: number): Pick<Box3, 'x' | 'z'> => {
    const alongX = Math.abs(e.a[1] - e.b[1]) < EPS;
    const i = alongX ? 0 : 1;
    const along: Range = [Math.min(e.a[i], e.b[i]) + end, Math.max(e.a[i], e.b[i]) - end];
    const c = e.a[1 - i];
    const o = e.out ? e.out[1 - i] : 0;
    const across: Range = o > 0 ? [c + f - b, c + f - a] : o < 0 ? [c - f + a, c - f + b] : [c - (b - a) / 2, c + (b - a) / 2];
    return alongX ? { x: along, z: across } : { x: across, z: along };
  };
  const lenOf = (e: Edge) => Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]) - 2 * j;
  const axisOf = (e: Edge): 'x' | 'z' => (Math.abs(e.a[1] - e.b[1]) < EPS ? 'x' : 'z');
  const outOf = (e: Edge): [number, number] => (e.out ? [e.out[0], e.out[1]] : [0, 0]);
  const rail = (code: string, role: CounterProfile['role'], e: Edge, deep: number, y: Range): CounterProfile => ({
    code,
    role,
    len: lenOf(e),
    axis: axisOf(e),
    out: outOf(e),
    box: { ...band(e, 0, deep, j), y },
  });

  // K3: rails on every side of every part at the middle and the top, on the floor on the closed sides only. A rail
  // inside the counter carries a top and a shelf on both sides (K8)
  const rails = [
    ...[r.middle, r.top].flatMap((y0) => edges.map((e) => (e.out ? rail(r.rail, 'rail', e, r.postSize, [y0, y0 + rh]) : rail(r.innerRail.code, 'rail', e, r.innerRail.size, [y0, y0 + rh])))),
    ...edges.filter((e) => e.closed).map((e) => rail(r.bottomRail, 'bottomRail', e, r.bottomRailDepth, [0, rh])),
  ];

  // K4: the wall plate in the channels of the closed sides, split at the middle rail
  const t = r.plateThickness / 2;
  const into = ch - r.platePlay / 2;
  const levels = [
    { level: 'lower' as const, y: [rh - ch, r.middle + ch - r.platePlay] as Range },
    { level: 'upper' as const, y: [r.middle + rh - ch, r.top + ch - r.platePlay] as Range },
  ];
  const plates = edges
    .filter((e) => e.closed)
    .flatMap((e) =>
      levels.map(({ level, y }): CounterPlate => ({
        out: e.out!,
        level,
        w: lenOf(e) + 2 * into,
        h: y[1] - y[0],
        box: { ...band(e, inset - t, inset + t, j - into), y },
      })),
    );

  // K5: a top and a shelf on each part, in the rails' notch, short of the rail body by the play
  const body = r.postSize - ch + r.boardPlay - f;
  const boards = l.cells.flatMap((c) =>
    (['shelf', 'top'] as const).map((role): CounterBoard => {
      const y0 = (role === 'top' ? r.top : r.middle) + rh - ch;
      const x: Range = [c.x[0] + body, c.x[1] - body];
      const z: Range = [c.z[0] + body, c.z[1] - body];
      return { role, w: x[1] - x[0], d: z[1] - z[0], box: { x, y: [y0, y0 + r.board.t], z } };
    }),
  );

  const xs = [...nodes.values()].map((p) => p[0]);
  const zs = [...nodes.values()].map((p) => p[1]);
  return {
    length: Math.max(...xs) - Math.min(...xs) + 2 * f,
    depth: Math.max(...zs) - Math.min(...zs) + 2 * f,
    profiles: [...posts, ...rails],
    plates,
    boards,
    couplings: rails.length * 2 * r.coupling.perEnd,
  };
}

/** Every piece of a straight counter of this shape (K1–K5, K7). */
export function counterBuild(r: CounterRecipe, shape: CounterShape): CounterBuild {
  return layoutBuild(r, straightLayout(r, shape));
}

const built = new Map<string, CounterBuild>();
/** The counter of a catalog product (`Product.counter`): the stock shape, open at the back, built once and shared by the
 *  plan, 3D and the cost. */
export function stockCounter(size: { length: number; depth: number }): CounterBuild {
  const key = `${size.length}x${size.depth}`;
  let b = built.get(key);
  if (!b) {
    b = counterBuild(RECIPES.counter, { ...size, open: STOCK_OPEN });
    built.set(key, b);
  }
  return b;
}

/** What a counter built on site is picked as (Byggeregel K7): posts by profile, rails by profile and cut length (with
 *  their 600), plates by colour and size, tops and shelves by size. Keys: code, `code|len`, `ral|w×h`, `long×short`. */
export interface CounterParts {
  posts: Record<string, number>;
  rails: Record<string, number>;
  plates: Record<string, number>;
  boards: Record<string, number>;
}

const bump = (m: Record<string, number>, k: string, n = 1) => {
  m[k] = (m[k] ?? 0) + n;
};

/** The parts of a counter, its plates in `ral` (K6). */
export function counterParts(b: CounterBuild, ral: string): CounterParts {
  const out: CounterParts = { posts: {}, rails: {}, plates: {}, boards: {} };
  for (const p of b.profiles) {
    if (p.role === 'post') bump(out.posts, p.code);
    else bump(out.rails, `${p.code}|${p.len}`);
  }
  for (const p of b.plates) bump(out.plates, `${ral}|${p.w}×${p.h}`);
  for (const x of b.boards) bump(out.boards, `${Math.max(x.w, x.d)}×${Math.min(x.w, x.d)}`);
  return out;
}

/** Two lists of parts added up. */
export function addParts(a: CounterParts, b: CounterParts): CounterParts {
  const out: CounterParts = { posts: { ...a.posts }, rails: { ...a.rails }, plates: { ...a.plates }, boards: { ...a.boards } };
  for (const k of ['posts', 'rails', 'plates', 'boards'] as const) for (const [x, n] of Object.entries(b[k])) bump(out[k], x, n);
  return out;
}

/** Metres of each profile, for the cost. */
export function profileMetres(b: CounterBuild): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of b.profiles) out[x.code] = (out[x.code] ?? 0) + x.len / 1000;
  return out;
}
