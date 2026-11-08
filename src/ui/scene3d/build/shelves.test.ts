// Shelves in 3D (Byggeregler H1–H3): a board per shelf and a bracket per post, end (91F) or twin (91FF), where the
// board lies on the flange. Row stand 6 × 3 (centred on the origin): the back wall at z = −1,5, its face toward +z.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { calc } from '../../../calc/calc'
import { addShelfRow } from '../../../domain/shelves'
import { createVariant } from '../../../domain/variant'
import { catalog, rules } from '../../env'
import { build, type Tag } from '../build'

const v = addShelfRow(createVariant('A', { width: 6, depth: 3, type: 'row' }), rules, 'side-back', 1, 2, 1).v
const g = build(v, calc(v, rules, catalog))
g.updateMatrixWorld(true)
const all: THREE.Mesh[] = []
g.traverse((o) => {
  if ((o.userData as Partial<Tag>).layer) all.push(o as THREE.Mesh)
})
const box = (m: THREE.Object3D) => new THREE.Box3().setFromObject(m)
const named = (n: string) => all.filter((m) => m.geometry?.name === n)
const r = (n: number) => Math.round(n * 1000)

describe('shelves in 3D', () => {
  it('a board per shelf, its top at the shelf height, from the rails out 300 mm, pickable as the shelf', () => {
    const boards = all.filter((m) => (m.userData as Tag).pick?.shelfId)
    expect(boards).toHaveLength(2)
    const b = box(boards[0])
    expect(r(b.max.y)).toBe(1500)
    expect(r(b.max.y - b.min.y)).toBe(18)
    expect([r(b.min.z + 1.5), r(b.max.z + 1.5)]).toEqual([10, 310])
    expect(r(b.max.x - b.min.x)).toBe(976)
  })

  it('two shelves side by side: a 91F at each end and one 91FF between them', () => {
    expect(named('foga-91F')).toHaveLength(2)
    expect(named('foga-91FF')).toHaveLength(1)
  })

  it('the brackets stand out 290 mm from the post face, under the board, with the end flanges turned away from the board', () => {
    for (const m of [...named('foga-91F'), ...named('foga-91FF')]) {
      const b = box(m)
      expect([r(b.min.z + 1.5), r(b.max.z + 1.5)]).toEqual([20, 310])
      // 30 high, the board's underside on its flange 10,5 over its bottom: the bracket's top 1,5 over the board's top
      expect([Math.round(b.min.y * 10000), Math.round(b.max.y * 10000)]).toEqual([14715, 15015])
    }
    // The end brackets at x = 1 and 3 (−2 and 0 in the world) turn their flanges away from the boards (mirrored, Bjørn 8.11.2026): the body on the post
    const left = named('foga-91F').map(box).find((b) => b.min.x < -1.9)!
    expect([r(left.min.x + 2), r(left.max.x + 2)]).toEqual([-25, 10])
    const right = named('foga-91F').map(box).find((b) => b.min.x > -0.1)!
    expect([r(right.min.x), r(right.max.x)]).toEqual([-10, 25])
  })
})
