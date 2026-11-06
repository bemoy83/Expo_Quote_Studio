// One shared name pill for every icon button, in place of the browser's title bubble (which comes late, does not look
// like the app and never shows on a tablet or on keyboard focus). Mounted once in App.tsx; the buttons are not changed.
//
// It listens on the window (capture, so a handler that stops a press cannot hide it from us) and finds the nearest
// button, [role=button], [role=tab] or [role=radio] with a title. The title is moved to data-tip the first time, so the
// browser's own bubble does not show as well; a title React sets again later is moved again (MutationObserver). A title
// that goes from text to nothing leaves the old text in data-tip, so give such a button a title in both states.
// Text: «Navn · forklaring (tast)», see tip.ts.
//
// When: mouse after 350 ms still on the button, at once while gliding from a pill that was just showing (600 ms), at
// once on keyboard focus, on touch after holding 500 ms (the click that follows is swallowed, the pill goes 1.4 s after
// the finger lifts). Gone on a press, when the pointer leaves, on Escape, on scroll and when the window is resized.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { placeTip, splitTip, type TipText } from './tip'

const TARGET = 'button, [role=button], [role=tab], [role=radio], label:has(input[type=file])'
/** Buttons at the far left of the window get the pill on their right: the side strip, undo and redo. */
const SIDE = '.strip, .dock-undo'
const ID = 'name-tip'

const HOVER_MS = 350
const GLIDE_MS = 600
const HOLD_MS = 500
const LINGER_MS = 1400
/** A finger that moves this far is scrolling or dragging, not holding. */
const SLOP = 10

interface Shown extends TipText {
  el: Element
}

/** The text of a target, moving its title to data-tip on the way. */
function tipOf(el: Element): string | null {
  const t = el.getAttribute('title')
  if (t) {
    el.setAttribute('data-tip', t)
    el.removeAttribute('title')
    // An icon-only button that was named by its title alone keeps a name for screen readers
    if (!el.hasAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', splitTip(t).name)
  }
  return el.getAttribute('data-tip') || null
}

function targetOf(node: EventTarget | null): Element | null {
  const el = node instanceof Element ? node.closest(TARGET) : null
  return el && tipOf(el) ? el : null
}

export function NameTip() {
  const [shown, setShown] = useState<Shown | null>(null)
  const pill = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let current: Element | null = null
    let timer = 0
    let lingerTimer = 0
    let hiddenAt = -Infinity
    /** Pressed with the mouse: no pill again until the pointer leaves it. */
    let pressed: Element | null = null
    /** The finger held a button long enough: its pill shows and the click that follows is swallowed. */
    let held = false
    let touch: { el: Element; x: number; y: number } | null = null
    /** Under the mouse, waiting for it to stand still. */
    let pending: Element | null = null

    const show = (el: Element) => {
      window.clearTimeout(timer)
      window.clearTimeout(lingerTimer)
      const text = tipOf(el)
      if (!text) return
      current = el
      pending = null
      setShown({ el, ...splitTip(text) })
    }
    const hide = () => {
      window.clearTimeout(timer)
      window.clearTimeout(lingerTimer)
      if (current) hiddenAt = performance.now()
      current = null
      setShown(null)
    }
    const warm = () => current !== null || performance.now() - hiddenAt < GLIDE_MS
    const later = (el: Element, ms: number) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => show(el), ms)
    }

    const over = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.buttons) return
      const el = targetOf(e.target)
      if (!el || el === current || el === pending || el === pressed) return
      if (warm()) show(el)
      else {
        pending = el
        later(el, HOVER_MS)
      }
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (touch && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > SLOP) {
          window.clearTimeout(timer)
          touch = null
        }
        return
      }
      // «Still on the button»: every move starts the wait again
      if (pending && pending.contains(e.target as Node)) later(pending, HOVER_MS)
    }
    const out = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const to = e.relatedTarget as Node | null
      const from = current ?? pending ?? pressed
      if (from && to && from.contains(to)) return
      pending = null
      pressed = null
      if (current) hide()
      else window.clearTimeout(timer)
    }
    const down = (e: PointerEvent) => {
      held = false
      if (e.pointerType !== 'touch') {
        pressed = targetOf(e.target)
        pending = null
        hide()
        return
      }
      hide()
      const el = targetOf(e.target)
      touch = el ? { el, x: e.clientX, y: e.clientY } : null
      if (el)
        timer = window.setTimeout(() => {
          held = true
          show(el)
        }, HOLD_MS)
    }
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      touch = null
      if (!held) return window.clearTimeout(timer)
      window.clearTimeout(lingerTimer)
      lingerTimer = window.setTimeout(hide, LINGER_MS)
    }
    const click = (e: MouseEvent) => {
      if (!held) return
      held = false
      e.preventDefault()
      e.stopPropagation()
    }
    // A long press opens the context menu on some tablets
    const menu = (e: Event) => held && e.preventDefault()
    const focusIn = (e: FocusEvent) => {
      const el = targetOf(e.target)
      if (el && el.matches(':focus-visible')) show(el)
    }
    const focusOut = (e: FocusEvent) => {
      if (current && current === targetOf(e.target)) hide()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && current && hide()
    const gone = () => current && hide()

    // A title React sets again on a button already seen is moved to data-tip again
    const titles = new MutationObserver((list) => {
      for (const m of list) if (m.target instanceof Element && m.target.hasAttribute('title') && m.target.matches(TARGET)) tipOf(m.target)
    })
    titles.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['title'] })
    // A button that goes away under its pill (the pill or drawer it sat in closed) takes the pill with it
    const watch = window.setInterval(() => current && !current.isConnected && hide(), 250)

    const on: [string, EventListener][] = [
      ['pointerover', over as EventListener],
      ['pointermove', move as EventListener],
      ['pointerout', out as EventListener],
      ['pointerdown', down as EventListener],
      ['pointerup', up as EventListener],
      ['pointercancel', up as EventListener],
      ['click', click as EventListener],
      ['contextmenu', menu],
      ['focusin', focusIn as EventListener],
      ['focusout', focusOut as EventListener],
      ['keydown', key as EventListener],
      ['scroll', gone],
      ['resize', gone],
    ]
    for (const [k, f] of on) window.addEventListener(k, f, true)
    return () => {
      for (const [k, f] of on) window.removeEventListener(k, f, true)
      titles.disconnect()
      window.clearInterval(watch)
      window.clearTimeout(timer)
      window.clearTimeout(lingerTimer)
    }
  }, [])

  // Place the pill once it has its size, and describe the button by it while it shows
  useLayoutEffect(() => {
    const p = pill.current
    if (!shown || !p) return
    const r = shown.el.getBoundingClientRect()
    const at = placeTip(r, { w: p.offsetWidth, h: p.offsetHeight }, { w: window.innerWidth, h: window.innerHeight }, shown.el.closest(SIDE) ? 'right' : 'above')
    p.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`
    p.style.visibility = 'visible'
    const el = shown.el
    const had = el.getAttribute('aria-describedby')
    el.setAttribute('aria-describedby', had ? `${had} ${ID}` : ID)
    return () => {
      if (had) el.setAttribute('aria-describedby', had)
      else el.removeAttribute('aria-describedby')
    }
  }, [shown])

  if (!shown) return null
  return (
    <div ref={pill} id={ID} role="tooltip" className="name-tip">
      <span className="nt-name">
        {shown.name}
        {shown.key && <kbd className="nt-key">{shown.key}</kbd>}
      </span>
      {shown.more && <span className="nt-more">{shown.more}</span>}
    </div>
  )
}
