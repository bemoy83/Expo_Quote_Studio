import { describe, expect, it } from 'vitest'
import { placeTip, splitTip, TIP_GAP, TIP_MARGIN } from './tip'

describe('splitTip', () => {
  it('takes a shortcut in brackets at the end as the key', () => {
    expect(splitTip('Vegg (S)')).toEqual({ name: 'Vegg', key: 'S' })
    expect(splitTip('Gjør om (⇧⌘Z)')).toEqual({ name: 'Gjør om', key: '⇧⌘Z' })
    expect(splitTip('Fjern (Delete)')).toEqual({ name: 'Fjern', key: 'Delete' })
  })
  it('takes what follows « · » as the explanation', () => {
    expect(splitTip('Innvendig takdrager · dra langs rutenettet')).toEqual({ name: 'Innvendig takdrager', more: 'dra langs rutenettet' })
  })
  it('splits name, explanation and key together, on the first « · » only', () => {
    expect(splitTip('Vegg · innervegger, dører, takdragere og bakrom (S)')).toEqual({ name: 'Vegg', more: 'innervegger, dører, takdragere og bakrom', key: 'S' })
    expect(splitTip('Teppe grå · 1 · 2 m')).toEqual({ name: 'Teppe grå', more: '1 · 2 m' })
  })
  it('leaves a plain name and brackets that are not a key alone', () => {
    expect(splitTip('Mer i skuffen')).toEqual({ name: 'Mer i skuffen' })
    expect(splitTip('Roter 90° (R)')).toEqual({ name: 'Roter 90°', key: 'R' })
    expect(splitTip('Bakrom (med dør)')).toEqual({ name: 'Bakrom (med dør)' })
    expect(splitTip('  Motiv: Skog  ')).toEqual({ name: 'Motiv: Skog' })
  })
})

describe('placeTip', () => {
  const view = { w: 1000, h: 800 }
  const size = { w: 100, h: 30 }
  const box = (left: number, top: number, w = 40, h = 40) => ({ left, top, right: left + w, bottom: top + h })

  it('puts the pill centred over the button', () => {
    expect(placeTip(box(480, 700), size, view, 'above')).toEqual({ x: 450, y: 700 - TIP_GAP - 30 })
  })
  it('goes under the button when there is no room over it', () => {
    expect(placeTip(box(480, 10), size, view, 'above')).toEqual({ x: 450, y: 50 + TIP_GAP })
  })
  it('stays inside the window at the edges', () => {
    expect(placeTip(box(0, 700), size, view, 'above').x).toBe(TIP_MARGIN)
    expect(placeTip(box(960, 700), size, view, 'above').x).toBe(1000 - TIP_MARGIN - 100)
  })
  it('goes to the right of buttons at the far left, centred on them', () => {
    expect(placeTip(box(0, 300), size, view, 'right')).toEqual({ x: 40 + TIP_GAP, y: 305 })
    expect(placeTip(box(0, 0), size, view, 'right').y).toBe(TIP_MARGIN)
  })
  it('never covers the button', () => {
    for (const r of [box(480, 700), box(480, 10), box(0, 0), box(960, 760)]) {
      for (const side of ['above', 'right'] as const) {
        const at = placeTip(r, size, view, side)
        const apart = at.x >= r.right || at.x + size.w <= r.left || at.y >= r.bottom || at.y + size.h <= r.top
        expect(apart).toBe(true)
      }
    }
  })
})
