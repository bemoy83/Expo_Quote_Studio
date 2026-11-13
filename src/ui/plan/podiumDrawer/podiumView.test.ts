// What the drawer for a counter of Disker og podier shows: its sides round it and one seen from outside.
import { describe, expect, it } from 'vitest'
import { setLight, podiumParts } from '../../../domain/podiumFaces'
import type { CounterSection, PlacedObject } from '../../../domain/types'
import { chosenSide, drawerSides, nearestSide, sideElevation } from './podiumView'

const sec = (x0: number, x1: number, z0: number, z1: number, h = 1000): CounterSection => ({ x: [x0, x1], z: [z0, z1], h })
const at = (sections: CounterSection[], rot = 0): PlacedObject => ({ id: 'a', product: 'P', x: 3, y: 2, rot, sections })

describe('the drawer for Disker og podier', () => {
  const two = at([sec(-750, 250, -250, 250), sec(250, 750, -250, 250)])

  it('names the sides after the stand side they face, clockwise from the front', () => {
    expect(drawerSides(two).map((s) => s.name)).toEqual(['mot front', 'mot venstre', 'mot bak', 'mot høyre'])
    // Turned a quarter clockwise, its front faces left
    expect(drawerSides({ ...two, rot: 90 }).map((s) => s.name)).toEqual(['mot front', 'mot venstre', 'mot bak', 'mot høyre'])
    expect(drawerSides({ ...two, rot: 90 })[0].side.b - drawerSides({ ...two, rot: 90 })[0].side.a).toBe(500)
    // An L: round its outline, the two sides facing the same way numbered
    const ell = at([sec(0, 1000, 0, 500), sec(0, 500, 500, 1000)])
    expect(drawerSides(ell).map((s) => s.name)).toEqual(['mot front 1', 'mot venstre', 'mot bak', 'mot høyre 1', 'mot front 2', 'mot høyre 2'])
    expect(chosenSide(drawerSides(ell))).toBe(0)
  })

  it('a click on the counter picks the side nearest it', () => {
    const sides = drawerSides(two)
    expect(nearestSide(two, [3, 2.3])).toBe(sides[0].key)
    expect(nearestSide(two, [3.8, 2])).toBe(sides[3].key)
  })

  it('a side seen from outside, left to right: its parts with their outer lengths', () => {
    const s = drawerSides(two)
    const front = sideElevation(two, s[0].side)
    expect(front.parts.map((p) => [p.x0, p.x1])).toEqual([[0, 1010], [1010, 1520]])
    expect(front.length).toBe(1520)
    // From behind, the 500 is on the left
    const back = sideElevation(two, s[2].side)
    expect(back.parts.map((p) => p.x1 - p.x0)).toEqual([510, 1010])
    const open = { ...two, sections: setLight(two.sections!, podiumParts(two.sections!).filter((p) => p.axis === 'z' && p.out === 1 && p.a === 250), 'open') }
    expect(sideElevation(open, s[0].side).parts.map((p) => p.light)).toEqual([null, 'open'])
  })
})
