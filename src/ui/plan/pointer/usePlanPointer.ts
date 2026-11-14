// The plan's pointer handling. A press starts one drag kind (types.ts) chosen by the pen in hand, or for Velg by what
// lies under the pointer (select.ts); each move and the release go to that kind's own file. Also the hover point,
// the previews' state and drag and drop from Profilering.
import { useCallback, useEffect, useRef, useState, type DragEvent as RDragEvent, type PointerEvent as RPointerEvent } from 'react'
import type { Rect } from '../../../domain/floor/tiles'
import { faceOfPoint, freeTextileAt, updateFace } from '../../../domain/textile/free'
import type { Point } from '../../../domain/types'
import { applyDrop, decorDrag, endDecorDrag, type DecorDrag } from '../../dnd'
import type { FaceHit, TextileLine } from '../layers/Previews'
import { beam } from './beam'
import { carpetFill, startCarpetFill } from './carpetFill'
import { click, clickSelection } from './click'
import { ratioOf } from './decor'
import { erase, startErase, type Erasing } from './erase'
import { floor, startFloor } from './floor'
import { freeMove } from './freeMove'
import { shelfMove } from './shelfMove'
import { object } from './object'
import { placeDrag, startPlace } from './place'
import { plateAt, plates, startPlates } from './plates'
import { room } from './room'
import { shelf, startShelf } from './shelf'
import { startSelect } from './select'
import { run, runShift, startRunDrag } from './run'
import { stroke } from './stroke'
import { podium, podiumFine, podiumShift, startPodium } from './podium'
import { podiumGrip, startPodiumGrip } from './podiumGrip'
import { podiumLink, startPodiumLink } from './podiumLink'
import type { Drag, DragHandlers, P, PointerCtx } from './types'
import { wall } from './wall'

const DRAGS: { [K in Drag['kind']]: DragHandlers<K> } = { stroke, run, plates, floor, carpetFill, click, object, wall, beam, room, podium, podiumGrip, podiumLink, freeMove, erase, shelf, shelfMove, place: placeDrag }
const handlersOf = (d: Drag) => DRAGS[d.kind] as DragHandlers<Drag['kind']>

/** What the plan passes in: the context without the previews' setters and state, which the hook owns. */
export type PlanPointerInput = Omit<PointerCtx, 'clickSelect' | 'setStroke' | 'setTextileStroke' | 'setFillRect' | 'setErasing'> & {
  /** Small overview: no drag and drop. */
  mini?: boolean
}

export function usePlanPointer(input: PlanPointerInput) {
  const { v, tool, brush, hits, pens, floor: fb } = input
  const svg = useRef<SVGSVGElement>(null)
  /** The plan's element as state too, so the selection pill can be placed from it while rendering. */
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null)
  const svgRef = useCallback((el: SVGSVGElement | null) => {
    svg.current = el
    setSvgEl(el)
  }, [])
  const drag = useRef<Drag | null>(null)
  const [hover, setHover] = useState<P | null>(null)
  // The drag under way as of the last pointer move, for rendering (hover previews pause, the cursor grabs): the ref
  // itself is only read in the handlers
  const [dragging, setDragging] = useState<Drag | null>(null)
  /** What the roll stroke in progress will lay on release: the preview shows it, the floor is untouched until then. */
  /** Fyll area being dragged, in cells. */
  const [fillRect, setFillRect] = useState<Rect | null>(null)
  const [strokeLine, setStroke] = useState<[Point, Point] | null>(null)
  /** Textile stroke being drawn, with where it started (picks the wall face when it lies on a wall). */
  const [textileStroke, setTextileStroke] = useState<TextileLine | null>(null)
  /** A frame or motif dragged from Profilering, over a wall face. */
  const [dropHover, setDropHover] = useState<{ h: FaceHit; d: DecorDrag } | null>(null)
  /** What a Tøm press takes on release. */
  const [erasing, setErasing] = useState<Erasing | null>(null)
  /** Shift held and nothing pressed, with Disker og podier, Vegg or Tekstil: where the preview stands still, so the pointer can
   *  go over it and take hold of an end (podium.ts, run.ts). */
  const [freeze, setFreeze] = useState<P | null>(null)
  /** The hover point for the Shift key listener, set where the hover is. */
  const hoverRef = useRef<P | null>(null)
  /** The wall and textile pens draw in 250 steps with Shift held or «Fin» on (Bjørn 14.11.2026); the snap dots show
   *  the 250 grid while Shift is held. */
  const fineOn = (pens.wallTool && brush?.kind === 'wall') || (pens.textileTool && brush?.kind === 'textile')
  const fineLock = fineOn && !!brush && 'fine' in brush && !!brush.fine
  const fineOf = (shift: boolean) => !!fineOn && (shift || fineLock)
  /** The pens whose preview Shift freezes (one drawing tool, Bjørn 14.11.2026). */
  const freezeOn = pens.podiumTool || !!fineOn
  const shiftOn = freezeOn || fineOn
  const [shiftHeld, setShiftHeld] = useState(false)
  useEffect(() => {
    if (!shiftOn) return
    const on = (e: KeyboardEvent) => {
      if (e.key !== 'Shift') return
      setShiftHeld(e.type === 'keydown')
      if (freezeOn && !drag.current) setFreeze(e.type === 'keydown' ? (f) => f ?? hoverRef.current : null)
    }
    const off = () => {
      setShiftHeld(false)
      setFreeze(null)
    }
    window.addEventListener('keydown', on)
    window.addEventListener('keyup', on)
    window.addEventListener('blur', off)
    return () => {
      window.removeEventListener('keydown', on)
      window.removeEventListener('keyup', on)
      window.removeEventListener('blur', off)
      off()
    }
  }, [shiftOn, freezeOn])

  // A new tool or pen drops whatever stroke was under way
  const [penNow, setPenNow] = useState({ tool, brush })
  if (penNow.tool !== tool || penNow.brush !== brush) {
    setPenNow({ tool, brush })
    setStroke(null)
    setTextileStroke(null)
    setFillRect(null)
    setErasing(null)
  }
  useEffect(() => {
    drag.current = null
  }, [tool, brush])
  // Esc cancels a door, decal or furniture pressed but not yet released, and plates being coloured with the wall pen. Registered once, before useShortcuts (which
  // registers again on every render), so it runs first
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (drag.current?.kind !== 'place' && drag.current?.kind !== 'plates')) return
      // Only the press is cancelled: the pen stays in hand (useShortcuts would put it down on Esc)
      e.stopImmediatePropagation()
      drag.current = null
      setDragging(null)
      setStroke(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toModel = (e: { clientX: number; clientY: number }): P => {
    const el = svg.current!
    const pt = el.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = pt.matrixTransform(el.getScreenCTM()!.inverse())
    return { x: m.x, y: m.y }
  }

  const c: PointerCtx = { ...input, clickSelect: (s) => input.onSelect(clickSelection(input.selection, s, input.drawerOpen)), setStroke, setTextileStroke, setFillRect, setErasing }

  /** The drag a press starts, or nothing for a pen that acts on the click alone. */
  const press = (q: P, shift = false): Drag | undefined => {
    if (tool === 'erase') return startErase(c, q)
    if (fb.carpetFill) return startCarpetFill(c, q)
    if (pens.floorTool) return startFloor(c, q)
    if (pens.wallTool && brush?.kind === 'wall') {
      const m = plateAt(input.mods, freeze ?? q)
      if (m) return startPlates(m, q, fineOf(shift))
    }
    if (pens.wallTool || pens.beamTool || pens.textileTool) return startRunDrag(c, q, fineOf(shift), freeze)
    if (pens.openingTool) return startPlace(c, 'opening', q)
    if (pens.decorTool) return startPlace(c, 'decor', q)
    if (pens.podiumTool) return startPodiumLink(c, q) ?? startPodiumGrip(c, q) ?? startPodium(c, q, shift || podiumFine(brush), freeze)
    if (pens.objectTool) return startPlace(c, 'object', q)
    if (pens.shelfTool) return startShelf(c, q)
    return startSelect(c, q)
  }

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const q = toModel(e)
    svg.current!.setPointerCapture(e.pointerId)
    const d = press(q, e.shiftKey)
    // Alt (Option) held: a shelf dragged leaves a copy where it goes (desktop; the pill's Kopier on touch)
    if (d?.kind === 'shelfMove') d.copy = e.altKey
    // Shift held (or «Fin» on in the pill): a drawn takdrager moves across in 50 mm steps, off the 1 m grid (Byggeregel T15)
    if (d?.kind === 'beam') d.fine = e.shiftKey || !!d.fineLock
    if (d?.kind === 'podiumGrip') d.fine = e.shiftKey || podiumFine(brush)
    if (d) drag.current = d
    // Held without moving counts as dragging too, so the hover preview stops while pressed
    setDragging(d ?? null)
  }

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const q = toModel(e)
    setHover(q)
    hoverRef.current = q
    const d = drag.current
    setDragging(d)
    if (!d) return
    if (d.kind === 'beam') d.fine = e.shiftKey || !!d.fineLock
    if (d.kind === 'podium') podiumShift(d, e.shiftKey || podiumFine(brush))
    if (d.kind === 'run') runShift(d, fineOf(e.shiftKey))
    if (d.kind === 'plates' && d.as) runShift(d.as, fineOf(e.shiftKey))
    if (d.kind === 'podiumGrip') d.fine = e.shiftKey || podiumFine(brush)
    handlersOf(d).move?.(c, d, q)
  }

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current
    drag.current = null
    setDragging(null)
    if (!d) return
    // After a press the preview follows the pointer again, until Shift is pressed anew
    if (d.kind === 'podium' || d.kind === 'run' || d.kind === 'plates') setFreeze(null)
    handlersOf(d).up?.(c, d, toModel(e))
  }

  const onPointerCancel = () => {
    drag.current = null
    setDragging(null)
    setStroke(null)
    setFillRect(null)
    setErasing(null)
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

  // Velg: what a click would select (the plan marks it faintly): from the hover, or on touch from the press held
  const held = dragging && 'select' in dragging && !('moved' in dragging && dragging.moved) ? dragging.select : null
  const hovered = !dragging && hover && tool === 'select' && !input.mini ? startSelect(c, hover) : null
  const picked = tool !== 'select' || input.mini ? null : (held ?? (hovered && 'select' in hovered ? hovered.select : null))

  return {
    svg,
    svgRef,
    picked,
    svgEl,
    hover,
    dragging,
    fillRect,
    stroke: strokeLine,
    textileStroke,
    dropHover,
    erasing,
    freeze,
    /** 250 steps now: Shift held or «Fin» on, with the wall or textile pen. */
    fine: fineOf(shiftHeld),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave: () => {
        setHover(null)
        hoverRef.current = null
      },
      onDragOver,
      onDragLeave: () => setDropHover(null),
      onDrop,
    },
  }
}

export type PlanPointer = ReturnType<typeof usePlanPointer>
