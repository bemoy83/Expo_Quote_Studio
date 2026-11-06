// What the pen in hand would store (docs/forhandsvisning.md): the target under the pointer, as a key, and the edit a
// click or release there makes, worked out with the same domain call the pointer handlers in pointer/ use. The plan draws
// the next variant through its own layers at preview strength (PlanView, nextArea.ts); this file only says what it is.
// The key changes only when the target does (edge, module, cell, tile, spot), so the next variant and its calc are
// worked out again only then.
import { freeFrames } from '../../calc/textile/free'
import { paintWalls } from '../../domain/edit'
import { addFoil } from '../../domain/decor'
import { DOOR_AIM_MIN, placeOpening } from '../../domain/doors'
import { faceSegment, felt, sideOf } from '../../domain/faces'
import { applyFloor, type FloorAction } from '../../domain/floor/brush'
import type { Rect } from '../../domain/floor/tiles'
import { fillCarpet } from '../../domain/floor/rollFill'
import { builtModules, doorAllowed, type BuiltModule } from '../../domain/walls'
import { wallModules, type Module } from '../../domain/grid'
import { drawInnerBeam, type Run } from '../../domain/innerBeams'
import { addObject, footprintBox } from '../../domain/objects'
import { drawTextile, fillFace, type TextileResult } from '../../domain/textile/brush'
import { faceOfPoint, freeTextileAt, updateFace } from '../../domain/textile/free'
import { textileAt, updateTextile } from '../../domain/textile/inFrame'
import type { Point, Variant } from '../../domain/types'
import { RECIPES } from '../../foga/recipes'
import type { Motif } from '../../persistence/file'
import { applyDrop, type DecorDrag } from '../dnd'
import { place, productOf, rules } from '../env'
import type { Brush, Tool } from '../tools'
import { mm } from './dims'
import { nearestEdge } from './geometry'
import { conflicts } from '../../domain/objects'
import type { CalcResult } from '../../calc/calc'
import { changedAreas, unchanged, type Areas, type Box, type PlanState } from './nextArea'
import type { PlanScale } from './planScale'
import { beamBody, PHANTOM, printBand, textileWidth, wallWidth } from './planStyle'
import { ratioOf } from './pointer/decor'
import type { FloorBrush } from './pointer/floorBrush'
import type { PlanHits } from './pointer/hits'
import { isDoor, openingEdge } from './pointer/opening'
import type { Pens } from './pointer/pens'
import { placeHolds, placeKey } from './pointer/place'
import { paintPlates, plateAt, platesAlong } from './pointer/plates'
import type { Drag, P } from './pointer/types'
import type { FaceHit, TextileLine } from './layers/Previews'

/** The symbol's width a hatched invalid target or a measure pill goes by. */
export type Width = 'wall' | 'beam' | 'textile' | 'print'

/** A symbol's width on screen, m. */
export function widthOf(sc: PlanScale, w: Width): number {
  if (w === 'wall') return wallWidth(sc)
  if (w === 'beam') return beamBody(sc, rules.beam.thickness)
  if (w === 'textile') return textileWidth(sc)
  return printBand(sc)
}

/** Where it would land, grey and hatched, when it cannot be stored. */
export type Invalid = { seg: [Point, Point]; width: Width } | { rect: Box } | { circle: { cx: number; cy: number; r: number } }

/** The measure pill beside what is being dragged out. */
export interface Pill {
  a: Point
  b: Point
  width: Width
  text: string
}

export interface NextOutcome {
  /** The edit a click or release here makes. Absent when it makes none. */
  edit?: (v: Variant) => Variant
  /** Preview strength: PHANTOM.area for walls, textile and floor, PHANTOM.line for takdrager, door, decal and furniture. */
  strength: number
  /** Why nothing would be stored, or what to do next, for the hint line. */
  hint: string | null
  invalid?: Invalid
  pill?: Pill
}

export interface NextTarget {
  /** Changes only when the target does. */
  key: string
  outcome: () => NextOutcome
}

export interface NextInput {
  v: Variant
  tool: Tool
  brush: Brush | null
  pens: Pens
  hits: PlanHits
  mods: BuiltModule[]
  floor: FloorBrush
  standardRuns: readonly Run[]
  motifs?: Motif[]
  hover: P | null
  dragging: Drag | null
  stroke: [Point, Point] | null
  textileStroke: TextileLine | null
  rollPending: FloorAction | null
  fillRect: Rect | null
  dropHover: { h: FaceHit; d: DecorDrag } | null
}

const pt = (p: Point) => `${p[0]},${p[1]}`
const area = (o: Omit<NextOutcome, 'strength'>): NextOutcome => ({ strength: PHANTOM.area, ...o })
const line = (o: Omit<NextOutcome, 'strength'>): NextOutcome => ({ strength: PHANTOM.line, ...o })
const target = (key: string, outcome: () => NextOutcome): NextTarget => ({ key, outcome })

const DOOR_IN_STAND_WALL = 'Dører og forheng kan ikke stå i standveggen'

/** The modules of the stroke a→b that are not built yet: a stroke over walls that exist only adds the rest. */
function newModules(v: Variant, a: Point, b: Point): Module[] {
  const n = Math.round(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]))
  if (!n) return []
  const built = new Set(builtModules(v).map((m) => m.key))
  return wallModules({ id: '', from: a, to: b }).filter((m) => !built.has(m.key))
}

/** The target of the pen in hand and what a click or release there stores; null when there is nothing to show. */
export function nextTarget(p: NextInput): NextTarget | null {
  const t = targetOf(p)
  // The same target with another pen (colour, product, lane direction) stores something else
  return t && { key: `${p.tool}|${JSON.stringify(p.brush)}|${p.floor.dir}|${t.key}`, outcome: t.outcome }
}

function targetOf(p: NextInput): NextTarget | null {
  const { v, tool, brush, pens, hits, hover, dragging } = p
  if (tool === 'erase') return null

  // Dragged in from Profilering: the same as a click with the textile or motif brush
  if (p.dropHover) {
    const { h, d } = p.dropHover
    return target(`drop:${JSON.stringify(d)}:${h.w.id}:${h.s}:${Math.round(h.t * 20)}`, () => {
      const r = applyDrop(v, d, { wallId: h.w.id, s: h.s, t: h.t }, ratioOf(p.motifs))
      const make = d.kind === 'textile' ? area : line
      return 'error' in r ? make({ hint: r.error }) : make({ edit: () => r.v, hint: null })
    })
  }

  // The wall pen along a wall that stands: the plates a release colours
  const wallRal = brush?.kind === 'wall' ? brush.ral : null
  if (dragging?.kind === 'plates' && !dragging.as && wallRal) {
    const keys = platesAlong(v, p.mods, dragging.wallId, dragging.i0, dragging.moved && hover ? hover : dragging.p0)
    return target(`plates:${keys.join('|')}`, () => {
      if (!keys.length) return area({ hint: 'Dører farges i veggskuffen' })
      const ms = p.mods.filter((m) => keys.includes(m.key))
      const ends = ms.flatMap((m) => [m.a, m.b])
      const lo: Point = [Math.min(...ends.map((q) => q[0])), Math.min(...ends.map((q) => q[1]))]
      const hi: Point = [Math.max(...ends.map((q) => q[0])), Math.max(...ends.map((q) => q[1]))]
      const text = `${ms.length} ${ms.length === 1 ? 'plate' : 'plater'} · RAL ${wallRal}`
      return area({ edit: (x) => paintPlates(x, p.mods, keys, wallRal), hint: null, pill: { a: lo, b: hi, width: 'wall', text } })
    })
  }

  // Walls and takdragere: the stroke while pressed, the edge a click lays while hovering
  const strokeTarget = (a: Point, b: Point, pressed: boolean): NextTarget | null => {
    if (pens.wallTool && wallRal) {
      return target(`wall:${pt(a)}:${pt(b)}:${pressed}`, () => {
        const mods = newModules(v, a, b)
        if (!mods.length) return area({ hint: pressed ? 'Veggen finnes allerede' : null })
        const text = `${mm(mods.length * rules.wall.cc)} · ${mods.length} ${mods.length === 1 ? 'modul' : 'moduler'}`
        return area({ edit: (x) => paintWalls(x, a, b, wallRal), hint: null, pill: pressed ? { a, b, width: 'wall', text } : undefined })
      })
    }
    if (pens.beamTool) {
      return target(`beam:${pt(a)}:${pt(b)}:${pressed}`, () => {
        const L = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])
        if (!L) return line({ hint: null })
        const r = drawInnerBeam(v, a, b, p.standardRuns)
        if ('error' in r) return line({ hint: r.error, invalid: { seg: [a, b], width: 'beam' } })
        return line({ edit: () => r.v, hint: null, pill: pressed ? { a, b, width: 'beam', text: mm(L) } : undefined })
      })
    }
    return null
  }
  if (p.stroke) return strokeTarget(p.stroke[0], p.stroke[1], true)

  // Textile brush pressed: the stroke, or a click next to a wall filling that face
  if (pens.textileTool && p.textileStroke) {
    const { a, b, at } = p.textileStroke
    const click = a[0] === b[0] && a[1] === b[1]
    const face = click ? hits.faceHit(at) : null
    if (click && !face) return null
    return target(click ? `held:${faceKey(face!)}` : `tline:${pt(a)}:${pt(b)}`, () => {
      const r = face ? fillFace(v, rules, face.w.id, face.s, face.t) : drawTextile(v, rules, a, b, at)
      if ('error' in r) return area({ hint: r.error, invalid: click ? undefined : { seg: [a, b], width: 'textile' } })
      return area({ edit: () => r.v, hint: null, pill: textilePill(r) })
    })
  }

  // Door, motif and furniture pressed: what a release over the same target stores; dragged off it, nothing
  const placing = dragging?.kind === 'place' ? dragging : null
  if (placing) {
    if (!hover || !placeHolds({ v, hits, brush }, placing, hover)) {
      // A door pressed in a stand wall stays hatched with its reason
      const e = placing.module
      return placing.what === 'opening' && e && !doorAllowed(v, e.a, e.b) ? target(`door:${e.key}`, () => doorInvalid(e)) : null
    }
    if (placing.what === 'opening' && placing.module && brush?.kind === 'opening') return doorTarget(v, placing.module, brush.product, hover, true)
    if (placing.what === 'decor') return decorTarget(p, hover)
    if (placing.what === 'object') return objectTarget(v, brush, hover)
    return null
  }

  // Floor
  const product = brush?.kind === 'floor' ? brush.product : null
  if (p.rollPending && product) {
    const a = p.rollPending
    return a.kind === 'none' ? null : target(`roll:${JSON.stringify(a)}`, () => area({ edit: (x) => applyFloor(x, a, product, p.floor.dir), hint: null }))
  }
  if (dragging?.kind === 'carpetFill' && product) {
    const rect = p.fillRect ?? undefined
    if (!rect && !(hover && onStandFloor(v, hover))) return null
    return fillTarget(p, product, rect)
  }
  // Carpet tiles paint while dragging: the floor itself shows the stroke
  if (dragging) return null

  // Hovering: what a click here stores
  if (!hover) return null
  if (pens.wallTool && wallRal) {
    const m = plateAt(p.mods, hover)
    if (m) return target(`plate:${m.key}`, () => area({ edit: (x) => paintPlates(x, p.mods, [m.key], wallRal), hint: null }))
  }
  if ((pens.wallTool || pens.beamTool) && hits.onStand(hover)) {
    const e = nearestEdge(v.stand, hover)
    return strokeTarget(e.a, e.b, false)
  }
  if (pens.textileTool) {
    // The same face a click finds (pointer/textile.ts)
    const face = hits.faceHit(hover)
    if (!face) return null
    return target(faceKey(face), () => {
      const r = fillFace(v, rules, face.w.id, face.s, face.t)
      return 'error' in r ? area({ hint: r.error }) : area({ edit: () => r.v, hint: null })
    })
  }
  if (pens.decorTool) return decorTarget(p, hover)
  if (pens.openingTool && brush?.kind === 'opening') {
    const e = openingEdge({ v, hits }, hover)
    return e ? doorTarget(v, e, brush.product, null, false) : null
  }
  if (pens.objectTool && hits.onStand(hover)) return objectTarget(v, brush, hover)
  if (pens.floorTool && product) {
    if (p.floor.carpetFill) return onStandFloor(v, hover) ? fillTarget(p, product, undefined) : null
    const a = p.floor.rollWidth ? p.floor.laneAction({ from: hover }, null) : p.floor.floorTouch(hover, null)
    if (a.kind === 'none') return null
    const dir = p.floor.rollWidth ? p.floor.dir : undefined
    return target(`floor:${JSON.stringify(a)}`, () => area({ edit: (x) => applyFloor(x, a, product, dir), hint: null }))
  }
  return null
}

/** On the stand's floor itself (not the margin around its edge walls). */
const onStandFloor = (v: Variant, q: P) => q.x >= 0 && q.y >= 0 && q.x < v.stand.width && q.y < v.stand.depth

/** A wall face, to the textile brush's resolution along it. */
const faceKey = (h: FaceHit) => `face:${h.w.id}:${h.s}:${Math.floor(h.t * 20)}`

/** The pill of the textile a stroke or click lays: on a wall its width on the face, free-standing its frame length. */
function textilePill(r: Exclude<TextileResult, { error: string }>): Pill {
  if ('mounted' in r) {
    const t = r.v.textiles.find((x) => x.id === r.mounted.id)!
    const w = r.v.walls.find((x) => x.id === t.wallId)!
    const [a, b] = faceSegment(w, sideOf(r.v, t), t.from, t.from + t.width, 0)
    return { a, b, width: 'textile', text: `${mm(t.width)} på vegg` }
  }
  const t = r.v.freeTextiles.find((x) => x.id === r.free.id)!
  const f = freeFrames(r.v, RECIPES.freeFrame, rules.textile.inFrame, '').find((x) => x.textileId === t.id)
  return { a: t.from, b: t.to, width: 'textile', text: mm(f ? f.length / 1000 : 0) }
}

const doorInvalid = (e: Module): NextOutcome => line({ hint: DOOR_IN_STAND_WALL, invalid: { seg: [e.a, e.b], width: 'wall' } })

/**
 * Door or curtain in module e. Held (q), a door turns toward the pointer as a release stores it (placeOpening): the key
 * follows the side of the wall and the half of the module the pointer is in.
 */
function doorTarget(v: Variant, e: Module, product: string, q: P | null, held: boolean): NextTarget {
  if (!doorAllowed(v, e.a, e.b)) return target(`door:${e.key}`, () => doorInvalid(e))
  const door = isDoor(product)
  const h = e.a[1] === e.b[1]
  const across = q ? (h ? q.y - e.a[1] : q.x - e.a[0]) : 0
  const along = q ? (h ? q.x - Math.min(e.a[0], e.b[0]) : q.y - Math.min(e.a[1], e.b[1])) : 0
  const turn = door && q ? `${Math.abs(across) < DOOR_AIM_MIN ? 0 : Math.sign(across)}:${along < 0.5 ? 0 : 1}` : ''
  return target(`door:${e.key}:${product}:${turn}`, () =>
    line({ edit: (x) => placeOpening(x, e.a, e.b, product, door, door ? q : null), hint: held && door ? 'Dra mot siden døren skal slå · slipp for å sette inn · Esc avbryter' : null }),
  )
}

/** Motif: print on the textile at q, or a decal on the wall panel; hatched where foil cannot go. */
function decorTarget(p: NextInput, q: P): NextTarget | null {
  const { v, brush, hits } = p
  if (brush?.kind !== 'motif') return null
  const key = placeKey({ v, hits, brush }, 'decor', q)
  if (key === 'none') return null
  const motif = brush.motif
  return target(`decor:${key}:${motif}`, () => {
    const ft = freeTextileAt(v, q, 0.15)
    if (ft) {
      const face = faceOfPoint(ft, q)
      return line({ edit: (x) => updateFace(x, ft.id, face, { motif }), hint: null })
    }
    const h = hits.faceHit(q)!
    const tx = textileAt(v, h.w.id, h.s, h.t)
    if (tx) return line({ edit: (x) => updateTextile(x, rules, tx.id, { motif }), hint: null })
    const r = addFoil(v, rules, h.w.id, h.module, h.s, motif, ratioOf(p.motifs)(motif))
    if ('error' in r) {
      const f = felt(rules, h.module)
      return line({ hint: r.error, invalid: { seg: faceSegment(h.w, h.s, f.a, f.b, 0), width: 'print' } })
    }
    return line({ edit: () => r.v, hint: null })
  })
}

/** Furniture where it actually lands (findSpot moves it off walls and other furniture), or hatched with no room. */
function objectTarget(v: Variant, brush: Brush | null, q: P): NextTarget | null {
  if (brush?.kind !== 'object') return null
  const product = brush.product
  const f = productOf(product)?.footprint
  if (!f) return null
  const next = addObject(v, place, product, q.x, q.y)
  const o = next?.objects[next.objects.length - 1]
  if (!next || !o) {
    const key = `obj:none:${Math.round(q.x * 20)},${Math.round(q.y * 20)}`
    const b = footprintBox({ x: q.x, y: q.y, rot: 0 }, f)
    const invalid: Invalid = f.round ? { circle: { cx: q.x, cy: q.y, r: f.w / 2 } } : { rect: b }
    return target(key, () => line({ hint: `Ikke plass til ${productOf(product)?.name.toLowerCase() ?? 'varen'} her`, invalid }))
  }
  return target(`obj:${product}:${o.x},${o.y}`, () => line({ edit: () => next, hint: null }))
}

/** Fyll: the area being dragged, or the whole stand a click fills, laid the cheapest way. */
function fillTarget(p: NextInput, product: string, rect: Rect | undefined): NextTarget | null {
  const roll = p.floor.rollWidth
  if (!roll) return null
  return target(`fill:${product}:${rect ? `${rect.i},${rect.j},${rect.w},${rect.h}` : 'stand'}`, () =>
    area({ edit: (x) => fillCarpet(x, product, roll, rules.carpet, rect), hint: null }),
  )
}

/** What an edit would store (App's onEdit without storing it) and its calc. */
export interface Preview {
  result: (fn: (v: Variant) => Variant) => Variant
  calc: (v: Variant) => CalcResult
}

/** What the pen would store, and the next variant as the plan draws it with where it differs (null: nothing changes). */
export interface NextState {
  outcome: NextOutcome
  scene: (PlanState & { areas: Areas }) | null
}

/** The last next state worked out per sketch: moving the pointer within the same target reuses it. */
const cache = new WeakMap<Variant, { key: string; res: CalcResult; preview: Preview; value: NextState }>()

/** The next state for the target over the sketch `base`, worked out again only when the target or the sketch changes. */
export function nextOf(t: NextTarget, base: PlanState, preview: Preview): NextState {
  const c = cache.get(base.v)
  if (c && c.key === t.key && c.res === base.res && c.preview === preview) return c.value
  const value = nextStateOf(t.outcome(), base, preview)
  cache.set(base.v, { key: t.key, res: base.res, preview, value })
  return value
}

function nextStateOf(outcome: NextOutcome, base: PlanState, preview: Preview): NextState {
  const { v, res } = base
  if (!outcome.edit) return { outcome, scene: null }
  const nv = preview.result(outcome.edit)
  if (nv === v) return { outcome, scene: null }
  const scene: PlanState = { v: nv, res: onlyObjects(v, nv) ? res : preview.calc(nv), mods: builtModules(nv), bad: conflicts(nv, place) }
  const areas = changedAreas(base, scene)
  return { outcome, scene: unchanged(areas) ? null : { ...scene, areas } }
}

/** Only the furniture differs: the calc's frame (beams, posts, foot plates, free-standing textile) is the same. */
function onlyObjects(a: Variant, b: Variant): boolean {
  return (Object.keys(b) as (keyof Variant)[]).every((k) => k === 'objects' || a[k] === b[k])
}
