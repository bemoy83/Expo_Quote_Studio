// Where the plan changes between the sketch and the next variant the pen would store (docs/forhandsvisning.md): per plan
// layer, the boxes of what is different. The plan hides the old things there (`mask`) and draws the next variant at
// preview strength inside `clip`, so nothing else on the plan is drawn twice. Consequences count too: posts, foot plates,
// beams split by a new wall, furniture a new wall now conflicts with, textile fitted to a door.
import type { CalcResult } from '../../calc/calc'
import { cornerPosts } from '../../calc/textile/free'
import { foilSpan } from '../../domain/decor'
import { faceSegment, sideOf } from '../../domain/faces'
import { CELL } from '../../domain/grid'
import { footprintBox } from '../../domain/objects'
import { shelfBox, shelvesOf } from '../../domain/shelves'
import type { Point, Variant } from '../../domain/types'
import type { BuiltModule } from '../../domain/walls'
import { RECIPES } from '../../foga/recipes'
import { place, rules } from '../env'

/** A box in the plan, metres. */
export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** One side of the comparison: the variant and what the plan derives from it. */
export interface PlanState {
  v: Variant
  res: CalcResult
  mods: BuiltModule[]
  /** Furniture in conflict. */
  bad: Set<string>
}

/** Per layer: `mask` hides what the sketch has there, `clip` is where the next variant is drawn. */
export interface LayerArea {
  mask: Box[]
  clip: Box[]
}

export const AREA_LAYERS = ['floor', 'walls', 'textile', 'shelves', 'beams', 'objects', 'rooms'] as const
export type AreaLayer = (typeof AREA_LAYERS)[number]
export type Areas = Record<AreaLayer, LayerArea>

/** Room around a wall module for its ink edge and the joint to the next one, m. */
const WALL_PAD = 0.12
/** Room across a module with a door or curtain for its leaf and swing. */
const SWING_PAD = 1.05
const LINE_PAD = 0.15
const POST_PAD = 0.1
/** Room around a free-standing textile wall: foot plates, corner posts and its label. */
const FREE_PAD = 0.55

export const segBox = (a: Point, b: Point, pad: number, across = pad): Box => {
  const h = a[1] === b[1]
  const [px, py] = h ? [pad, across] : [across, pad]
  return { x0: Math.min(a[0], b[0]) - px, y0: Math.min(a[1], b[1]) - py, x1: Math.max(a[0], b[0]) + px, y1: Math.max(a[1], b[1]) + py }
}
const pointBox = (p: Point, hw: number, hd = hw): Box => ({ x0: p[0] - hw, y0: p[1] - hd, x1: p[0] + hw, y1: p[1] + hd })

/**
 * The things of one kind that differ between two lists, compared by their drawing (`look`) under the same key: the
 * boxes of the old ones (to hide) and of the new ones (to draw).
 */
function diff<T>(a: readonly T[], b: readonly T[], key: (x: T) => string, look: (x: T) => unknown, box: (x: T) => Box | null): LayerArea {
  const before = new Map(a.map((x) => [key(x), x]))
  const after = new Map(b.map((x) => [key(x), x]))
  const same = (x: T, y: T | undefined) => y !== undefined && JSON.stringify(look(x)) === JSON.stringify(look(y))
  const mask: Box[] = []
  const clip: Box[] = []
  for (const [k, x] of before) {
    if (same(x, after.get(k))) continue
    const bx = box(x)
    if (bx) mask.push(bx)
  }
  for (const [k, y] of after) {
    if (same(y, before.get(k))) continue
    const bx = box(y)
    if (bx) clip.push(bx)
  }
  return { mask, clip: [...mask, ...clip] }
}

const join = (...xs: LayerArea[]): LayerArea => ({ mask: xs.flatMap((x) => x.mask), clip: xs.flatMap((x) => x.clip) })
const pt = (p: Point) => `${p[0]},${p[1]}`

/** What differs between the sketch `a` and the next variant `b`, per plan layer. */
export function changedAreas(a: PlanState, b: PlanState): Areas {
  const modBox = (m: BuiltModule) => segBox(m.a, m.b, WALL_PAD, m.opening ? SWING_PAD : WALL_PAD)
  const walls = diff(a.mods, b.mods, (m) => m.key, (m) => [m.a, m.b, m.plate, m.opening], modBox)

  const floor = floorDiff(a.v, b.v)

  const faceBox = (v: Variant) => (x: { wallId: string; side?: 1 | -1 }, from: number, to: number) => {
    const w = v.walls.find((y) => y.id === x.wallId)
    if (!w) return null
    const [p, q] = faceSegment(w, sideOf(v, x), from, to, 0)
    return segBox(p, q, LINE_PAD, 0.25)
  }
  const textileOf = (s: PlanState) => s.v.textiles.map((t) => ({ t, box: faceBox(s.v)(t, t.from, t.from + t.width) }))
  const foilOf = (s: PlanState) => s.v.foils.map((f) => ({ f, box: faceBox(s.v)(f, ...foilSpan(rules, f)) }))
  const freeOf = (s: PlanState) => s.res.production.free.map((f) => ({ f, t: s.v.freeTextiles.find((x) => x.id === f.textileId) }))
  const textile = join(
    diff(textileOf(a), textileOf(b), (x) => x.t.id, (x) => [x.t, x.box], (x) => x.box),
    diff(foilOf(a), foilOf(b), (x) => x.f.id, (x) => [x.f, x.box], (x) => x.box),
    diff(freeOf(a), freeOf(b), (x) => x.f.textileId, (x) => [x.t, x.f.supports, x.f.length, x.f.pos], (x) => (x.t ? segBox(x.t.from, x.t.to, FREE_PAD) : null)),
    diff(cornerPosts(a.v), cornerPosts(b.v), pt, pt, (p) => pointBox(p, POST_PAD)),
  )

  // Shelves by their board; one more in a stacked felt changes the count drawn there
  const shelfOf = (s: PlanState) => shelvesOf(s.v).map((f) => ({ f, box: shelfBox(s.v, rules, f) }))
  const pad = (bx: Box | null) => bx && { x0: bx.x0 - 0.05, y0: bx.y0 - 0.05, x1: bx.x1 + 0.05, y1: bx.y1 + 0.05 }
  const shelves = diff(shelfOf(a), shelfOf(b), (x) => x.f.id, (x) => [x.f, x.box], (x) => pad(x.box))

  const foot = RECIPES.wall.support.foot
  const beams = join(
    diff(a.res.beams.segments, b.res.beams.segments, (s) => `${pt(s.from)}-${pt(s.to)}`, (s) => s, (s) => segBox(s.from, s.to, LINE_PAD)),
    diff(a.res.posts, b.res.posts, pt, pt, (p) => pointBox(p, POST_PAD)),
    diff(a.res.wallSupports, b.res.wallSupports, (s) => pt(s.at), (s) => s, (s) => {
      const [w, d] = s.orientation === 'h' ? [foot.along, foot.across] : [foot.across, foot.along]
      return pointBox(s.at, w / 2000 + 0.05, d / 2000 + 0.05)
    }),
  )

  const objBox = (o: Variant['objects'][number]) => {
    const f = place.footprint(o.product)
    if (!f) return null
    const bx = footprintBox(o, f)
    return { x0: bx.x0 - 0.1, y0: bx.y0 - 0.1, x1: bx.x1 + 0.1, y1: bx.y1 + 0.1 }
  }
  const objects = diff(
    a.v.objects.map((o) => ({ o, bad: a.bad.has(o.id) })),
    b.v.objects.map((o) => ({ o, bad: b.bad.has(o.id) })),
    (x) => x.o.id,
    (x) => x,
    (x) => objBox(x.o),
  )

  const roomBox = (r: Variant['rooms'][number]): Box => {
    const xs = r.outline.map((p) => p[0])
    const ys = r.outline.map((p) => p[1])
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
  }
  const rooms = diff(a.v.rooms, b.v.rooms, (r) => r.id, (r) => [r.outline, r.label], roomBox)

  return { floor, walls, textile, shelves, beams, objects, rooms }
}

/**
 * The floor by cell: a cell changes when its product, lane direction or fill does. A tile cut around a new one keeps its
 * cells, so only the new tile shows; boxes are merged along each row.
 */
function floorDiff(a: Variant, b: Variant): LayerArea {
  const cells = (v: Variant) => {
    const m = new Map<string, string>()
    for (const t of v.floor.tiles) for (let i = t.i; i < t.i + t.w; i++) for (let j = t.j; j < t.j + t.h; j++) m.set(`${i},${j}`, `${t.product}|${t.roll ?? ''}|${t.fill ?? ''}`)
    return m
  }
  const ca = cells(a)
  const cb = cells(b)
  const changed = new Map<number, number[]>()
  for (const k of new Set([...ca.keys(), ...cb.keys()])) {
    if (ca.get(k) === cb.get(k)) continue
    const [i, j] = k.split(',').map(Number)
    changed.set(j, [...(changed.get(j) ?? []), i])
  }
  const boxes: Box[] = []
  for (const [j, is] of changed) {
    is.sort((x, y) => x - y)
    let i0 = is[0]
    for (let n = 1; n <= is.length; n++) {
      if (n < is.length && is[n] === is[n - 1] + 1) continue
      boxes.push({ x0: i0 * CELL - 0.02, y0: j * CELL - 0.02, x1: (is[n - 1] + 1) * CELL + 0.02, y1: (j + 1) * CELL + 0.02 })
      if (n < is.length) i0 = is[n]
    }
  }
  return { mask: boxes, clip: boxes }
}

/** Nothing on the plan changes. */
export const unchanged = (x: Areas) => AREA_LAYERS.every((k) => !x[k].clip.length)
