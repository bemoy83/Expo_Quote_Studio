// Counters of Disker og podier from their recipe, Byggeregler K1–K12, K16–K19 (docs/byggeregler.md): every profile,
// plate and board with its size and where it sits, so plan, 3D and the kalkyle read the same pieces. A counter is
// parts (sections) between nodes (K10), with a rail between each two (K3). The profile in a node follows the
// directions it joins (K8): two at a right angle a 92L, three a 93, four a 94; the rails are as long whatever stands
// in the node. Each part is as high as its own (K12), with a shelf where it has one (K19) on four rails round it that
// split its plates into light openings (K16), each a plate, open or a sliding door (K17). Bardisk 6560 is one such part
// (K22). Local coordinates in mm: x along the counter, z across it with the front at +z, y up from the floor. Nodes
// sit 10 mm in from the outer face, so the outer size is the nodes' c/c + 20.
import type { CounterRecipe } from './recipes';

export type Range = readonly [number, number];
export interface Box3 {
  x: Range;
  y: Range;
  z: Range;
}

/** A part of the counter between four nodes, carrying a top and a shelf (K5), in node coordinates, mm. A section of
 *  Disker og podier (K10–K12) carries its own height `h`: CC, the underside of its top rail, mm. */
export interface CounterCell {
  x: Range;
  z: Range;
  h?: number;
  /** Tight (K19): the CC heights of its shelves, mm, each lower than `h`. */
  shelves?: readonly number[];
}

/** What a light opening of a part is (K16, K17): a plate (null), open or a sliding door. */
export type LightKind = 'open' | 'door' | null;
/** A part of the outside, node to node, and what each of its light openings is, from the floor (K16). */
export interface CounterLights {
  a: Pt;
  b: Pt;
  kinds: readonly LightKind[];
  /** A colour of its own on each light opening, from the floor (K6); null or none: the counter's. */
  rals?: readonly (string | null)[];
}

/** What a counter is made of, in node coordinates (mm): its parts, and the stretches of its outside left open, each
 *  from one node to another. Any shape the parts make joins up by the same rules (K8). */
export interface CounterLayout {
  cells: readonly CounterCell[];
  open: readonly (readonly [Pt, Pt])[];
  /** Tight: parts of the outside with a light opening open or closed by a sliding door (K16, K17); the rest of a part
   *  open in every light opening is in `open`. */
  lights?: readonly CounterLights[];
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
  /** Split at the middle rail (K4), or one plate the whole height (K11); a step (K12); one leaf of a sliding door (K17). */
  level: 'full' | 'step' | 'door';
  /** Order size, mm: along the side × high. */
  w: number;
  h: number;
  box: Box3;
  /** Its colour of its own (K6); none: the counter's. A step takes the counter's. */
  ral?: string;
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

interface Edge {
  a: Pt;
  b: Pt;
  /** On the outside: the direction out of the counter. Inside (between two parts): none. */
  out?: Dir;
  closed: boolean;
  /** What its light openings are, from the floor (K16, K17); none: plates. */
  kinds?: readonly LightKind[];
  /** Their colours of their own (K6); none: the counter's. */
  rals?: readonly (string | null)[];
}

/** Every rail of the layout: the sides of its parts, split where another node lies on them, each once (K3). */
function edgesOf(l: CounterLayout): { nodes: Map<string, Pt>; edges: Edge[] } {
  const nodes = new Map<string, Pt>();
  for (const c of l.cells) for (const x of c.x) for (const z of c.z) nodes.set(key([x, z]), [x, z]);
  const pts = [...nodes.values()];
  const seen = new Map<string, Edge & { n: number }>();
  // An edge lies on a stretch when both its ends lie on the stretch's line, between its ends
  const onStretch = (a: Pt, b: Pt, p: Pt, q: Pt) => {
    const within = (v: Pt) => Math.abs((q[0] - p[0]) * (v[1] - p[1]) - (q[1] - p[1]) * (v[0] - p[0])) < EPS && v[0] >= Math.min(p[0], q[0]) - EPS && v[0] <= Math.max(p[0], q[0]) + EPS && v[1] >= Math.min(p[1], q[1]) - EPS && v[1] <= Math.max(p[1], q[1]) + EPS;
    return within(a) && within(b);
  };
  const onOpen = (a: Pt, b: Pt) => l.open.some(([p, q]) => onStretch(a, b, p, q));
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
  const edges = [...seen.values()].map(({ a, b, out, n }): Edge => {
    if (n > 1) return { a, b, closed: false };
    const closed = !onOpen(a, b);
    const lit = closed ? l.lights?.find((x) => onStretch(a, b, x.a, x.b)) : undefined;
    return { a, b, out, closed, ...(lit?.kinds.some((k) => k) && { kinds: lit.kinds }), ...(lit?.rals?.some((r) => r) && { rals: lit.rals }) };
  });
  return { nodes, edges };
}

/** The profile for a node joining these directions (K8). */
function nodeProfile(r: CounterRecipe, dirs: Dir[]): string {
  if (dirs.length >= 4) return r.nodes.cross;
  if (dirs.length === 3) return r.nodes.tee;
  return r.nodes.corner;
}

/** Every piece of a counter made of these parts (K2–K5, K7, K8, K10–K12): each part as high as its own `h`, a shelf
 *  where it has one (K19), one plate in each light opening (K16). 6560 is one such part (K22). */
export function layoutBuild(r: CounterRecipe, l: CounterLayout): CounterBuild {
  const { nodes, edges } = edgesOf(l);
  const j = r.joint;
  const f = r.face;
  const rh = r.railHeight;
  const { inset, depth: ch } = r.channel;
  // K12: a part's top rail stands with its underside at the part's height; a post shared by parts of two heights goes
  // to the higher
  const onEdge = (e: Edge, c: CounterCell) => {
    const alongX = Math.abs(e.a[1] - e.b[1]) < EPS;
    const [i, k] = alongX ? [0, 1] : [1, 0];
    const lo = Math.min(e.a[i], e.b[i]);
    const hi = Math.max(e.a[i], e.b[i]);
    const cr = i === 0 ? c.x : c.z;
    const ar = k === 0 ? c.x : c.z;
    return lo > cr[0] - EPS && hi < cr[1] + EPS && (Math.abs(e.a[k] - ar[0]) < EPS || Math.abs(e.a[k] - ar[1]) < EPS);
  };
  const cellTop = (c: CounterCell) => c.h ?? r.top;
  const edgeTop = (e: Edge) => Math.max(...l.cells.filter((c) => onEdge(e, c)).map(cellTop));
  /** K19: the CC heights of the shelves along an edge, of the part behind it or of both parts inside. */
  const shelvesOn = (e: Edge) => [...new Set(l.cells.filter((c) => onEdge(e, c)).flatMap((c) => c.shelves ?? []))].sort((a, b) => a - b);
  /** K12: an edge inside the counter between parts of two heights, a step: the low height, and the way down to the
   *  low part (the step's face). */
  const stepOf = (e: Edge): { lo: number; out: [number, number] } | null => {
    if (e.out) return null;
    const by = l.cells.filter((c) => onEdge(e, c));
    if (by.length < 2) return null;
    const low = by.reduce((m, c) => (cellTop(c) < cellTop(m) ? c : m));
    if (edgeTop(e) - cellTop(low) < EPS) return null;
    const alongX = Math.abs(e.a[1] - e.b[1]) < EPS;
    const across = alongX ? low.z : low.x;
    const dir = Math.sign((across[0] + across[1]) / 2 - (alongX ? e.a[1] : e.a[0]));
    return { lo: cellTop(low), out: alongX ? [0, dir] : [dir, 0] };
  };
  const nodeTop = (p: Pt) => Math.max(...l.cells.filter((c) => p[0] > c.x[0] - EPS && p[0] < c.x[1] + EPS && p[1] > c.z[0] - EPS && p[1] < c.z[1] + EPS).map(cellTop));

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
    const len = nodeTop(p) + rh;
    return { code: nodeProfile(r, dirs), role: 'post', len, axis: 'y', out: [ox, oz], box: { x: reach(0), y: [0, len], z: reach(1) } };
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

  // K3, K11: a top rail on every side of every part, a 94 between two parts carrying the top on both sides (K8), and a
  // bottom rail on every outer side (below). A step (K12): the high part's top rail as on an outer side, facing the
  // low part, and a 94 under the low top
  const railsAt = (e: Edge, y0: number) => (e.out ? rail(r.rail, 'rail', e, r.postSize, [y0, y0 + rh]) : rail(r.innerRail.code, 'rail', e, r.innerRail.size, [y0, y0 + rh]));
  const topRails = (e: Edge) => {
    const s = stepOf(e);
    if (!s) return [railsAt(e, edgeTop(e))];
    const hi = edgeTop(e);
    return [rail(r.rail, 'rail', { ...e, out: s.out }, r.postSize, [hi, hi + rh]), railsAt(e, s.lo)];
  };
  // K19: a shelf stands on a rail on each side of its part, as the middle rail of 6560: a 93 outside, a 94 toward a
  // neighbour (one shared by two shelves at the same height); on a step above the low top a 93 facing the low part,
  // and none where the low top's 94 already is
  const shelfRails = (e: Edge) => {
    const st = stepOf(e);
    return shelvesOn(e).flatMap((y) => {
      if (st && Math.abs(y - st.lo) < EPS) return [];
      if (st && y > st.lo) return [rail(r.rail, 'rail', { ...e, out: st.out }, r.postSize, [y, y + rh])];
      return [railsAt(e, y)];
    });
  };
  // K3, K11, K16: a bottom rail on every outer side, also where the part is open from the floor (the back of 6560)
  const rails = [
    ...edges.flatMap((e) => [...topRails(e), ...shelfRails(e)]),
    ...edges.filter((e) => e.out).map((e) => rail(r.bottomRail, 'bottomRail', e, r.bottomRailDepth, [0, rh])),
  ];

  // K4, K11, K16: the wall plate in the channels of the closed sides, one in each light opening, from the rail under it
  // to the rail over it; without shelves one the whole height
  const t = r.plateThickness / 2;
  const into = ch - r.platePlay / 2;
  /** The plate's height between two rails with their undersides at CC y0 and y1 (y0 0: the bottom rail). */
  const between = (y0: number, y1: number): Range => [y0 + rh - ch, y1 + ch - r.platePlay];
  const plateLevels = (e: Edge): { y: Range; kind: LightKind; ral?: string }[] => {
    const cuts = [0, ...shelvesOn(e), edgeTop(e)];
    return cuts.slice(1).map((y, i) => ({ y: between(cuts[i], y), kind: e.kinds?.[i] ?? null, ...(e.rals?.[i] && { ral: e.rals[i]! }) }));
  };
  const plateOf = (e: Edge, level: CounterPlate['level'], y: Range, ral?: string): CounterPlate => ({
    out: e.out!,
    level,
    w: lenOf(e) + 2 * into,
    h: y[1] - y[0],
    box: { ...band(e, inset - t, inset + t, j - into), y },
    ...(ral && { ral }),
  });
  // K12: a step is closed with a plate on the high side, from the low top rail up to the high one, split at a shelf's
  // rail between them (K19)
  const steps = edges.flatMap((e) => {
    const s = stepOf(e);
    if (!s) return [];
    const cuts = [s.lo, ...shelvesOn(e).filter((y) => y > s.lo + EPS), edgeTop(e)];
    return cuts.slice(1).map((y, i) => plateOf({ ...e, out: s.out }, 'step', between(cuts[i], y)));
  });
  // K17: a sliding door, two leaves in the channel instead of the plate, each half the light opening + 10 overlap + 10
  // into the channel; the second just inside the first, so the two slide past each other
  const doorLeaves = (e: Edge, y: Range, ral?: string): CounterPlate[] => {
    const whole = plateOf(e, 'door', y, ral);
    const w = lenOf(e) / 2 + r.door.overlap + r.door.track;
    const alongX = Math.abs(e.a[1] - e.b[1]) < EPS;
    const run = alongX ? whole.box.x : whole.box.z;
    const across = alongX ? whole.box.z : whole.box.x;
    const o = e.out![alongX ? 1 : 0];
    const inner: Range = [across[0] - o * r.plateThickness, across[1] - o * r.plateThickness];
    const leaf = (along: Range, at: Range): CounterPlate => ({ ...whole, w, box: alongX ? { x: along, y: whole.box.y, z: at } : { x: at, y: whole.box.y, z: along } });
    return [leaf([run[0], run[0] + w], across), leaf([run[1] - w, run[1]], inner)];
  };
  const plates = [
    ...edges.filter((e) => e.closed).flatMap((e) => plateLevels(e).flatMap(({ y, kind, ral }) => (kind === 'open' ? [] : kind === 'door' ? doorLeaves(e, y, ral) : [plateOf(e, 'full', y, ral)]))),
    ...steps,
  ];

  // K5, K19: a top on each part and its own shelves, in the rails' notch, short of the rail body by the play
  const body = r.postSize - ch + r.boardPlay - f;
  const boards = l.cells.flatMap((c) =>
    [...(c.shelves ?? []).map((y) => ['shelf', y] as const), ['top', cellTop(c)] as const].map(([role, at]): CounterBoard => {
      const y0 = at + rh - ch;
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

/** What a counter built on site is picked as (Byggeregel K7): posts by profile, rails by profile and cut length (with
 *  their 600), plates by colour and size, tops and shelves by size. Keys: `code|len` for posts and rails, `ral|w×h`, `long×short`. */
export interface CounterParts {
  posts: Record<string, number>;
  rails: Record<string, number>;
  plates: Record<string, number>;
  boards: Record<string, number>;
}

const bump = (m: Record<string, number>, k: string, n = 1) => {
  m[k] = (m[k] ?? 0) + n;
};

/** The parts of a counter, its plates in their own colour or else `ral`, the counter's (K6). */
export function counterParts(b: CounterBuild, ral: string): CounterParts {
  const out: CounterParts = { posts: {}, rails: {}, plates: {}, boards: {} };
  for (const p of b.profiles) {
    if (p.role === 'post') bump(out.posts, `${p.code}|${p.len}`);
    else bump(out.rails, `${p.code}|${p.len}`);
  }
  for (const p of b.plates) bump(out.plates, `${p.ral ?? ral}|${p.w}×${p.h}`);
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
