// The shelf brush in the wall drawer's drawing (Bjørn 9.11.2026): the pointer over a felt shows, dimmed, the shelf a
// click lays there and at what height (domain/shelves/brush.ts), a press and drag sideways a row, up and down its height;
// the release stores it. Felts that cannot take it are hatched, with why in the hint line. A finger has no hover, so on
// iPad the dimmed shelf shows from the press. With Shift (Bjørn 9.11.2026) the brush stacks: a click is «Hylle til i
// feltet», dragged up one more shelf per STACK_PX and down back again (never fewer than the click's one, so a stroke
// never takes away shelves laid before), sideways the felt is copied to the felts dragged over. A click on a shelf
// already there takes it off, as the paint brush does a colour (Bjørn 9.11.2026): shown hatched, as Tøm shows what goes;
// a drag begun on it takes off only it. Esc: while pressed drops
// the stroke, else puts the brush away. What is shown is the same edit the release stores (strokeOf). Drawn by
// BrushPreview.tsx.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from 'react'
import { brushHeight, paintShelves, shelfUnder, spreadFelt, stackFelt, type BrushResult } from '../../../domain/shelves/brush'
import { removeShelves } from '../../../domain/shelves/edit'
import { highWarning, shelvesIn, shelvesOn, tooHigh } from '../../../domain/shelves/model'
import { mm } from '../dims'
import type { FaceSide } from '../../../domain/faces'
import { moduleCount } from '../../../domain/grid'
import type { Shelf, Variant, Wall } from '../../../domain/types'
import { rules } from '../../env'

/** Screen pixels dragged up (with Shift) for each more shelf in the felt. */
const STACK_PX = 40

/** How near a board, in screen pixels, the pointer takes it off (at least half the clear height, H5). */
const HIT_PX = 10

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
  /** The shelf the pointer is on (without Shift): a click takes it off. Kept from the press while dragging. */
  hit?: string
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
  /** The shelf a click takes off. */
  removed?: Shelf
}

/** What the brush lays for an aim: at the pointer's height (paintShelves), or with Shift a stack copied sideways. */
function strokeOf(v: Variant, w: Wall, s: FaceSide, a: Aim): Stroke {
  const base = { m0: a.m0, m1: a.m1 }
  const hit = a.hit && !a.stack ? shelvesOn(v, w.id, s).find((x) => x.id === a.hit) : undefined
  if (hit) return { m0: a.m0, m1: a.m0, v: removeShelves(v, [hit.id]), ids: [], out: [], removed: hit, y: hit.y, label: 'Fjernes' }
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
    const mod = Math.max(0, Math.min(moduleCount(w) - 1, Math.floor(t)))
    const raw = H - q.y
    const hit = shelfUnder(v, w.id, mod, s, raw, Math.max(rules.shelf.gap / 2, HIT_PX / m.a))?.id
    return { inside: t >= 0 && t <= L && q.y >= 0 && q.y <= H, m: mod, raw, hit }
  }

  const handlers = {
    style: { cursor: 'crosshair' },
    onPointerDown: (e: RPointerEvent) => {
      e.stopPropagation()
      if (e.button !== 0) return
      const p = at(e)
      if (!p?.inside) return
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      setAim({ m0: p.m, m1: p.m, raw: p.raw, stack: e.shiftKey, up: 0, py: e.clientY, pressed: true, hit: p.hit })
    },
    onPointerMove: (e: RPointerEvent) => {
      const p = at(e)
      const a = ref.current
      if (a?.pressed) {
        if (p) setAim({ ...a, m1: p.m, raw: p.raw, up: a.py - e.clientY })
        return
      }
      if (e.pointerType === 'touch') return
      setAim(p?.inside ? { m0: p.m, m1: p.m, raw: p.raw, stack: e.shiftKey, up: 0, py: e.clientY, pressed: false, hit: p.hit } : null)
    },
    onPointerUp: () => {
      const a = ref.current
      if (!a?.pressed) return
      // Nothing shows until the pointer moves again: else the shelf just laid would show hatched under it at once
      setAim(null)
      const r = strokeOf(v, w, s, a)
      // Where nothing goes on (too close, a blocked felt) the click does nothing: the hatch and the hint line said why
      if (r.ids.length || r.removed) onEdit(() => r.v)
    },
    onPointerCancel: () => setAim(null),
    onPointerLeave: () => {
      if (!ref.current?.pressed) setAim(null)
    },
  }

  /** What the hint line says while aiming: that a click takes the shelf off, why the felt under the pointer takes none,
   *  or the height warning. */
  const hint = !stroke
    ? null
    : stroke.removed
      ? 'Klikk fjerner hyllen · Shift-klikk legger en hylle til i feltet'
      : (stroke.out.find((x) => x.module === stroke.m1)?.why ?? stroke.full ?? (tooHigh(rules, stroke.y) ? highWarning(rules) : null))
  /** The face's shelves as the stroke would leave them, for the height chains. */
  const shelves = stroke?.ids.length || stroke?.removed ? shelvesOn(stroke.v, w.id, s) : undefined
  return { stroke, handlers, hint, shelves }
}
