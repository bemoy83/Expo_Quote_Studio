// The plan's pointer handling. A press starts one drag kind (types.ts) chosen by the pen in hand, or for Velg by what
// lies under the pointer (select.ts); each move and the release go to that kind's own file. Also the hover point,
// the previews' state and drag and drop from Profilering.
import { useEffect, useRef, useState, type DragEvent as RDragEvent, type PointerEvent as RPointerEvent } from 'react'
import type { FloorAction } from '../../../domain/floor/brush'
import type { Rect } from '../../../domain/floor/tiles'
import { faceOfPoint, freeTextileAt, updateFace } from '../../../domain/textile/free'
import type { Point } from '../../../domain/types'
import { applyDrop, decorDrag, endDecorDrag, type DecorDrag } from '../../dnd'
import type { FaceHit, TextileLine } from '../layers/Previews'
import { beam } from './beam'
import { carpetFill, startCarpetFill } from './carpetFill'
import { click } from './click'
import { decorClick, ratioOf } from './decor'
import { erase, startErase, type EraseMark } from './erase'
import { floor, startFloor } from './floor'
import { freeMove } from './freeMove'
import { object, objectClick } from './object'
import { openingClick } from './opening'
import { roll, startRoll } from './roll'
import { room } from './room'
import { startSelect } from './select'
import { startStroke, stroke } from './stroke'
import { startTextile, textile } from './textile'
import type { Drag, DragHandlers, P, PointerCtx } from './types'
import { wall } from './wall'

const DRAGS: { [K in Drag['kind']]: DragHandlers<K> } = { stroke, floor, roll, carpetFill, click, object, wall, beam, room, textile, freeMove, erase }
const handlersOf = (d: Drag) => DRAGS[d.kind] as DragHandlers<Drag['kind']>

/** What the plan passes in: the context without the previews' setters and state, which the hook owns. */
export type PlanPointerInput = Omit<PointerCtx, 'rollPending' | 'setStroke' | 'setTextileStroke' | 'setRollPending' | 'setFillRect' | 'setEraseMark'> & {
  /** Small overview: no drag and drop. */
  mini?: boolean
}

export function usePlanPointer(input: PlanPointerInput) {
  const { v, tool, brush, hits, pens, floor: fb } = input
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [hover, setHover] = useState<P | null>(null)
  // The drag under way as of the last pointer move, for rendering (hover previews pause, the cursor grabs): the ref
  // itself is only read in the handlers
  const [dragging, setDragging] = useState<Drag | null>(null)
  /** What the roll stroke in progress will lay on release: the preview shows it, the floor is untouched until then. */
  const [rollPending, setRollPending] = useState<FloorAction | null>(null)
  /** Fyll area being dragged, in cells. */
  const [fillRect, setFillRect] = useState<Rect | null>(null)
  const [strokeLine, setStroke] = useState<[Point, Point] | null>(null)
  /** Textile stroke being drawn, with where it started (picks the wall face when it lies on a wall). */
  const [textileStroke, setTextileStroke] = useState<TextileLine | null>(null)
  /** A frame or motif dragged from Profilering, over a wall face. */
  const [dropHover, setDropHover] = useState<{ h: FaceHit; d: DecorDrag } | null>(null)
  /** What a Tøm press takes on release. */
  const [eraseMark, setEraseMark] = useState<EraseMark | null>(null)

  // A new tool or pen drops whatever stroke was under way
  const [penNow, setPenNow] = useState({ tool, brush })
  if (penNow.tool !== tool || penNow.brush !== brush) {
    setPenNow({ tool, brush })
    setStroke(null)
    setTextileStroke(null)
    setFillRect(null)
    setEraseMark(null)
  }
  useEffect(() => {
    drag.current = null
  }, [tool, brush])

  const toModel = (e: { clientX: number; clientY: number }): P => {
    const el = svg.current!
    const pt = el.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = pt.matrixTransform(el.getScreenCTM()!.inverse())
    return { x: m.x, y: m.y }
  }

  const c: PointerCtx = { ...input, rollPending, setStroke, setTextileStroke, setRollPending, setFillRect, setEraseMark }

  /** The drag a press starts, or nothing for a pen that acts on the click alone. */
  const press = (q: P): Drag | undefined => {
    if (tool === 'erase') return startErase(c, q)
    if (fb.carpetFill) return startCarpetFill(c, q)
    if (pens.floorTool && fb.rollWidth && tool === 'brush') return startRoll(c, q)
    if (pens.floorTool) return startFloor(c, q)
    if (pens.wallTool || pens.beamTool) return startStroke(c, q)
    if (pens.openingTool) return void openingClick(c, q)
    if (pens.decorTool) return void decorClick(c, q)
    if (pens.textileTool) return startTextile(c, q)
    if (pens.objectTool) return void objectClick(c, q)
    return startSelect(c, q)
  }

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const q = toModel(e)
    svg.current!.setPointerCapture(e.pointerId)
    const d = press(q)
    if (d) drag.current = d
  }

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const q = toModel(e)
    setHover(q)
    const d = drag.current
    setDragging(d)
    if (!d) return
    handlersOf(d).move?.(c, d, q)
  }

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current
    drag.current = null
    setDragging(null)
    if (!d) return
    handlersOf(d).up?.(c, d, toModel(e))
  }

  const onPointerCancel = () => {
    drag.current = null
    setDragging(null)
    setStroke(null)
    setRollPending(null)
    setFillRect(null)
    setEraseMark(null)
  }

  // Drag and drop from Profilering: the same as a click with the textile or motif brush
  const onDragOver = (e: RDragEvent<SVGSVGElement>) => {
    const d = decorDrag(e)
    if (!d || input.mini) return
    e.preventDefault()
    const q = toModel(e)
    const h = hits.faceHit(q)
    e.dataTransfer.dropEffect = h || (d.kind === 'motif' && freeTextileAt(v, q, 0.2)) ? 'copy' : 'none'
    setDropHover(h ? { h, d } : null)
  }
  const onDrop = (e: RDragEvent<SVGSVGElement>) => {
    const d = decorDrag(e)
    setDropHover(null)
    endDecorDrag()
    if (!d || input.mini) return
    e.preventDefault()
    const q = toModel(e)
    const ft = d.kind === 'motif' ? freeTextileAt(v, q, 0.2) : undefined
    if (ft && d.kind === 'motif') {
      const face = faceOfPoint(ft, q)
      input.onEdit((x) => updateFace(x, ft.id, face, { motif: d.motif }))
      return input.onSelect({ freeTextileId: ft.id, freeFace: face })
    }
    const h = hits.faceHit(q)
    if (!h) return input.onToast(d.kind === 'textile' ? 'Slipp tekstilveggen ved en vegg, på siden rammen skal stå' : 'Slipp grafikken ved en vegg eller en tekstilvegg')
    const r = applyDrop(v, d, { wallId: h.w.id, s: h.s, t: h.t }, ratioOf(input.motifs))
    if ('error' in r) return input.onToast(r.error)
    input.onEdit(() => r.v)
    input.onSelect(r.select)
    if (r.toast) input.onToast(r.toast)
  }

  return {
    svg,
    hover,
    dragging,
    rollPending,
    fillRect,
    stroke: strokeLine,
    textileStroke,
    dropHover,
    eraseMark,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave: () => setHover(null),
      onDragOver,
      onDragLeave: () => setDropHover(null),
      onDrop,
    },
  }
}
