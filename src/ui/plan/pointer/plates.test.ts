import { describe, expect, it } from 'vitest'
import { plateColours } from '../../../domain/plateDecor'
import { paintWalls } from '../../../domain/edit'
import { wallModules } from '../../../domain/grid'
import type { Variant } from '../../../domain/types'
import { createVariant } from '../../../domain/variant'
import { builtModules } from '../../../domain/walls'
import { faceAt, sideOf } from '../../../domain/faces'
import { printPlate } from '../../../domain/print'
import { RULES } from '../../../rules/rules'
import { paintPlates, plateAt, platesAlong } from './plates'

// 6 × 4 row stand with an inner wall from (2, 1) to (2, 4): stand walls back (y 0) and both sides
const base = (): Variant => paintWalls(createVariant('A', { width: 6, depth: 4, type: 'row' }), [2, 1], [2, 4])
const inner = (v: Variant) => v.walls.find((w) => w.from[0] === 2 && w.to[0] === 2)!

describe('the wall pen on walls that stand', () => {
  it('a press on the middle of a plate takes that plate; near a grid node or on an empty edge it draws', () => {
    const v = base()
    const mods = builtModules(v)
    expect(plateAt(mods, { x: 2.03, y: 1.5 })?.wallId).toBe(inner(v).id)
    expect(plateAt(mods, { x: 2, y: 2.05 })).toBeNull()
    expect(plateAt(mods, { x: 4, y: 2.5 })).toBeNull()
  })

  it('a drag colours the plates it passes along the same wall', () => {
    const v = base()
    const mods = builtModules(v)
    const w = inner(v)
    const keys = platesAlong(v, mods, w.id, 0, { x: 2.5, y: 3.6 })
    expect(keys).toEqual(wallModules(w).map((m) => m.key))
  })

  it('colours plates in the pen colour, and takes the colour off where it is the wall own', () => {
    const v = base()
    const w = inner(v)
    const key = wallModules(w)[1].key
    const at = { x: 2.1, y: 2.5 }
    const red = paintPlates(v, w.id, at, [key], '3020')
    expect(plateColours(red)[key]).toBe('3020')
    const back = paintPlates(red, w.id, at, [key], v.defaultPlate)
    expect(plateColours(back)[key]).toBeUndefined()
  })

  it('the last stroke wins: a printed plate coloured with the pen loses its print on the face pressed, not on the other', () => {
    let v = base()
    const w = inner(v)
    const key = wallModules(w)[1].key
    const right = faceAt(v, w, { x: 2.1, y: 2.5 })
    v = printPlate(printPlate(v, RULES, w.id, 1, right, 'logo'), RULES, w.id, 1, right === 1 ? -1 : 1, 'logo')
    const x = paintPlates(v, w.id, { x: 2.1, y: 2.5 }, [key], '3020')
    expect(x.foils.map((f) => sideOf(x, f))).toEqual([right === 1 ? -1 : 1])
    expect(plateColours(x)[key]).toBe('3020')
  })
})
