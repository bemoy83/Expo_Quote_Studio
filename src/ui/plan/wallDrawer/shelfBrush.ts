// The shelf brush in the wall drawer's drawing (Bjørn 9.11.2026): the pointer over a felt shows, dimmed, the shelf a
// click lays there and at what height (domain/shelves/brush.ts), a press and drag sideways a row, up and down its height;
// the release stores it. Felts that cannot take it are hatched, with why in the hint line. A finger has no hover, so on
// iPad the dimmed shelf shows from the press. Shift: no catching, only 50 mm steps. Esc: while pressed drops the stroke,
// else puts the brush away. What is shown is paintShelves' result, the same edit the release stores. Drawn by
// BrushPreview.tsx.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from 'react'
import { brushHeight, paintShelves, type BrushResult } from '../../../domain/shelves/brush'
import { highWarning, shelvesOn, tooHigh } from '../../../domain/shelves/model'
import type { FaceSide } from '../../../domain/faces'
import type { Variant, Wall } from '../../../domain/types'
import { rules } from '../../env'

/** Where the brush is: the felt pressed (or under the pointer), the felt it is dragged to, the pointer's height. */
interface Aim {
  m0: number
  m1: number
  raw: number
  free: boolean
  pressed: boolean
}

export interface Stroke extends BrushResult {
  y: number
  m0: number
  m1: number
  pressed: boolean
}

interface Deps {
  svg: RefObject<SVGSVGElement | null>
  v: Variant
  w: Wall
  s: FaceSide
  L: number
  H: number
  /** The brush is out. */
  on: boolean
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  /** Esc with nothing pressed: put the brush away. */
  onDone: () => void
}

export function useShelfBrush({ svg, v, w, s, L, H, on, onEdit, onDone }: Deps) {
  const [aim, setAimState] = useState<Aim | null>(null)
  const ref = useRef<Aim | null>(null)
  const setAim = (a: Aim | null) => {
    ref.current = a
    setAimState(a)
  }
  const stroke: Stroke | null = (() => {
    if (!on || !aim) return null
    const y = brushHeight(v, rules, w.id, s, aim.m0, aim.m1, aim.raw, aim.free)
    return { y, m0: aim.m0, m1: aim.m1, pressed: aim.pressed, ...paintShelves(v, rules, w.id, s, aim.m0, aim.m1, y) }
  })()

  // Esc and Shift while the brush is out. Esc is taken before the app's own (which would close the drawer).
  const off = useRef(onDone)
  useEffect(() => {
    off.current = onDone
  })
  useEffect(() => {
    if (!on) return
    const key = (e: KeyboardEvent) => {
      const a = ref.current
      if (e.key === 'Escape' && e.type === 'keydown') {
        e.stopImmediatePropagation()
        if (a?.pressed) setAim(null)
        else off.current()
      } else if (e.key === 'Shift' && a) setAim({ ...a, free: e.type === 'keydown' })
    }
    window.addEventListener('keydown', key, true)
    window.addEventListener('keyup', key, true)
    return () => {
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('keyup', key, true)
      // Put away: nothing aimed when it is taken again
      ref.current = null
      setAimState(null)
    }
  }, [on])

  /** The felt and height under the pointer; null outside the wall. */
  const at = (e: RPointerEvent) => {
    const m = svg.current?.getScreenCTM()
    if (!m) return null
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    const t = s === 1 ? q.x : L - q.x
    return { inside: t >= 0 && t <= L && q.y >= 0 && q.y <= H, m: Math.max(0, Math.min(L - 1, Math.floor(t))), raw: H - q.y }
  }

  const handlers = {
    style: { cursor: 'crosshair' },
    onPointerDown: (e: RPointerEvent) => {
      e.stopPropagation()
      if (e.button !== 0) return
      const p = at(e)
      if (!p?.inside) return
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      setAim({ m0: p.m, m1: p.m, raw: p.raw, free: e.shiftKey, pressed: true })
    },
    onPointerMove: (e: RPointerEvent) => {
      const p = at(e)
      const a = ref.current
      if (a?.pressed) {
        if (p) setAim({ ...a, m1: p.m, raw: p.raw, free: e.shiftKey })
        return
      }
      if (e.pointerType === 'touch') return
      setAim(p?.inside ? { m0: p.m, m1: p.m, raw: p.raw, free: e.shiftKey, pressed: false } : null)
    },
    onPointerUp: () => {
      const a = ref.current
      if (!a?.pressed) return
      // Nothing shows until the pointer moves again: else the shelf just laid would show hatched under it at once
      setAim(null)
      const y = brushHeight(v, rules, w.id, s, a.m0, a.m1, a.raw, a.free)
      const r = paintShelves(v, rules, w.id, s, a.m0, a.m1, y)
      // Where nothing goes on (a shelf there already, too close, a blocked felt) the click does nothing: the hatch and the
      // hint line said why (Bjørn 9.11.2026)
      if (r.ids.length) onEdit(() => r.v)
    },
    onPointerCancel: () => setAim(null),
    onPointerLeave: () => {
      if (!ref.current?.pressed) setAim(null)
    },
  }

  /** What the hint line says while aiming: why the felt under the pointer takes none, or the height warning. */
  const hint = stroke && (stroke.out.find((x) => x.module === stroke.m1)?.why ?? (tooHigh(rules, stroke.y) ? highWarning(rules) : null))
  /** The face's shelves as the stroke would leave them, for the height chains. */
  const shelves = stroke?.ids.length ? shelvesOn(stroke.v, w.id, s) : undefined
  return { stroke, handlers, hint, shelves }
}
