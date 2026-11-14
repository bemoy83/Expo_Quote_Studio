// What the pen in hand would store (docs/forhandsvisning.md): the target under the pointer, as a key, and the edit a
// click or release there makes, worked out with the same domain call the pointer handlers in pointer/ use. The plan draws
// the next variant through its own layers at preview strength (PlanView, nextArea.ts); this file only says what it is.
// The key changes only when the target does (edge, module, cell, tile, spot), so the next variant and its calc are
// worked out again only then.
import { freeFrames } from '../../calc/textile/free'
import { addFoil } from '../../domain/decor'
import { DOOR_AIM_MIN, placeOpening } from '../../domain/doors'
import { paintWalls } from '../../domain/edit'
import { faceSegment, felt, sideOf, type FaceSide } from '../../domain/faces'
import { applyFloor } from '../../domain/floor/brush'
import { carpetClick, fillCarpet } from '../../domain/floor/rollFill'
import { tileAt, type Rect } from '../../domain/floor/tiles'
import { wallModules, type Module } from '../../domain/grid'
import { drawInnerBeam, type Run } from '../../domain/innerBeams'
import { addObject, placeSet, footprintBox, objectBoxes, objectFootprint } from '../../domain/objects'
import { NO_ROOM, podiumGrab, podiumHeights, type PodiumDraw } from '../../domain/podiums'
import { podiumGrips, type PodiumGripDraw } from '../../domain/podiumGrips'
import { fusePodiums } from '../../domain/podiumLinks'
import { addShelf, addShelfRow, penHeight } from '../../domain/shelves/edit'
import { drawTextile, fillFace, type TextileResult } from '../../domain/textile/brush'
import { faceOfPoint, freeTextileAt, updateFace } from '../../domain/textile/free'
import { textileAt, updateTextile } from '../../domain/textile/inFrame'
import type { Motif, PlacedObject, Point, Variant } from '../../domain/types'
import { builtModules, doorAllowed, type BuiltModule } from '../../domain/walls'
import { RECIPES } from '../../foga/recipes'
import { applyDrop, type DecorDrag } from '../dnd'
import { place, pricing, productOf, rules } from '../env'
import { placedBy, type Brush, type Tool } from '../tools'
import { mm } from './dims'
import { nearestEdge } from './geometry'
import type { FaceHit, TextileLine } from './layers/Previews'
import type { Box } from './nextArea'
import type { PlanScale } from './planScale'
import { beamBody, PHANTOM, printBand, textileWidth, wallWidth } from './planStyle'
import { ratioOf } from './pointer/decor'
import type { FloorBrush } from './pointer/floorBrush'
import type { PlanHits } from './pointer/hits'
import { isDoor, openingEdge } from './pointer/opening'
import type { Pens } from './pointer/pens'
import { counterUnder, drawPodiumAt, podiumFine, podiumStart } from './pointer/podium'
import { podiumGripAt } from './pointer/podiumGrip'
import { placeHolds, placeKey } from './pointer/place'
import { paintPlates, plateAt, platesAlong } from './pointer/plates'
import type { Drag, P } from './pointer/types'

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
  /** Disker og podier with Shift: the edges of the preview a press here takes hold of, drawn thick (PR 2). */
  grip?: [Point, Point][]
  /** What a release takes away, hatched (a grip of a counter moved in, K14). */
  erased?: Box[]
  /** The grip of the chosen counter under the pointer, or being dragged (K14); or its link (K15). */
  hotGrip?: Point
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
  fillRect: Rect | null
  dropHover: { h: FaceHit; d: DecorDrag } | null
  /** Disker og podier with Shift held: where the preview stands still (usePlanPointer). */
  podiumFreeze?: P | null
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
  // The same target with another pen (colour, product) stores something else
  return t && { key: `${p.tool}|${JSON.stringify(p.brush)}|${t.key}`, outcome: t.outcome }
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
    if (placing.what === 'opening' && placing.module && brush?.kind === 'opening') return doorTarget(v, placing.module, brush, hover, true)
    if (placing.what === 'decor') return decorTarget(p, hover)
    if (placing.what === 'object') return objectTarget(v, brush, hover)
    return null
  }

  // Shelves pressed: the felts from the press to the pointer along the same face
  if (dragging?.kind === 'shelf') return shelfTarget(v, dragging.wallId, dragging.s, dragging.m0, dragging.m1, true)

  // Disker og podier dragged: the counter a release draws from the section pressed; held without moving, that section
  if (dragging?.kind === 'podium') {
    if (dragging.moved && dragging.drag && hover) return podiumTarget(drawPodiumAt(p, dragging.drag, hover))
    return dragging.click ? podiumTarget(dragging.click, false) : podiumHover(p, dragging.at)
  }

  // A counter of Disker og podier dragged against another (K15): they become one on release
  if (dragging?.kind === 'object' && dragging.moved && dragging.fuse) {
    const r = fusePodiums(v, place, dragging.fuse, dragging.id)
    return target(`fuse:${dragging.fuse}:${'error' in r ? r.error : ''}`, () => line({ hint: 'error' in r ? r.error : 'Slipp for å slå diskene sammen' }))
  }

  // A grip of the chosen counter dragged (K14): what a release stores, with what goes away hatched
  if (dragging?.kind === 'podiumGrip') {
    const r = dragging.moved && hover ? podiumGripAt(p, dragging, hover) : null
    const o = v.objects.find((x) => x.id === dragging.id)
    const at = o && podiumGrips(o).find((g) => JSON.stringify(g.grip) === JSON.stringify(dragging.grip))?.at
    return r ? gripTarget(r) : target(`grip:held`, () => line({ hint: GRIP_HINT, hotGrip: at }))
  }

  // Floor
  const product = brush?.kind === 'floor' ? brush.product : null
  // The carpet brush held: the area once it is dragged out. Before that nothing, as the press may turn into a drag:
  // what a click stores shows on hover and comes on release (Bjørn 11.11.2026)
  if (dragging?.kind === 'carpetFill') return p.fillRect && product ? fillTarget(p, product, p.fillRect) : null
  // Carpet tiles paint while dragging: the floor itself shows the stroke
  if (dragging) return null

  // Hovering: what a click here stores
  if (!hover) return null
  // On a link or grip of the chosen counter of Disker og podier, in Velg or with its pen: what a click or drag does
  if (tool === 'select' || pens.podiumTool) {
    const l = hits.podiumLinkAt(hover)
    if (l) return target(`link:${l.at}`, () => line({ hint: l.kind === 'joint' ? 'Klikk for å dele disken her' : 'Klikk for å lenke diskene sammen', hotGrip: l.at }))
    const g = hits.podiumGripAt(hover)
    if (g) return target(`grip:${g.at}`, () => line({ hint: GRIP_HINT, hotGrip: g.at }))
  }
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
    return e ? doorTarget(v, e, brush, null, false) : null
  }
  if (pens.podiumTool) return podiumHover(p, p.podiumFreeze ?? hover, p.podiumFreeze ? hover : null)
  if (pens.objectTool && hits.onStand(hover)) return objectTarget(v, brush, hover)
  if (pens.shelfTool) {
    const h = hits.faceHit(hover)
    return h ? shelfTarget(v, h.w.id, h.s, h.module, h.module, false) : null
  }
  if (pens.floorTool && product) {
    if (p.floor.carpetFill) return onStandFloor(v, hover) ? carpetClickTarget(p, product, hover) : null
    const a = p.floor.floorTouch(hover, null)
    if (a.kind === 'none') return null
    return target(`floor:${JSON.stringify(a)}`, () => area({ edit: (x) => applyFloor(x, a, product), hint: null }))
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
  const f = freeFrames(r.v, RECIPES.textileFrame, rules.textile.inFrame, '').find((x) => x.textileId === t.id)
  return { a: t.from, b: t.to, width: 'textile', text: mm(f ? f.length / 1000 : 0) }
}

const doorInvalid = (e: Module): NextOutcome => line({ hint: DOOR_IN_STAND_WALL, invalid: { seg: [e.a, e.b], width: 'wall' } })

/**
 * Door or curtain in module e. Held (q), a door turns toward the pointer as a release stores it (placeOpening): the key
 * follows the side of the wall and the half of the module the pointer is in.
 */
function doorTarget(v: Variant, e: Module, pen: Extract<Brush, { kind: 'opening' }>, q: P | null, held: boolean): NextTarget {
  const { product, ral, fabric } = pen
  if (!doorAllowed(v, e.a, e.b)) return target(`door:${e.key}`, () => doorInvalid(e))
  const door = isDoor(product)
  const h = e.a[1] === e.b[1]
  const across = q ? (h ? q.y - e.a[1] : q.x - e.a[0]) : 0
  const along = q ? (h ? q.x - Math.min(e.a[0], e.b[0]) : q.y - Math.min(e.a[1], e.b[1])) : 0
  const turn = door && q ? `${Math.abs(across) < DOOR_AIM_MIN ? 0 : Math.sign(across)}:${along < 0.5 ? 0 : 1}` : ''
  return target(`door:${e.key}:${product}:${ral ?? ''}:${fabric ?? ''}:${turn}`, () =>
    line({ edit: (x) => placeOpening(x, e.a, e.b, product, door, door ? q : null, { ral, fabric }), hint: held && door ? 'Dra mot siden døren skal slå · slipp for å sette inn · Esc avbryter' : null }),
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
  const pen = placedBy(brush)
  if (!pen) return null
  const { product } = pen
  const set = productOf(product)?.set
  if (set) {
    // A furniture set: all its pieces where a click puts them
    const next = placeSet(v, place, set, q.x, q.y)
    const key = next ? next.objects.slice(v.objects.length).map((o) => `${o.x},${o.y}`).join(';') : `none:${Math.round(q.x * 20)},${Math.round(q.y * 20)}`
    return target(`set:${product}:${key}`, () => line({ edit: next ? () => next : undefined, hint: next ? null : `Ikke plass til ${productOf(product)?.name.toLowerCase() ?? 'settet'} her` }))
  }
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

/** Shift held over Disker og podier (PR 2). */
const LOCKED = 'Låst plass: dra i en kant for å flytte den, eller fra midten for å tegne mot pekeren · 250-steg · slipp Shift for å flytte'

/** By a side of a counter of Disker og podier (PR 3). */
const ONTO_HINT = 'Inntil disken: klikk for å bygge på, dra for å tegne påbygget · kanten mot disken står fast'

/** On a grip of the chosen counter (K14). */
const GRIP_HINT = 'Dra for å flytte kanten · 500-steg, Shift 250'

/** A grip of the chosen counter dragged (K14): the counter after with its outer size in the pill, what goes away
 *  hatched; refused, the reason, hatched where it would stand when it has no room. */
function gripTarget(r: PodiumGripDraw): NextTarget {
  const box = (o: PlacedObject) => footprintBox(o, objectFootprint(place, o)!)
  const erased = r.gone ? objectBoxes(place, r.gone) : undefined
  const key = `grip:${'error' in r ? r.error : ''}:${JSON.stringify(r.o)}`
  if ('error' in r) return target(key, () => line({ hint: r.error, ...(r.error === NO_ROOM && { invalid: { rect: box(r.o) } }) }))
  const b = box(r.o)
  const text = `${mm(b.x1 - b.x0)} × ${mm(b.y1 - b.y0)}`
  return target(key, () => line({ edit: () => r.v, hint: null, erased, pill: { a: [b.x0, b.y1], b: [b.x1, b.y1], width: 'wall', text } }))
}

/** Disker og podier pointing (K10): on a counter, a click chooses it and nothing is shown; elsewhere the section a click
 *  stores, dimmed, or hatched where it has no room. Shift held (`over`: the pointer over the preview standing still at
 *  q): the edges a press takes hold of, thick, and the hint for it. */
function podiumHover(p: NextInput, q: P, over: P | null = null): NextTarget | null {
  if (!over && counterUnder(p, q)) return target(`pod:on`, () => line({ hint: 'Klikk for å velge disken' }))
  const r = podiumStart(p, q, !!over || podiumFine(p.brush))
  if (!r) return null
  const t = podiumTarget(r, false)
  if (!over || 'error' in r) return t
  const g = podiumGrab(r.cell, [over.x, over.y], r.onto)
  const b = footprintBox(r.cell, objectFootprint(place, r.cell)!)
  const grip: [Point, Point][] = [
    ...(g.x ? [[[g.x < 0 ? b.x0 : b.x1, b.y0], [g.x < 0 ? b.x0 : b.x1, b.y1]] as [Point, Point]] : []),
    ...(g.z ? [[[b.x0, g.z < 0 ? b.y0 : b.y1], [b.x1, g.z < 0 ? b.y0 : b.y1]] as [Point, Point]] : []),
  ]
  return target(`${t.key}:grip:${g.x},${g.z}`, () => ({ ...t.outcome(), hint: LOCKED, grip }))
}

/** What a click or drag of Disker og podier stores (K10), with its outer size in the pill while dragging (a påbygg: its
 *  own size c/c, then the counter's after, PR 3); hatched with the reason where it has no room. */
function podiumTarget(r: PodiumDraw, pill = true): NextTarget {
  const box = (o: PlacedObject) => footprintBox(o, objectFootprint(place, o)!)
  const b = box(r.o)
  const key = `pod:${'error' in r ? 'x' : ''}:${JSON.stringify(r.o)}:${JSON.stringify(r.cell)}`
  if ('error' in r) return target(key, () => line({ hint: r.error, invalid: { rect: box(r.cell) } }))
  const size = `${mm(b.x1 - b.x0)} × ${mm(b.y1 - b.y0)} · H ${podiumHeights(r.o).map((x) => mm(x / 1000)).join('/')}`
  const c = box(r.cell)
  const face = (2 * RECIPES.counter.face) / 1000
  const text = r.onto ? `+ ${mm(c.x1 - c.x0 - face)} × ${mm(c.y1 - c.y0 - face)} · ${size}` : size
  const hint = r.onto && !pill ? ONTO_HINT : null
  return target(key, () => line({ edit: () => r.v, hint, ...(pill && { pill: { a: [b.x0, b.y1], b: [b.x1, b.y1], width: 'wall', text } }) }))
}

/**
 * Shelves from module m0 to m1 on a face at the start height: one in a free felt, a row over a drag (felts that cannot
 * take one are skipped, H2). Over one felt that cannot, hatched with the reason; over one that has shelves, the hint
 * that a click selects them.
 */
function shelfTarget(v: Variant, wallId: string, s: FaceSide, m0: number, m1: number, pressed: boolean): NextTarget {
  return target(`shelf:${wallId}:${s}:${m0}:${m1}`, () => {
    const w = v.walls.find((x) => x.id === wallId)!
    const y = penHeight(v, rules, wallId, s, m0, m1)
    const seg = (a: number, b: number) => faceSegment(w, s, Math.min(a, b), Math.max(a, b) + 1, 0)
    if (m0 === m1) {
      const r = addShelf(v, rules, wallId, m0, s, y)
      if ('error' in r) return line({ hint: r.error, invalid: { seg: seg(m0, m0), width: 'print' } })
      if (r.existing) return line({ hint: 'Feltet har hylle · klikk for å velge den' })
      return line({ edit: () => r.v, hint: null })
    }
    const r = addShelfRow(v, rules, wallId, m0, m1, s, y)
    if (!r.ids.length) return line({ hint: 'Ingen av feltene kan ta hylle her', invalid: { seg: seg(m0, m1), width: 'print' } })
    const [a, b] = seg(m0, m1)
    const text = `${r.ids.length} ${r.ids.length === 1 ? 'hylle' : 'hyller'} · ${mm(y)}`
    return line({ edit: () => r.v, hint: null, pill: pressed ? { a, b, width: 'print', text } : undefined })
  })
}

/** The carpet brush dragged: the area, laid the cheapest way. */
function fillTarget(p: NextInput, product: string, rect: Rect): NextTarget | null {
  const roll = p.floor.rollWidth
  if (!roll) return null
  return target(`fill:${product}:${rect.i},${rect.j},${rect.w},${rect.h}`, () => area({ edit: (x) => fillCarpet(x, product, roll, pricing.carpet, rect), hint: null }))
}

/** What a click with the carpet brush does here: recolour the lane under it, or fill the free floor. */
function carpetClickTarget(p: NextInput, product: string, q: P): NextTarget | null {
  const roll = p.floor.rollWidth
  if (!roll) return null
  const { i, j } = p.floor.cellOf(q)
  const under = tileAt(p.v.floor.tiles, i, j)
  if (under && (!under.roll || under.product === product)) return null
  return target(`carpet:${product}:${under ? `${under.i},${under.j},${under.w},${under.h}` : 'free'}`, () =>
    area({ edit: (x) => carpetClick(x, product, roll, pricing.carpet, [i, j]), hint: null }),
  )
}
