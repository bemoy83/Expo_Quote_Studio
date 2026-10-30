// Drag and drop from the Profilering panel onto a wall, in the plan or the 3D view. What is being dragged is kept
// here: browsers hide drag data until the drop, but the views need it while hovering to show where it would land.
import type { DragEvent } from 'react'
import { addTextile, dropMotif, feltBlocked, felt, freeSpans, fullTextileHeight, textileAt, textileBox, updateFoil, type FaceSide } from '../domain/decor'
import type { Variant } from '../domain/types'
import type { PlanSelection } from './plan/PlanView'
import { fmt } from './format'
import { rules } from './env'

/** A textile frame (InFrame) or a motif from the graphics library. */
export type DecorDrag = { kind: 'textile' } | { kind: 'motif'; motif: string }

const MIME = 'application/x-standskisse-decor'
let current: DecorDrag | null = null

/** Props for a panel element that can be dragged onto a wall. */
export function decorSource(d: DecorDrag) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      current = d
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setData(MIME, JSON.stringify(d))
    },
    onDragEnd: () => {
      current = null
    },
  }
}

/** What is being dragged over a view, or null when it is something else (a file, text). */
export function decorDrag(e: { dataTransfer: DataTransfer | null }): DecorDrag | null {
  return e.dataTransfer?.types.includes(MIME) ? current : null
}

/** Call when the drop is handled, so a late dragend never leaves stale state. */
export function endDecorDrag() {
  current = null
}

/** A wall face under the pointer: offset along the wall, and the height when the view knows it (3D). */
export interface FaceTarget {
  wallId: string
  s: FaceSide
  t: number
  y?: number
  /** A decal under the pointer (3D): a motif dropped on it replaces its motif. */
  foilId?: string
  /** The outside of a perimeter wall, which cannot take decor. */
  outside?: boolean
}

const OUTSIDE = 'Utsiden av standveggen kan ikke ha tekstil eller grafikk'

/**
 * Where a drop would land, for the hover preview: an along-wall span and its height (on a frame or on the wall
 * panel), and why it cannot when it cannot. No box on the outside of a perimeter wall.
 */
export interface DropSpot {
  on: 'textile' | 'wall'
  from: number
  to: number
  y0: number
  y1: number
  error?: string
}

export function dropSpot(v: Variant, d: DecorDrag, h: FaceTarget): DropSpot | null {
  if (h.outside) return null
  const tx = textileAt(v, h.wallId, h.s, h.t)
  const onTextile = (error?: string): DropSpot => {
    const b = textileBox(tx!, rules)
    return { on: 'textile', from: tx!.from, to: tx!.from + tx!.width, y0: b.bottom, y1: b.bottom + b.height, error }
  }
  const onFelt = (module: number, error?: string): DropSpot => {
    const f = felt(rules, module)
    return { on: 'wall', from: f.a, to: f.b, y0: f.y0, y1: f.y1, error }
  }
  const module = Math.floor(h.t)
  if (d.kind === 'textile') {
    if (tx) return onTextile('Det står allerede en tekstilvegg her')
    const sp = freeSpans(v, rules, h.wallId, h.s).find(([a, b]) => h.t >= a && h.t <= b)
    return sp ? { on: 'textile', from: sp[0], to: sp[1], y0: 0, y1: fullTextileHeight(rules) } : onFelt(module, 'Ingen ledig veggflate her')
  }
  const foil = h.foilId && v.foils.find((x) => x.id === h.foilId)
  if (foil) return onFelt(foil.module)
  if (tx) return onTextile()
  return onFelt(module, feltBlocked(v, rules, h.wallId, module, h.s) ?? undefined)
}

/** Apply a drop: a new textile filling the free span, or a motif as print or decal. The new selection, or the reason it failed. */
export function applyDrop(v: Variant, d: DecorDrag, h: FaceTarget, ratio: (motif: string) => number): { v: Variant; select: PlanSelection; toast?: string } | { error: string } {
  if (h.outside) return { error: OUTSIDE }
  if (d.kind === 'textile') {
    if (textileAt(v, h.wallId, h.s, h.t)) return { error: 'Det står allerede en tekstilvegg her' }
    const r = addTextile(v, rules, h.wallId, h.s, h.t)
    if (!r) return { error: 'Ingen ledig veggflate her' }
    const t = r.v.textiles.find((x) => x.id === r.id)!
    return { v: r.v, select: { wallId: h.wallId, side: h.s, textileId: r.id }, toast: `Tekstilvegg ${fmt(t.width)} m lagt til` }
  }
  if (h.foilId && v.foils.some((x) => x.id === h.foilId)) {
    return { v: updateFoil(v, rules, h.foilId, { motif: d.motif }, ratio(d.motif)), select: { wallId: h.wallId, side: h.s, foilId: h.foilId } }
  }
  const r = dropMotif(v, rules, h.wallId, h.s, h.t, d.motif, ratio(d.motif), h.y)
  if ('error' in r) return r
  return { v: r.v, select: { wallId: h.wallId, side: h.s, ...(r.textileId ? { textileId: r.textileId } : { foilId: r.foilId }) } }
}
