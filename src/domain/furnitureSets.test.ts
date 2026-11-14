import { describe, expect, it } from 'vitest'
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog'
import { placeContext } from '../catalog/lookup'
import { RULES } from '../rules/rules'
import { conflicts, joinSet, loosenObject, moveObject, nearSet, placeSet, removeSet, rotateObject, setMembers, settleObject } from './objects'
import type { Variant } from './types'
import { createVariant } from './variant'

const ctx = placeContext(RULES, DEFAULT_CATALOG)
const mingle = DEFAULT_CATALOG.products.find((p) => p.id === 'sett-mingle')!
const stand = () => createVariant('A', { width: 6, depth: 4, type: 'island' })
const placed = (v = stand()) => placeSet(v, ctx, mingle.set!, 3, 2)!

describe('furniture sets (Bjørn 14.11.2026)', () => {
  it('a set is placed as its pieces sharing one set id, priced as their sum', () => {
    const v = placed()
    expect(v.objects.map((o) => o.product)).toEqual(['5276', '5186', '5186'])
    expect(new Set(v.objects.map((o) => o.set)).size).toBe(1)
    expect(v.objects.map((o) => [o.x, o.y])).toEqual([[3, 2], [2.4, 2], [3.6, 2]])
    expect(mingle.variants[0].price).toBe(500 + 2 * 350)
  })

  it('a piece drags its whole set, kept inside the stand', () => {
    const v = moveObject(placed(), ctx, placed().objects[1].id, 0, 2)
    expect(v.objects.map((o) => [o.x, o.y])).toEqual([[0.8, 2], [0.2, 2], [1.4, 2]])
  })

  it('turns round its middle, each piece with it', () => {
    const v = rotateObject(placed(), ctx, placed().objects[0].id)!
    expect(v.objects.map((o) => [o.x, o.y, o.rot])).toEqual([[3, 2, 90], [3, 1.4, 90], [3, 2.6, 90]])
  })

  it('pieces of a set never collide with each other; a set left overlapping moves as one', () => {
    let v = placed()
    expect(conflicts(v, ctx).size).toBe(0)
    v = placeSet(v, ctx, mingle.set!, 3, 2)!
    expect(conflicts(v, ctx).size).toBe(0)
    const second = v.objects[3]
    expect(setMembers(v, second)).toHaveLength(3)
    const r = settleObject(v, ctx, second.id, { x: second.x, y: second.y })
    expect(r.ok).toBe(true)
  })

  it('loosened, a piece is on its own; a set of one is none; dropped by a set it joins again', () => {
    const v = placed()
    const [, a, b] = v.objects
    const one = loosenObject(v, a.id)
    expect(one.objects.find((o) => o.id === a.id)!.set).toBeUndefined()
    expect(setMembers(one, one.objects[0])).toHaveLength(2)
    const none = loosenObject(one, b.id)
    expect(none.objects.every((o) => !o.set)).toBe(true)
    expect(nearSet(one, ctx, a.id)?.set).toBe(v.objects[0].set)
    expect(setMembers(joinSet(one, a.id, v.objects[0].id), v.objects[0])).toHaveLength(3)
    const far = moveObject(one, ctx, a.id, 5.5, 0.5)
    expect(nearSet(far, ctx, a.id)).toBeUndefined()
  })

  it('removes the whole set', () => {
    const v: Variant = removeSet(placed(), placed().objects[0].id)
    expect(v.objects).toHaveLength(0)
  })
})
