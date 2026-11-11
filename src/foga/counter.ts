// Counter (bardisk 6560) from its recipe, Byggeregler K1–K5 (docs/byggeregler.md): every profile, plate and board with
// its size and where it sits, so 3D draws the box and the kalkyle costs it from the same pieces. Local coordinates in
// mm: x along the counter (0 in the middle), z across it with the closed front at +z, y up from the floor.
import type { CounterRecipe } from './recipes';

export type Range = readonly [number, number];
export interface Box3 {
  x: Range;
  y: Range;
  z: Range;
}

/** Sides of the box. The back (−z) is open: no plates and no bottom rail (K3, K4). */
export type CounterSide = 'front' | 'back' | 'left' | 'right';

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

export interface CounterBuild {
  length: number;
  depth: number;
  profiles: CounterProfile[];
  plates: CounterPlate[];
  boards: CounterBoard[];
  /** 600 in the rail ends. */
  couplings: number;
}

const CLOSED: readonly CounterSide[] = ['front', 'left', 'right'];
/** Outward direction of a side, along x and z. */
const OUT: Record<CounterSide, readonly [number, number]> = { front: [0, 1], back: [0, -1], left: [-1, 0], right: [1, 0] };

/** The counter of outer size `length` × `depth`, mm. */
export function counterBuild(r: CounterRecipe, length: number, depth: number): CounterBuild {
  const L = length / 2, D = depth / 2, p = r.postSize, H = r.height, rh = r.railHeight
  const { inset, depth: ch } = r.channel
  /** From the outer face of side `s` in by `a` to `b`, and along the side between the posts (inner by `along`). */
  const band = (s: CounterSide, a: number, b: number, along: number): Pick<Box3, 'x' | 'z'> => {
    const [ox, oz] = OUT[s]
    const across = (o: number, half: number): Range => (o > 0 ? [half - b, half - a] : [-half + a, -half + b])
    return ox ? { x: across(ox, L), z: [-D + along, D - along] } : { x: [-L + along, L - along], z: across(oz, D) }
  }
  const sideLen = (s: CounterSide) => (OUT[s][0] ? depth : length)
  const axisOf = (s: CounterSide): 'x' | 'z' => (OUT[s][0] ? 'z' : 'x')

  const profiles: CounterProfile[] = []
  // K2: a post in each corner, full height, closed faces outward
  for (const ox of [-1, 1]) for (const oz of [1, -1]) {
    profiles.push({
      code: r.post, role: 'post', len: H, axis: 'y', out: [ox, oz],
      box: { x: ox > 0 ? [L - p, L] : [-L, -L + p], y: [0, H], z: oz > 0 ? [D - p, D] : [-D, -D + p] },
    })
  }
  // K3: rails between the posts, all round at the middle and the top, on the floor on the closed sides
  const sides: CounterSide[] = ['front', 'back', 'left', 'right']
  for (const y0 of [r.middle, r.top]) for (const s of sides) {
    profiles.push({ code: r.rail, role: 'rail', len: sideLen(s) - 2 * p, axis: axisOf(s), out: OUT[s], box: { ...band(s, 0, p, p), y: [y0, y0 + rh] } })
  }
  for (const s of CLOSED) {
    profiles.push({ code: r.bottomRail, role: 'bottomRail', len: sideLen(s) - 2 * p, axis: axisOf(s), out: OUT[s], box: { ...band(s, 0, r.bottomRailDepth, p), y: [0, rh] } })
  }
  const rails = profiles.filter((x) => x.role !== 'post').length

  // K4: the wall plate in the channels of the closed sides, split at the middle rail
  const t = r.plateThickness / 2
  const into = ch - r.platePlay / 2
  const levels = [
    { level: 'lower' as const, y: [rh - ch, r.middle + ch - r.platePlay] as Range },
    { level: 'upper' as const, y: [r.middle + rh - ch, r.top + ch - r.platePlay] as Range },
  ]
  const plates: CounterPlate[] = CLOSED.flatMap((s) =>
    levels.map(({ level, y }) => {
      const w = sideLen(s) - 2 * p + 2 * into
      return { side: s, level, w, h: y[1] - y[0], box: { ...band(s, inset - t, inset + t, p - into), y } }
    }),
  )

  // K5: top and shelf in the rails' notch, short of the rail body by the play
  const body = p - ch + r.boardPlay
  const boards: CounterBoard[] = (['shelf', 'top'] as const).map((role) => {
    const y0 = (role === 'top' ? r.top : r.middle) + rh - ch
    return { role, w: length - 2 * body, d: depth - 2 * body, box: { x: [-L + body, L - body], y: [y0, y0 + r.board.t], z: [-D + body, D - body] } }
  })

  return { length, depth, profiles, plates, boards, couplings: rails * 2 * r.coupling.perEnd }
}

/** Metres of each profile, for the cost. */
export function profileMetres(b: CounterBuild): Record<string, number> {
  const out: Record<string, number> = {}
  for (const x of b.profiles) out[x.code] = (out[x.code] ?? 0) + x.len / 1000
  return out
}
