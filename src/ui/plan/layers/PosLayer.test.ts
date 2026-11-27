// Position chips never cover each other (Bjørn 27.11.2026: a plate swap and a decal on the same wall).
import { describe, expect, it } from 'vitest'
import { planScale } from '../planScale'
import { apart } from './PosLayer'

const sc = planScale(100, { doc: true }) // 1 px = 1 cm
const chip = (label: string, at: [number, number], along?: [number, number]) => ({ label, at, layer: 'walls' as const, along })

describe('apart', () => {
  it('leaves chips that do not touch where they are', () => {
    const cs = [chip('1', [0, 0], [1, 0]), chip('2', [1, 0], [1, 0])]
    expect(apart(cs, sc).map((c) => c.at)).toEqual([[0, 0], [1, 0]])
  })

  it('slides a chip that would cover another along its wall, keeping its distance from it', () => {
    const [a, b] = apart([chip('1', [2, 0.2], [1, 0]), chip('2', [2.05, 0.2], [1, 0])], sc)
    expect(a.at).toEqual([2, 0.2])
    expect(b.at[1]).toBeCloseTo(0.2)
    expect(Math.abs(b.at[0] - a.at[0])).toBeGreaterThanOrEqual(0.13)
  })

  it('on a wall across the plan it slides up or down', () => {
    const [, b] = apart([chip('1', [0.2, 1], [0, 1]), chip('2', [0.2, 1], [0, 1])], sc)
    expect(b.at[0]).toBeCloseTo(0.2)
    expect(Math.abs(b.at[1] - 1)).toBeGreaterThanOrEqual(0.13)
  })

  it('three on one spot take free places on both sides', () => {
    const out = apart([chip('1', [0, 0], [1, 0]), chip('2', [0, 0], [1, 0]), chip('3', [0, 0], [1, 0])], sc)
    const xs = out.map((c) => Math.round(c.at[0] * 100))
    expect(new Set(xs).size).toBe(3)
  })
})
