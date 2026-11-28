// The veggriss reads the foot plates and ceiling wires from what the calc built (Byggeregler S2, S9, Bjørn 28.11.2026).
import { describe, expect, it } from 'vitest'
import { DEFAULT_CATALOG } from '../../catalog/defaultCatalog'
import { calc } from '../../calc/calc'
import { createVariant } from '../../domain/variant'
import { builtModules, wallParts } from '../../domain/walls'
import { RULES } from '../../rules/rules'
import { footPlatesAt, platedPosts, wallHeld, wiredPosts } from './raiseDrawing'
import { wallMeta } from './wallDrawer/text'

describe('foot plates and wires in the veggriss (S2, S9)', () => {
  it('S2 draws the plates the calc lays under a free-standing back wall, and the line under the title counts them', () => {
    const v = { ...createVariant('A', { width: 6.5, depth: 3, type: 'row' }), noBeams: true }
    const res = calc(v, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' })
    const w = v.walls.find((x) => x.id === 'side-back')!
    const xs = footPlatesAt(w, wallParts(w, builtModules(v)), (t) => t, platedPosts(res))
    expect(xs).toHaveLength(2)
    expect(wallHeld(w, wallParts(w, builtModules(v)), res)).toEqual({ feet: 2, wires: 0 })
    // No raised wall: no wires
    expect(wiredPosts(res).size).toBe(0)
    expect(wallMeta(v, w, { L: 6.5, openings: [], odd: 0, tex: [], rooms: [], held: { feet: xs.length, wires: 0, lift: false } })).toContain('2 fotplater')
    expect(wallMeta(v, w, { L: 6.5, openings: [], odd: 0, tex: [], rooms: [], held: { feet: 0, wires: 3, lift: true } })).toMatch(/3 vaiere · lift/)
  })
})
