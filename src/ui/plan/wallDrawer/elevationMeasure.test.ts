import { describe, expect, it } from 'vitest'
import { createVariant } from '../../../domain/variant'
import { isStandWall } from '../../../domain/walls'
import { RULES } from '../../../rules/rules'
import { framePiece } from '../../../calc/textile/inFrame'
import { textileNote } from '../../textileNote'
import { elevationItems, leaders, lysmal, row, shelfChains, textileLabel } from './elevationMeasure'
import { elevationHeading } from './face'

describe('wall drawing dimensions', () => {
  it('lysmål: 960 per plate between the posts, 2 420 high, 80 and 2 500 over the floor', () => {
    const r = (n: number) => Math.round(n * 1000)
    const { along, heights } = lysmal(RULES, [0, 1, 3], 2.54)
    expect(along.map(r)).toEqual([20, 980, 1020, 1980, 3020, 3980])
    expect(heights.map((h) => r(2.54 - h))).toEqual([2500, 80, 0])
  })

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

  it('a spliced frame is drawn as built: braces, the splice, moved in a corner (X10), and named in the leader', () => {
    const p = { ...framePiece(6000, RULES.textile.inFrame), shift: 40 }
    const [t] = elevationItems(RULES, [{ id: 't1', wallId: 'w', side: 1, from: 1, width: 6 }], [], new Set(), (x) => x, () => p)
    const r = (n: number) => Math.round(n * 1000)
    expect(r(t.x0)).toBe(1055)
    // Between the uprights: none more than 2 000 apart, 150 each side of the splice
    expect(t.uprights!.map((x) => r(x - t.x0))).toEqual([0, 1418, 2835, 3135, 4553, 5970])
    expect(textileLabel(p)).toBe('Tekstil 5\u00a0970 × 2\u00a0540')
  })

  it('the note on a textile: a print without motif, the customer\'s own, never on white or a chosen motif', () => {
    expect(textileNote('print', false)?.text).toBe('Husk valg av motiv')
    expect(textileNote('reuse', false)?.text).toBe('Kundens egen duk')
    expect(textileNote('white', false)).toBeNull()
    expect(textileNote('print', true)).toBeNull()
  })
})

describe('shelves on the wall drawing (Byggeregler H4, H5)', () => {
  it('a felt reads from the floor to the lowest board, then the lysmål up to each board over it', () => {
    const f = (id: string, y: number) => ({ id, wallId: 'w', module: 2, y })
    const [c] = shelfChains(RULES, [[f('h1', 1), f('h2', 1.5)]], (t) => t)
    expect(c).toMatchObject({ x0: 2, x1: 3 })
    // 1 000 from the floor, 482 clear under the upper board (1 500 − 18 − 1 000)
    expect(c.ts.map((t) => Math.round(t * 1000))).toEqual([0, 1000, 1482, 1500])
  })

  it('seen from the other face the felt runs the other way', () => {
    const [c] = shelfChains(RULES, [[{ id: 'h1', wallId: 'w', module: 0, y: 1.5 }]], (t) => 6 - t)
    expect(c).toMatchObject({ x0: 5, x1: 6 })
  })
})
