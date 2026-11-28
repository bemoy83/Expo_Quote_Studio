// What is built, placed (calc/built.ts): made once by the calc and read by 3D (Bjørn 28.11.2026).
import { describe, expect, it } from 'vitest'
import { paintWalls } from '../domain/edit'
import { setWallRaise } from '../domain/raise'
import { createVariant } from '../domain/variant'
import { builtModules } from '../domain/walls'
import { wallHeight } from '../rules/rules'
import { catalog, rules } from '../ui/env'
import { calc } from './calc'

const v = paintWalls(createVariant('A', { width: 6, depth: 4, type: 'row' }), [3, 1], [3, 3])
const id = v.walls.find((w) => !w.id.startsWith('side'))!.id
const H = wallHeight(rules)

describe('built', () => {
  it('holds every module as laid out, the stand walls too', () => {
    expect(calc(v, rules, catalog).built.mods).toEqual(builtModules(v))
  })

  it('gives each wall its top and the highest thing built', () => {
    const b = calc(v, rules, catalog).built
    expect(b.wallTop.get(id)).toBeCloseTo(H)
    expect(b.top).toBeCloseTo(H)
    const up = calc(setWallRaise(v, id, 500), rules, catalog).built
    expect(up.wallTop.get(id)).toBeCloseTo(H + 0.5)
    expect(up.wallTop.get('side-back')).toBeCloseTo(H)
    expect(up.top).toBeCloseTo(H + 0.5)
    // The 94 joined on top of each of its posts
    expect([...up.raisedPosts.values()].map((p) => p.len)).toEqual([500, 500, 500])
  })
})
