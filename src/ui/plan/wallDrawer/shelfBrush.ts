// The shelf brush in the wall drawer's drawing (Bjørn 9.11.2026): the pointer over a felt shows, dimmed, the shelf a
// click lays there and at what height (domain/shelves/brush.ts), a press and drag sideways a row, up and down its height;
// the release stores it. Felts that cannot take it are hatched, with why in the hint line. A finger has no hover, so on
// iPad the dimmed shelf shows from the press. With Shift (Bjørn 9.11.2026) the brush stacks: a click is «Hylle til i
// feltet», dragged up one more shelf per STACK_PX and down back again (never fewer than the click's one, so a stroke
// never takes away shelves laid before), sideways the felt is copied to the felts dragged over. Esc: while pressed drops
// the stroke, else puts the brush away. What is shown is the same edit the release stores (strokeOf). Drawn by
// BrushPreview.tsx.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from 'react'
import { brushHeight, paintShelves, spreadFelt, stackFelt, type BrushResult } from '../../../domain/shelves/brush'
import { highWarning, shelvesIn, shelvesOn, tooHigh } from '../../../domain/shelves/model'
import { mm } from '../dims'
import type { FaceSide } from '../../../domain/faces'
import type { Variant, Wall } from '../../../domain/types'
import { rules } from '../../env'

/** Screen pixels dragged up (with Shift) for each more shelf in the felt. */
const STACK_PX = 40

/** Where the brush is: the felt pressed (or under the pointer), the felt it is dragged to, the pointer's height, and
 *  with Shift (taken at the press) how far it has gone up on the screen since the press, px. */
interface Aim {
  m0: number
  m1: number
  raw: number
  stack: boolean
  up: number
  /** The pointer's y on the screen at the press. */
  py: number
  pressed: boolean
}

export interface Stroke extends BrushResult {
  /** Where the pill goes: the new shelf's height, or the top of the stacked felt. */
  y: number
  m0: number
  m1: number
  /** The pill's text. */
  label: string
  /** Why the stacked felt takes no more. */
  full?: string
}

/** What the brush lays for an aim: at the pointer's height (paintShelves), or with Shift a stack copied sideways. */
function strokeOf(v: Variant, w: Wall, s: FaceSide, a: Aim): Stroke {
  const base = { m0: a.m0, m1: a.m1 }
  if (!a.stack) {
    const y = brushHeight(v, rules, w.id, s, a.m0, a.m1, a.raw)
    const r = paintShelves(v, rules, w.id, s, a.m0, a.m1, y)
    return { ...base, ...r, y, label: r.ids.length > 1 ? `${r.ids.length} × ${mm(y)}` : mm(y) }
  }
  const n = Math.max(1, 1 + Math.floor(a.up / STACK_PX))
  const st = stackFelt(v, rules, w.id, s, a.m0, n)
  const sp = spreadFelt(st.v, rules, w.id, s, a.m0, a.m0, a.m1)
  const stack = shelvesIn(st.v, w.id, a.m0, s)
  const felts = new Set(shelvesOn(sp.v, w.id, s).filter((x) => sp.ids.includes(x.id)).map((x) => x.module)).size + 1
  const out = [...(st.ids.length ? [] : [{ module: a.m0, why: st.full ?? 'Ingen plass til flere hyller i feltet' }]), ...sp.out]
  const k = stack.length
  return {
    ...base,
    v: sp.v,
    ids: [...st.ids, ...sp.ids],
    out,
    full: st.full,
    y: stack.length ? stack[stack.length - 1].y : a.raw,
    label: felts > 1 ? `${felts} felt × ${k} hyller` : `${k} ${k === 1 ? 'hylle' : 'hyller'} i feltet`,
  }
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
  // Worked out again only when the aim or the sketch changes, not on every render of the drawing
  const stroke = useMemo(() => (on && aim ? strokeOf(v, w, s, aim) : null), [on, aim, v, w, s])

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
      } else if (e.key === 'Shift' && a && !a.pressed) setAim({ ...a, stack: e.type === 'keydown' })
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
      setAim({ m0: p.m, m1: p.m, raw: p.raw, stack: e.shiftKey, up: 0, py: e.clientY, pressed: true })
    },
    onPointerMove: (e: RPointerEvent) => {
      const p = at(e)
      const a = ref.current
      if (a?.pressed) {
        if (p) setAim({ ...a, m1: p.m, raw: p.raw, up: a.py - e.clientY })
        return
      }
      if (e.pointerType === 'touch') return
      setAim(p?.inside ? { m0: p.m, m1: p.m, raw: p.raw, stack: e.shiftKey, up: 0, py: e.clientY, pressed: false } : null)
    },
    onPointerUp: () => {
      const a = ref.current
      if (!a?.pressed) return
      // Nothing shows until the pointer moves again: else the shelf just laid would show hatched under it at once
      setAim(null)
      const r = strokeOf(v, w, s, a)
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
  const hint =
    stroke && (stroke.out.find((x) => x.module === stroke.m1)?.why ?? stroke.full ?? (tooHigh(rules, stroke.y) ? highWarning(rules) : null))
  /** The face's shelves as the stroke would leave them, for the height chains. */
  const shelves = stroke?.ids.length ? shelvesOn(stroke.v, w.id, s) : undefined
  return { stroke, handlers, hint, shelves }
}
