// Dragging in the wall drawer's drawing: move a textile frame or a decal, or drag the edge or corner of one.
import type { PointerEvent as RPointerEvent, RefObject } from 'react'
import { moveFoilBy, updateFoil } from '../../../domain/decor'
import type { FaceSide } from '../../../domain/faces'
import { freeSpans, moveTextileBy, textileBox, textilesOn, updateTextile } from '../../../domain/textile/inFrame'
import type { Foil, TextileWall, Variant, Wall } from '../../../domain/types'
import { rules } from '../../env'
import type { Edge } from '../drawerParts'
import { type PlanSelection } from '../selection'

const EPS = 1e-6

/** What a drag in the drawing changes: move a frame or decal, or the edge or corner of one. */
export type DragKind = 'tmove' | 'fmove' | { edge: Edge }

export interface DragDeps {
  svg: RefObject<SVGSVGElement | null>
  w: Wall
  s: FaceSide
  L: number
  select: (x: Partial<PlanSelection>) => void
  ratioOf: (id?: string) => number
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onCheckpoint: () => void
}

/** The pointer-down handler that starts a drag of a frame or decal (as `drag(e, kind, item)`). Holds no React state; named as a hook so it is called once per render of the drawing. */
export function useDecorDrag({ svg, w, s, L, select, ratioOf, onEdit, onCheckpoint }: DragDeps) {
  const dir = s === 1 ? 1 : -1
  const drag = (e: RPointerEvent, kind: DragKind, item: TextileWall | Foil) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const scale = svg.current?.getScreenCTM()?.a ?? 1
    const x0 = e.clientX
    const y0 = e.clientY
    let moved = false
    if ('from' in item) select({ textileId: item.id })
    else select({ foilId: item.id })
    const onMove = (ev: PointerEvent) => {
      const du = (ev.clientX - x0) / scale
      const dz = -(ev.clientY - y0) / scale
      if (!moved) {
        if (Math.hypot(du, dz) * scale < 3) return
        moved = true
        onCheckpoint()
      }
      onEdit((x) => applyDrag(x, kind, item, du, dz), false)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const applyDrag = (x: Variant, kind: DragKind, item: TextileWall | Foil, du: number, dz: number): Variant => {
    if ('from' in item) {
      if (kind === 'tmove') return moveTextileBy(x, rules, item, du * dir, dz)
      return kind === 'fmove' ? x : resizeTextile(x, item, kind.edge, du, dz)
    }
    const r = ratioOf(item.motif)
    if (kind === 'fmove') return moveFoilBy(x, rules, item, du * dir, dz, r)
    // A decal keeps its motif's shape and its centre: a corner on the right grows it dragged right, on the left dragged left
    if (kind === 'tmove') return x
    return updateFoil(x, rules, item.id, { width: item.width + 2 * (kind.edge.includes('l') ? -du : du) }, r)
  }

  /** Drag one edge or corner of a frame; the opposite edges stay put. Kept within the free stretch of wall it stands on. */
  const resizeTextile = (x: Variant, t: TextileWall, edge: Edge, du: number, dz: number): Variant => {
    let a = t.from
    let b = t.from + t.width
    // The right edge in the drawing is the wall's end on one face and its start on the other
    if (edge.includes('r')) {
      if (dir === 1) b += du
      else a -= du
    }
    if (edge.includes('l')) {
      if (dir === 1) a += du
      else b -= du
    }
    const sp = freeSpans(x, rules, w.id, s, textilesOn(x, w.id, s, t.id)).find(([p0, p1]) => t.from >= p0 - EPS && t.from + t.width <= p1 + EPS)
    const min = rules.textile.minWidth
    if (a !== t.from) a = Math.min(b - min, Math.max(sp?.[0] ?? 0, a))
    if (b !== t.from + t.width) b = Math.max(a + min, Math.min(sp?.[1] ?? L, b))
    const box = textileBox(t, rules)
    let bottom = box.bottom
    let top = box.bottom + box.height
    if (edge.includes('t')) top += dz
    if (edge.includes('b')) bottom = Math.max(0, Math.min(top - min, bottom + dz))
    return updateTextile(x, rules, t.id, { from: a, width: b - a, bottom, height: top - bottom })
  }

  return drag
}
