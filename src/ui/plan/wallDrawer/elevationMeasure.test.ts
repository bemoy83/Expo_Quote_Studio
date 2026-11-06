import { describe, expect, it } from 'vitest'
import { createVariant } from '../../../domain/variant'
import { isStandWall } from '../../../domain/walls'
import { RULES } from '../../../rules/rules'
import { elevationItems, leaders, row } from './elevationMeasure'
import { elevationHeading } from './face'

describe('wall drawing dimensions', () => {
  it('a row runs through both ends and every edge, once each', () => {
    expect(row([0, 4], [0.3, 1.7, 1.7, 4])).toEqual([0, 0.3, 1.7, 4])
  })

  it('a leader text that would run into the one before goes a line up', () => {
    const it = (x0: number, x1: number) => ({ kind: 'decal' as const, x0, x1, bottom: 1, top: 2 })
    // 1 cm per px: «Dekal» takes about 0,4 m
    expect(leaders([it(0, 0.2), it(2, 3)], 2.54, 0.01).map((l) => l.level)).toEqual([0, 0])
    expect(leaders([it(0.2, 0.4), it(0, 0.2)], 2.54, 0.01).map((l) => [l.x, l.level])).toEqual([
      [0.1, 0],
      [0.30000000000000004, 1],
    ])
  })

  it('the heading names the face and where each end points', () => {
    const v = createVariant('A', { width: 6, depth: 4, type: 'corner' })
    const left = v.walls.find((w) => isStandWall(w) && w.from[0] === 0 && w.to[0] === 0)!
    const h = elevationHeading(left, 1, 'Venstre')
    expect(h.title).toBe('Venstre · sett innenfra')
    expect([h.left, h.right].sort()).toEqual(['bakkant', 'front'])
  })

  it('a textile frame is measured at its physical width, as in production', () => {
    const [t] = elevationItems(RULES, [{ id: 't1', wallId: 'w', side: 1, from: 1, width: 4 }], [], new Set(), (x) => x)
    expect(t.x0).toBeCloseTo(1.015)
    expect(t.x1 - t.x0).toBeCloseTo(3.97)
  })
})
