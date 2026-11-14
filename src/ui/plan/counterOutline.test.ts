import { describe, expect, it } from 'vitest'
import type { PlacedObject } from '../../domain/types'
import { place } from '../env'
import { counterOutline } from './counterOutline'
import { asSections } from '../../domain/podiumStock'

const at = (o: Partial<PlacedObject>): PlacedObject => ({ id: 'd', product: '6560', x: 2, y: 2, rot: 0, ...o })
const len = (s: { a: readonly number[]; b: readonly number[] }) => Math.round(Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) * 1000)

describe('a counter outline in the plan (K7, K8)', () => {
  it('6560 from stock: four sides, the back open', () => {
    const s = counterOutline(place, at({}))
    expect(s).toHaveLength(4)
    expect(s.filter((x) => x.open).map((x) => [x.out, len(x)])).toEqual([[[0, -1], 1020]])
  })

  it('turned half round, the open back faces the other way', () => {
    const s = counterOutline(place, at({ rot: 180 }))
    expect(s.filter((x) => x.open).map((x) => x.out)).toEqual([[0, 1]])
  })

  it('an L: one figure of six sides, no side where the pieces meet; open are the back and the inside', () => {
    // As Disker drew it, made sections when the sketch opens (K22)
    const o = asSections(
      at({
        pieces: [
          { a: [-500, 0], b: [500, 0], back: [0, -1] },
          { a: [-250, -250], b: [-250, -1250], back: [1, 0] },
        ],
      }),
      '6571',
    )
    const s = counterOutline(place, o)
    expect(s).toHaveLength(6)
    expect(s.reduce((n, x) => n + len(x), 0)).toBe(2 * (1020 + 1520))
    expect(s.filter((x) => x.open).map((x) => [x.out, len(x)]).sort()).toEqual([
      [[0, -1], 500],
      [[1, 0], 1000],
    ])
  })
})

describe('Disker og podier in the plan (K10, K11)', () => {
  const sec = (x0: number, x1: number, z0: number, z1: number) => ({ x: [x0, x1] as [number, number], z: [z0, z1] as [number, number], h: 1000 })

  it('1500 × 500: one closed figure of four sides round both sections', () => {
    const s = counterOutline(place, at({ product: '6571', sections: [sec(-750, 250, -250, 250), sec(250, 750, -250, 250)] }))
    expect(s).toHaveLength(4)
    expect(s.some((x) => x.open)).toBe(false)
    expect(s.map(len).sort((a, b) => a - b)).toEqual([520, 520, 1520, 1520])
  })

  it('an L of three sections: six closed sides', () => {
    const s = counterOutline(place, at({ product: '6571', sections: [sec(-750, -250, -750, -250), sec(-250, 750, -750, -250), sec(-750, -250, -250, 750)] }))
    expect(s).toHaveLength(6)
    expect(s.some((x) => x.open)).toBe(false)
  })
})
