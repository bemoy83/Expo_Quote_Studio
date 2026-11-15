import { describe, expect, it } from 'vitest'
import { moduleAt, moduleCc, moduleCount, moduleFrom, moduleSpans, moduleStart } from './grid'
import type { Wall } from './types'

const wall = (L: number, breaks?: number[]): Wall => ({ id: 'w', from: [0, 0], to: [L, 0], ...(breaks ? { breaks } : {}) }) as Wall

describe('moduleSpans (Byggeregel D8)', () => {
  it('lays whole metres from the start and the rest last', () => {
    expect(moduleSpans(wall(3.75))).toEqual([[0, 1], [1, 2], [2, 3], [3, 3.75]])
    expect(moduleCc(wall(3.75), 3)).toBe(0.75)
  })

  it('a door off the whole metres takes a 1000 module, the rest lies next to it', () => {
    // 4 m wall, door from 1.25: 1000 · 250 · door · 1000 · 750 as in the plan
    const w = wall(4, [1.25])
    expect(moduleSpans(w)).toEqual([[0, 1], [1, 1.25], [1.25, 2.25], [2.25, 3.25], [3.25, 4]])
    expect(moduleCount(w)).toBe(5)
    expect(moduleStart(w, 2)).toBe(1.25)
    expect(moduleFrom(w, 1.25)).toBe(2)
    expect(moduleAt(w, 1.7)).toBe(2)
    expect(moduleAt(w, 4)).toBe(4)
  })

  it('ignores a break that does not fit', () => {
    expect(moduleSpans(wall(2, [1.5]))).toEqual([[0, 1], [1, 2]])
  })
})
