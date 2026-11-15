import { describe, expect, it } from 'vitest'
import { DOOR } from '../../catalog/defaultCatalog'
import { setOpening } from '../../domain/doors'
import { paintWalls } from '../../domain/edit'
import { moduleKey, moduleStart } from '../../domain/grid'
import { createVariant } from '../../domain/variant'
import { dragGrip, gripsOf, gripWith } from './grips'

/** A 4 m inner wall across a 6 × 4 stand with a door in its second module, x 2–3. */
function sketch() {
  const v = setOpening(paintWalls(createVariant('A', { width: 6, depth: 4, type: 'row' }), [1, 2], [5, 2]), moduleKey([2, 2], [3, 2]), DOOR)
  return { v, id: v.openings[0].id }
}

describe('the grip of a chosen door (Byggeregel D8)', () => {
  it('stands in the middle of the door, in Velg and with the door pen', () => {
    const { v, id } = sketch()
    const [g] = gripsOf(v, { openingId: id })
    expect(g.on).toEqual({ type: 'door', id })
    expect(g.at).toEqual([2.5, 2])
    expect(gripWith(g.on, 'select', null)).toBe(true)
    expect(gripWith(g.on, 'brush', { kind: 'opening', product: DOOR } as never)).toBe(true)
  })

  it('moves the door in whole metres, 250 with Fin, and says where it stands', () => {
    const { v, id } = sketch()
    const start: [number, number] = [2.5, 2]
    const whole = dragGrip(v, { type: 'door', id }, start, [3.4, 2], false)!
    if (!('v' in whole)) throw new Error(whole.error)
    const ww = whole.v.walls.find((x) => x.id === whole.v.openings[0].wallId)!
    expect(moduleStart(ww, whole.v.openings[0].module)).toBe(2)
    expect(ww.breaks).toBeUndefined()
    const fine = dragGrip(v, { type: 'door', id }, start, [2.8, 2], true)!
    if (!('v' in fine)) throw new Error(fine.error)
    const w = fine.v.walls.find((x) => x.id === fine.v.openings[0].wallId)!
    expect(moduleStart(w, fine.v.openings[0].module)).toBe(1.25)
    expect(w.breaks).toEqual([1.25])
    expect(fine.pill.text).toMatch(/^1\s250 fra venstre$/)
  })

  it('stops at the end of the wall', () => {
    const { v, id } = sketch()
    const r = dragGrip(v, { type: 'door', id }, [2.5, 2], [9, 2], false)!
    if (!('v' in r)) throw new Error(r.error)
    const w = r.v.walls.find((x) => x.id === r.v.openings[0].wallId)!
    expect(moduleStart(w, r.v.openings[0].module)).toBe(3)
  })
})
