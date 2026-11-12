import { describe, expect, it } from 'vitest'
import { parse } from '../../../persistence/file'
import type { Variant } from '../../../domain/types'
import { PILL_GAP, PILL_PAST_CHAIN, PILL_PAST_NAME, pillAnchor, placePill, type PillAnchor } from './pillAnchor'

const TEXTS = import.meta.glob<string>('../../../test/fixtures/*.json', { query: '?raw', import: 'default', eager: true })
const sketch = (name: string): Variant => {
  const key = Object.keys(TEXTS).find((k) => k.includes(name))!
  const r = parse(TEXTS[key])
  if (!r.ok) throw new Error(r.error)
  return r.sketch.variants[0]
}

describe('Where the selection pill stands', () => {
  it('a back stand wall: over it, past the totals and side name; else on the stand side past the module chain', () => {
    const v = sketch('02-hjorne-utstiller')
    const a = pillAnchor(v, { wallId: 'side-back' })!
    expect(a.tries[0]).toEqual({ dir: 'up', gap: PILL_PAST_NAME })
    expect(a.tries.at(-1)).toEqual({ dir: 'down', gap: PILL_PAST_CHAIN })
  })

  it('a vertical wall: beside it away from the centre, then over its top end, under its bottom end, then the stand side', () => {
    const v = sketch('02-hjorne-utstiller')
    const a = pillAnchor(v, { wallId: 'side-right' })!
    expect(a.tries.map((t) => t.dir)).toEqual(['right', 'up', 'down', 'left'])
    // The right wall runs from the back edge to the front edge: both ends clear the names
    expect(a.tries[1].gap).toBe(PILL_PAST_NAME)
    expect(a.tries[2].gap).toBe(PILL_PAST_NAME)
  })

  it('furniture inside the stand: over it, else under it, a small gap', () => {
    const v = sketch('10-mobler-utstyr')
    const a = pillAnchor(v, { objectId: v.objects[0].id })!
    expect(a.tries).toEqual([
      { dir: 'up', gap: PILL_GAP },
      { dir: 'down', gap: PILL_GAP },
    ])
  })

  it('a counter: past its width measure, toward the middle of the stand, else on the other side (K7)', () => {
    const v = sketch('10-mobler-utstyr')
    const id = v.objects.find((o) => o.product === '6560')!.id
    // In the front half its measure stands over it: the pill goes over that, not down toward the aisle
    expect(pillAnchor(v, { objectId: id })!.tries).toEqual([
      { dir: 'up', gap: PILL_PAST_CHAIN },
      { dir: 'down', gap: PILL_GAP },
    ])
    const back = { ...v, objects: v.objects.map((o) => (o.id === id ? { ...o, y: 1 } : o)) }
    expect(pillAnchor(back, { objectId: id })!.tries).toEqual([
      { dir: 'down', gap: PILL_PAST_CHAIN },
      { dir: 'up', gap: PILL_GAP },
    ])
  })

  it('nothing to anchor to once the object is gone', () => {
    const v = sketch('10-mobler-utstyr')
    expect(pillAnchor(v, { objectId: 'gone' })).toBeNull()
    expect(pillAnchor(v, {})).toBeNull()
  })
})

describe('Placing the pill on screen', () => {
  const anchor: PillAnchor = { x0: 0, y0: 0, x1: 1, y1: 1, tries: [{ dir: 'up', gap: 10 }, { dir: 'down', gap: 20 }] }
  const size = { w: 800, h: 600 }
  const dims = { w: 200, h: 40 }

  it('goes over the box, centred, when there is room', () => {
    const at = placePill({ anchor, size, box: { left: 300, top: 300, right: 400, bottom: 350 } }, dims)
    expect(at).toEqual({ left: 250, top: 250 })
  })

  it('goes under the box when there is no room over it', () => {
    const at = placePill({ anchor, size, box: { left: 300, top: 30, right: 400, bottom: 80 } }, dims)
    expect(at).toEqual({ left: 250, top: 100 })
  })

  it('stays inside the plan', () => {
    const at = placePill({ anchor, size, box: { left: 0, top: 300, right: 20, bottom: 320 } }, dims)
    expect(at.left).toBe(8)
  })
})

describe('Keeping clear of what floats over the plan', () => {
  it('goes under the box when the place over it is covered', () => {
    const anchor: PillAnchor = { x0: 0, y0: 0, x1: 1, y1: 1, tries: [{ dir: 'up', gap: 10 }, { dir: 'down', gap: 20 }] }
    const at = placePill({ anchor, size: { w: 800, h: 600 }, box: { left: 300, top: 300, right: 400, bottom: 350 }, avoid: [{ left: 0, top: 200, right: 800, bottom: 280 }] }, { w: 200, h: 40 })
    expect(at).toEqual({ left: 250, top: 370 })
  })
})
