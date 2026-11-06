// The name pill's text and where it goes (NameTip.tsx). Pure, so it can be tested without a browser.

export interface TipText {
  /** What the button is: «Vegg». */
  name: string
  /** What it does, on a line under the name: «dra langs rutenettet». */
  more?: string
  /** Keyboard shortcut, shown as a key cap by the name: «S». */
  key?: string
}

// A shortcut is short and has no spaces: «S», «⇧⌘Z», «Delete», «Esc». «(gulv)» at the end of a sentence would also
// match, so keep the titles in the form «Navn · forklaring (tast)».
const KEY = /\s*\(([^\s()]{1,8})\)$/

/** «Navn · forklaring (tast)» → name, more and key. Only the first « · » splits; later ones stay in the explanation. */
export function splitTip(text: string): TipText {
  let s = text.trim()
  let key: string | undefined
  const k = KEY.exec(s)
  if (k) {
    key = k[1]
    s = s.slice(0, k.index).trim()
  }
  const i = s.indexOf(' · ')
  const name = i < 0 ? s : s.slice(0, i).trim()
  const more = i < 0 ? '' : s.slice(i + 3).trim()
  return { name, ...(more ? { more } : {}), ...(key ? { key } : {}) }
}

export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** Space between the button and the pill, and between the pill and the window edge. */
export const TIP_GAP = 6
export const TIP_MARGIN = 8

/**
 * Top left corner of a pill of `size` for the button at `r`, in a window of `view`. Over the button, under it when
 * there is no room over it, or to its right for buttons at the far left (`side`). Always inside the window, never over
 * the button it explains.
 */
export function placeTip(r: Box, size: { w: number; h: number }, view: { w: number; h: number }, side: 'above' | 'right'): { x: number; y: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)))
  if (side === 'right' && r.right + TIP_GAP + size.w <= view.w - TIP_MARGIN) {
    return { x: r.right + TIP_GAP, y: clamp((r.top + r.bottom - size.h) / 2, TIP_MARGIN, view.h - TIP_MARGIN - size.h) }
  }
  const over = r.top - TIP_GAP - size.h
  const y = over >= TIP_MARGIN ? over : r.bottom + TIP_GAP
  return { x: clamp((r.left + r.right - size.w) / 2, TIP_MARGIN, view.w - TIP_MARGIN - size.w), y }
}
