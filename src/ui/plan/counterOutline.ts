// A counter's outline in the plan (Byggeregler K8, K16): one figure round the whole counter, made from the boxes of its
// sections, each stretch closed (plates) or open (where its layout leaves it open). Pure, in plan metres,
// so ObjectLayer only draws it.
import { counterLayoutOf, toLocal, unturn } from '../../domain/counterShape'
import { objectBoxes, type PlaceContext } from '../../domain/objects'
import type { PlacedObject, Point } from '../../domain/types'
import { RECIPES } from '../../foga/recipes'

export interface OutlineSide {
  a: Point
  b: Point
  /** Outward from the counter, along x or y. */
  out: Point
  open: boolean
}

const EPS = 1e-6
/** How far past a side (m) to look whether another piece lies there. */
const PROBE = 1e-4
const r6 = (n: number) => Math.round(n * 1e6) / 1e6

/**
 * Every outer side of a counter: each box's edges cut where other boxes' edges cross them, the stretches with another box
 * just outside them dropped (where two pieces of an L meet), the same stretch from two boxes once, and stretches in line
 * with the same state joined again. Open where the counter's layout leaves it open (`counterLayoutOf(o, locked).open`).
 */
export function counterOutline(ctx: Pick<PlaceContext, 'footprint'>, o: PlacedObject, locked: readonly string[] = []): OutlineSide[] {
  const boxes = objectBoxes(ctx, o)
  const xs = [...new Set(boxes.flatMap((b) => [b.x0, b.x1]))]
  const ys = [...new Set(boxes.flatMap((b) => [b.y0, b.y1]))]
  const inside = (p: Point) => boxes.some((b) => p[0] > b.x0 - EPS && p[0] < b.x1 + EPS && p[1] > b.y0 - EPS && p[1] < b.y1 + EPS)
  const open = openAt(o, locked)
  const seen = new Set<string>()
  const sides: OutlineSide[] = []
  for (const b of boxes) {
    const edges: [Point, Point, Point][] = [
      [[b.x0, b.y0], [b.x1, b.y0], [0, -1]],
      [[b.x0, b.y1], [b.x1, b.y1], [0, 1]],
      [[b.x0, b.y0], [b.x0, b.y1], [-1, 0]],
      [[b.x1, b.y0], [b.x1, b.y1], [1, 0]],
    ]
    for (const [a, z, out] of edges) {
      const i = out[1] !== 0 ? 0 : 1
      const cuts = [a[i], z[i], ...(i === 0 ? xs : ys).filter((t) => t > a[i] + EPS && t < z[i] - EPS)].sort((p, q) => p - q)
      for (let k = 1; k < cuts.length; k++) {
        const p: Point = i === 0 ? [cuts[k - 1], a[1]] : [a[0], cuts[k - 1]]
        const q: Point = i === 0 ? [cuts[k], a[1]] : [a[0], cuts[k]]
        const mid: Point = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
        if (inside([mid[0] + out[0] * PROBE, mid[1] + out[1] * PROBE])) continue
        const key = [p, q, out].flat().map(r6).join(',')
        if (seen.has(key)) continue
        seen.add(key)
        sides.push({ a: p, b: q, out, open: open(mid, out) })
      }
    }
  }
  return joined(sides)
}

/** Whether the outer side at plan point `m`, facing `out`, lies on an open stretch of the counter's layout: the
 *  stretch runs through the nodes, `face` in from the outer side (K7). Disker og podier: its open sides not `locked`
 *  against a wall or another counter (K16). */
function openAt(o: PlacedObject, locked: readonly string[]) {
  const { face } = RECIPES.counter
  const stretches = counterLayoutOf(o, locked).open
  return (m: Point, out: Point): boolean => {
    const n = unturn(out, o.rot)
    const l = toLocal(o, m)
    const at: Point = [l[0] - n[0] * face, l[1] - n[1] * face]
    // The side runs across its outward direction, and so must the stretch
    const side = n[0] !== 0 ? 1 : 0
    return stretches.some(([p, q]) => {
      const along = Math.abs(p[1] - q[1]) < EPS ? 0 : 1
      if (along !== side || Math.abs(at[1 - along] - p[1 - along]) > 1) return false
      const [lo, hi] = [Math.min(p[along], q[along]), Math.max(p[along], q[along])]
      return at[along] > lo - face - 1 && at[along] < hi + face + 1
    })
  }
}

/** Sides in line, touching, facing the same way and of the same state as one. */
function joined(sides: OutlineSide[]): OutlineSide[] {
  const out: OutlineSide[] = []
  const key = (s: OutlineSide) => `${s.out}|${s.open}|${r6(s.out[1] !== 0 ? s.a[1] : s.a[0])}`
  const groups = new Map<string, OutlineSide[]>()
  for (const s of sides) groups.set(key(s), [...(groups.get(key(s)) ?? []), s])
  for (const g of groups.values()) {
    const i = g[0].out[1] !== 0 ? 0 : 1
    g.sort((p, q) => p.a[i] - q.a[i])
    let cur = g[0]
    for (const s of g.slice(1)) {
      if (Math.abs(s.a[i] - cur.b[i]) < EPS) cur = { ...cur, b: s.b }
      else {
        out.push(cur)
        cur = s
      }
    }
    out.push(cur)
  }
  return out
}
