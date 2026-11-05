import { describe, expect, it } from 'vitest'
import { awayFrom, pillCentre, pillWidth } from './pillPlace'
import type { PlanScale } from './planScale'

const sc: PlanScale = { u: 1 / 100, lw: 1, detail: 'full' }
const C: [number, number] = [3, 2]

describe('measure pill placement', () => {
  it('points away from the stand centre', () => {
    expect(awayFrom([0, 1], [3, 1], C)).toEqual([0, -1])
    expect(awayFrom([0, 3], [3, 3], C)).toEqual([0, 1])
    expect(awayFrom([1, 0], [1, 4], C)).toEqual([-1, 0])
    expect(awayFrom([5, 4], [5, 0], C)).toEqual([1, 0])
  })

  it('goes up or left on a stroke through the centre', () => {
    expect(awayFrom([0, 2], [6, 2], C)).toEqual([0, -1])
    expect(awayFrom([3, 0], [3, 4], C)).toEqual([-1, 0])
  })

  it('stands 6 px outside the stroke edge', () => {
    // 5 px stroke, 6 px gap, half of the 18 px pill: 2.5 + 6 + 9 = 17.5 px above the line
    const [x, y] = pillCentre(sc, [0, 1], [3, 1], C, 0.05, '3 000')
    expect(x).toBeCloseTo(1.5)
    expect(y).toBeCloseTo(1 - 0.175)
  })

  it('beside a vertical stroke stands out by half its width', () => {
    const t = '4 000'
    const [x] = pillCentre(sc, [1, 0], [1, 4], C, 0.05, t)
    expect(x).toBeCloseTo(1 - 0.025 - 0.06 - pillWidth(sc, t) / 2)
  })
})
