// What the drawer for a counter of Disker og podier shows (trinn 2): its sides in order round it, named after the stand
// side each faces, the side chosen, and that side seen from outside, left to right, part by part. Pure, with tests.
import { toPlan, turn } from '../../../domain/counterShape'
import { podiumDecals, podiumPrints } from '../../../domain/podiumDecor'
import { lightsOf, partKey, partsOn, type PodiumPart } from '../../../domain/podiumFaces'
import type { Crop } from '../../../domain/print'
import { podiumSides, type PodiumSide } from '../../../domain/podiums'
import type { CounterLight, PlacedObject, Side } from '../../../domain/types'
import { RECIPES } from '../../../foga/recipes'

const R = RECIPES.counter
const EPS = 1e-6

/** The stand side a direction on the plan faces (front toward +y). */
const facingOf = (d: [number, number]): Side => (d[1] > 0 ? 'front' : d[1] < 0 ? 'back' : d[0] < 0 ? 'left' : 'right')
const NAMES: Record<Side, string> = { front: 'front', back: 'bak', left: 'venstre', right: 'høyre' }

/** A straight side of the outline as the drawer names it: «mot front», «mot bak 2». */
export interface DrawerSide {
  side: PodiumSide
  key: string
  facing: Side
  name: string
}

/** A side's key, kept while the side stands where it stands. */
export const sideKeyOf = (s: PodiumSide) => `${s.axis}${s.out}:${s.at}:${s.a}`

/** The direction along a side that runs left to right for one standing outside it, in the counter's frame. */
const rightward = (s: PodiumSide): 1 | -1 => (s.axis === 'z' ? s.out : (-s.out as 1 | -1))

/** The sides of a counter, clockwise round its outline on the plan from the longest facing front (of two, the one
 *  nearer the stand's front; else the first), each
 *  named after the stand side it faces; sides facing the same way are numbered in that order. */
export function drawerSides(o: PlacedObject): DrawerSide[] {
  const sides = podiumSides(o.sections ?? [])
  if (!sides.length) return []
  const facingOf_ = (s: PodiumSide) => turn(s.axis === 'x' ? [s.out, 0] : [0, s.out], o.rot) as [number, number]
  // Each side as a step round the outline, the counter on its right (clockwise on the plan, y down)
  const ends = sides.map((s) => {
    const [p, q] = s.axis === 'x' ? [toPlan(o, [s.at, s.a]), toPlan(o, [s.at, s.b])] : [toPlan(o, [s.a, s.at]), toPlan(o, [s.b, s.at])]
    const n = facingOf_(s)
    const d = [-n[1], n[0]]
    return (q[0] - p[0]) * d[0] + (q[1] - p[1]) * d[1] > 0 ? { from: p, to: q } : { from: q, to: p }
  })
  const near = (a: Readonly<[number, number]>, b: Readonly<[number, number]>) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6
  const len = (s: PodiumSide) => s.b - s.a
  const fronts = sides.map((_, i) => i).filter((i) => facingOf(facingOf_(sides[i])) === 'front')
  // The longest; of two as long, the one nearer the front of the stand
  const lowY = (i: number) => ends[i].from[1]
  const first = fronts.length ? fronts.reduce((m, i) => (len(sides[i]) > len(sides[m]) || (len(sides[i]) === len(sides[m]) && lowY(i) > lowY(m) + 1e-6) ? i : m)) : 0
  const order: number[] = [first]
  const left = new Set(sides.map((_, i) => i).filter((i) => i !== first))
  while (left.size) {
    const at = ends[order[order.length - 1]].to
    const next = [...left].find((i) => near(ends[i].from, at)) ?? [...left][0]
    order.push(next)
    left.delete(next)
  }
  const facing = order.map((i) => facingOf(facingOf_(sides[i])))
  const count = new Map<Side, number>()
  return order.map((i, k) => {
    const f = facing[k]
    const n = (count.get(f) ?? 0) + 1
    count.set(f, n)
    const many = facing.filter((x) => x === f).length > 1
    return { side: sides[i], key: sideKeyOf(sides[i]), facing: f, name: `mot ${NAMES[f]}${many ? ` ${n}` : ''}` }
  })
}

/** The side the drawer shows: the one chosen, else the first (the longest facing front). */
export function chosenSide(sides: DrawerSide[], key?: string): number {
  return Math.max(0, key ? sides.findIndex((s) => s.key === key) : 0)
}

/** The side of `o` nearest a plan point: the one a click on the counter picks. */
export function nearestSide(o: PlacedObject, q: [number, number]): string | undefined {
  let best: { key: string; d: number } | null = null
  for (const s of podiumSides(o.sections ?? [])) {
    const [p0, p1] = s.axis === 'x' ? [toPlan(o, [s.at, s.a]), toPlan(o, [s.at, s.b])] : [toPlan(o, [s.a, s.at]), toPlan(o, [s.b, s.at])]
    const [dx, dy] = [p1[0] - p0[0], p1[1] - p0[1]]
    const t = Math.max(0, Math.min(1, ((q[0] - p0[0]) * dx + (q[1] - p0[1]) * dy) / (dx * dx + dy * dy || 1)))
    const d = Math.hypot(q[0] - p0[0] - t * dx, q[1] - p0[1] - t * dy)
    if (!best || d < best.d - EPS) best = { key: sideKeyOf(s), d }
  }
  return best?.key
}

/** Where a point along a side (counter frame, mm) is seen from outside: mm from the outer face at the left end. */
const fromLeft = (side: PodiumSide) => (t: number) => (rightward(side) > 0 ? t - side.a : side.b - t) + R.face

/** One part of the side seen from outside: from x0 to x1 (mm from the outer face at the left end), its node line ends
 *  n0 and n1, how high its section is (CC, the underside of the top rail), its section's shelves (CC, low to high),
 *  what each light opening is from the floor (K16) and whether it is held a plate. */
export interface ElevationPart {
  part: PodiumPart
  key: string
  x0: number
  x1: number
  n0: number
  n1: number
  h: number
  shelves: readonly number[]
  lights: (CounterLight | null)[]
  locked: boolean
}

/** The side seen from outside, left to right: its parts, the outer length (mm) and the highest section's CC. */
export function sideElevation(o: PlacedObject, side: PodiumSide, locked: ReadonlySet<string> = new Set()): { parts: ElevationPart[]; length: number; h: number } {
  const sections = o.sections ?? []
  const len = side.b - side.a
  const x = fromLeft(side)
  const parts = partsOn(sections, side)
    .map((p): ElevationPart => {
      const [n0, n1] = [x(p.a), x(p.b)].sort((a, b) => a - b)
      const key = partKey(p)
      const s = sections[p.section]
      return { part: p, key, n0, n1, x0: n0, x1: n1, h: s.h, shelves: s.shelves ?? [], lights: lightsOf(sections, p), locked: locked.has(key) }
    })
    .sort((p, q) => p.n0 - q.n0)
  // The ends out to the outer face
  if (parts.length) {
    parts[0].x0 = 0
    parts[parts.length - 1].x1 = len + 2 * R.face
  }
  return { parts, length: len + 2 * R.face, h: Math.max(...parts.map((p) => p.h), 0) }
}

/** The light openings of a part as CC bands from the floor (K16): [0, first shelf], …, [last shelf, top]. */
export const lightBands = (p: Pick<ElevationPart, 'h' | 'shelves'>): [number, number][] => {
  const cuts = [0, ...p.shelves, p.h]
  return cuts.slice(1).map((y, i) => [cuts[i], y])
}

/** Print and a decal on the side seen from outside (K20), mm from the outer face at the left end and up from the floor. */
export interface ElevationPrint {
  x0: number
  x1: number
  y0: number
  y1: number
  motif: string
  crop: Crop
}
export interface ElevationDecal {
  id: string
  motif: string
  /** The part it is on (partKey). */
  key: string
  x0: number
  x1: number
  y0: number
  y1: number
}

/** The print windows and decals of a side, as the drawing shows them. `ratio`: a motif's width / height. */
export function sideDecor(o: PlacedObject, side: PodiumSide, locked: ReadonlySet<string>, ratio: (motif: string) => number): { prints: ElevationPrint[]; decals: ElevationDecal[] } {
  const sections = o.sections ?? []
  const x = fromLeft(side)
  const on = (p: PodiumPart) => p.axis === side.axis && p.out === side.out && Math.abs(p.at - side.at) < EPS && p.a > side.a - EPS && p.b < side.b + EPS
  const span = (t0: number, t1: number) => [x(t0), x(t1)].sort((a, b) => a - b)
  return {
    prints: podiumPrints(sections, locked, ratio)
      .filter((w) => on(w.part))
      .map((w) => {
        const [x0, x1] = span(w.t0, w.t1)
        return { x0, x1, y0: w.y0, y1: w.y1, motif: w.motif, crop: w.crop }
      }),
    decals: podiumDecals(sections, locked)
      .filter((d) => on(d.part))
      .map((d) => {
        const [x0, x1] = span(d.t0, d.t1)
        return { id: d.decal.id, motif: d.decal.motif, key: partKey(d.part), x0, x1, y0: d.y0, y1: d.y1 }
      }),
  }
}
