import { describe, expect, it } from 'vitest'
import { calc } from '../../calc/calc'
import { r2 } from '../../calc/referenceStands'
import { addObject, footprintBox, objectFootprint } from '../../domain/objects'
import { catalog, place, rules } from '../env'
import { build } from './build'
import { chosenBox } from './pill'

describe('the 3D pill finds what is chosen', () => {
  const v = addObject(r2(), place, '5276', 4, 2.7)!
  const g = build(v, calc(v, rules, catalog))
  const obj = v.objects[v.objects.length - 1]

  it('boxes a piece of furniture around where it stands', () => {
    const b = chosenBox(g, v, { objectId: obj.id })
    expect(b.isEmpty()).toBe(false)
    // World is centred on the stand: model x → x − W/2, y → z − D/2. The box's middle lies in its footprint
    const f = footprintBox(obj, objectFootprint(place, obj)!)
    const cx = (b.min.x + b.max.x) / 2 + v.stand.width / 2
    const cy = (b.min.z + b.max.z) / 2 + v.stand.depth / 2
    expect(cx).toBeGreaterThan(f.x0)
    expect(cx).toBeLessThan(f.x1)
    expect(cy).toBeGreaterThan(f.y0)
    expect(cy).toBeLessThan(f.y1)
    expect(b.min.y).toBeGreaterThanOrEqual(-0.01)
  })

  it('boxes a wall over its whole length and height', () => {
    const w = v.walls[0]
    const b = chosenBox(g, v, { wallId: w.id })
    const len = Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1])
    expect(Math.max(b.max.x - b.min.x, b.max.z - b.min.z)).toBeGreaterThanOrEqual(len - 0.1)
    expect(b.max.y).toBeGreaterThan(2)
  })

  it('has nothing for an empty or gone selection', () => {
    expect(chosenBox(g, v, {}).isEmpty()).toBe(true)
    expect(chosenBox(g, v, { objectId: 'gone' }).isEmpty()).toBe(true)
  })
})
