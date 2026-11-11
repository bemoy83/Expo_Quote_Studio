// Counter (bardisk 6560) from its recipe, Byggeregler K1–K5 (docs/byggeregler.md): every profile, plate and board with
// its size and where it sits, so 3D draws the box and the kalkyle costs it from the same pieces. Local coordinates in
// mm: x along the counter (0 in the middle), z across it with the closed front at +z, y up from the floor.
import { RECIPES, type CounterRecipe } from './recipes';

export type Range = readonly [number, number];
export interface Box3 {
  x: Range;
  y: Range;
  z: Range;
}

/** Sides of the box. An open side has no plates and no bottom rail (K3, K4): the counter in stock is open at the back. */
export type CounterSide = 'front' | 'back' | 'left' | 'right';

/** What a counter is: its outer size, mm, and the sides left open. A drawn counter (the brush, K1) is made of these. */
export interface CounterShape {
  length: number;
  depth: number;
  open: readonly CounterSide[];
}

/** The counter in stock: open at the back, where the staff stand (K1). */
export const STOCK_OPEN: readonly CounterSide[] = ['back'];

export interface CounterProfile {
  code: string;
  role: 'post' | 'rail' | 'bottomRail';
  /** Cut length, mm. */
  len: number;
  /** Which way it runs: posts up (y), rails along their side. */
  axis: 'x' | 'y' | 'z';
  /** Its outer faces: −1 or 1 along x and z (a rail has one, the other 0). */
  out: readonly [number, number];
  box: Box3;
}

export interface CounterPlate {
  side: CounterSide;
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

export interface CounterBuild extends CounterShape {
  profiles: CounterProfile[];
  plates: CounterPlate[];
  boards: CounterBoard[];
  /** 600 in the rail ends. */
  couplings: number;
}

const SIDES: readonly CounterSide[] = ['front', 'back', 'left', 'right'];
/** Outward direction of a side, along x and z. */
const OUT: Record<CounterSide, readonly [number, number]> = { front: [0, 1], back: [0, -1], left: [-1, 0], right: [1, 0] };

/** Every piece of a counter of this shape. */
export function counterBuild(r: CounterRecipe, shape: CounterShape): CounterBuild {
  const { length, depth, open } = shape;
  const closed = SIDES.filter((s) => !open.includes(s));
  const L = length / 2;
  const D = depth / 2;
  const p = r.postSize;
  const rh = r.railHeight;
  const { inset, depth: ch } = r.channel;
  const sideLen = (s: CounterSide) => (OUT[s][0] ? depth : length);
  const axisOf = (s: CounterSide): 'x' | 'z' => (OUT[s][0] ? 'z' : 'x');
  /** The band from `a` to `b` in from the outer face of side `s`, along the side less `end` at each end. */
  const band = (s: CounterSide, a: number, b: number, end: number): Pick<Box3, 'x' | 'z'> => {
    const [ox, oz] = OUT[s];
    const across = (o: number, half: number): Range => (o > 0 ? [half - b, half - a] : [-half + a, -half + b]);
    return ox ? { x: across(ox, L), z: [-D + end, D - end] } : { x: [-L + end, L - end], z: across(oz, D) };
  };
  /** A rail between the posts on side `s`, `deep` in from its outer face. */
  const rail = (code: string, role: CounterProfile['role'], s: CounterSide, deep: number, y: Range): CounterProfile => ({
    code,
    role,
    len: sideLen(s) - 2 * p,
    axis: axisOf(s),
    out: OUT[s],
    box: { ...band(s, 0, deep, p), y },
  });

  // K2: a post in each corner, full height, closed faces outward
  const posts = [-1, 1].flatMap((ox) =>
    [1, -1].map((oz): CounterProfile => ({
      code: r.post,
      role: 'post',
      len: r.height,
      axis: 'y',
      out: [ox, oz],
      box: { x: ox > 0 ? [L - p, L] : [-L, -L + p], y: [0, r.height], z: oz > 0 ? [D - p, D] : [-D, -D + p] },
    })),
  );
  // K3: rails all round at the middle and the top, on the floor on the closed sides only
  const rails = [
    ...[r.middle, r.top].flatMap((y0) => SIDES.map((s) => rail(r.rail, 'rail', s, p, [y0, y0 + rh]))),
    ...closed.map((s) => rail(r.bottomRail, 'bottomRail', s, r.bottomRailDepth, [0, rh])),
  ];

  // K4: the wall plate in the channels of the closed sides, split at the middle rail
  const t = r.plateThickness / 2;
  const into = ch - r.platePlay / 2;
  const levels = [
    { level: 'lower' as const, y: [rh - ch, r.middle + ch - r.platePlay] as Range },
    { level: 'upper' as const, y: [r.middle + rh - ch, r.top + ch - r.platePlay] as Range },
  ];
  const plates = closed.flatMap((s) =>
    levels.map(({ level, y }): CounterPlate => ({
      side: s,
      level,
      w: sideLen(s) - 2 * p + 2 * into,
      h: y[1] - y[0],
      box: { ...band(s, inset - t, inset + t, p - into), y },
    })),
  );

  // K5: top and shelf in the rails' notch, short of the rail body by the play
  const body = p - ch + r.boardPlay;
  const boards = (['shelf', 'top'] as const).map((role): CounterBoard => {
    const y0 = (role === 'top' ? r.top : r.middle) + rh - ch;
    return { role, w: length - 2 * body, d: depth - 2 * body, box: { x: [-L + body, L - body], y: [y0, y0 + r.board.t], z: [-D + body, D - body] } };
  });

  return { length, depth, open, profiles: [...posts, ...rails], plates, boards, couplings: rails.length * 2 * r.coupling.perEnd };
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

/** Metres of each profile, for the cost. */
export function profileMetres(b: CounterBuild): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of b.profiles) out[x.code] = (out[x.code] ?? 0) + x.len / 1000;
  return out;
}
