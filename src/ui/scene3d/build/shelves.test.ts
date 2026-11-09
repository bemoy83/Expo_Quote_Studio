// Shelves in 3D (Byggeregler H1–H3): a board per shelf and a bracket per post, end (91F) or twin (91FF), where the
// board lies on the flange. Row stand 6 × 3 (centred on the origin): the back wall at z = −1,5, its face toward +z.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { calc } from '../../../calc/calc'
import { addShelfRow } from '../../../domain/shelves/edit'
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
    const boards = all.filter((m) => (m.userData as Tag).pick?.shelfId && m.visible)
    expect(boards).toHaveLength(2)
    // Each with an unseen grip, 100 mm tall around it, pickable as the shelf
    const grips = named('shelf-grip')
    expect(grips.map((m) => [m.visible, (m.userData as Tag).pick?.shelfId])).toEqual([[false, 'h1'], [false, 'h2']])
    expect(r(box(grips[0]).max.y - box(grips[0]).min.y)).toBe(100)
    const b = box(boards[0])
    expect(r(b.max.y)).toBe(1300)
    expect(r(b.max.y - b.min.y)).toBe(18)
    expect([r(b.min.z + 1.5), r(b.max.z + 1.5)]).toEqual([10, 310])
    expect(r(b.max.x - b.min.x)).toBe(976)
  })

  it('two shelves side by side: a 91F at each end and one 91FF between them', () => {
    expect(named('foga-91F')).toHaveLength(2)
    expect(named('foga-91FF')).toHaveLength(1)
  })

  it('the brackets stand out 290 mm from the post face, under the board, with the flange in under the board', () => {
    for (const m of [...named('foga-91F'), ...named('foga-91FF')]) {
      const b = box(m)
      expect([r(b.min.z + 1.5), r(b.max.z + 1.5)]).toEqual([20, 310])
      // 30 high, the board's underside on its flange 10,5 over its bottom: the bracket's top 1,5 over the board's top
      expect([Math.round(b.min.y * 10000), Math.round(b.max.y * 10000)]).toEqual([12715, 13015])
    }
    // The end brackets at x = 1 and 3 (−2 and 0 in the world) have the body on the post and the flange in under the board (Bjørn 8.11.2026)
    const left = named('foga-91F').map(box).find((b) => b.min.x < -1.9)!
    expect([r(left.min.x + 2), r(left.max.x + 2)]).toEqual([-10, 25])
    const right = named('foga-91F').map(box).find((b) => b.min.x > -0.1)!
    expect([r(right.min.x), r(right.max.x)]).toEqual([-25, 10])
    // The flange is the thin part: at the end toward the board only flange points, 9–10,5 mm over the bracket's bottom
    for (const [m, toward] of named('foga-91F').map((m) => [m, box(m).min.x < -1.9 ? 1 : -1] as const)) {
      const b = box(m)
      const edge = toward > 0 ? b.max.x : b.min.x
      const p = m.geometry.attributes.position
      const v = new THREE.Vector3()
      const ys: number[] = []
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)
        if (Math.abs(v.x - edge) < 1e-4) ys.push(Math.round((v.y - b.min.y) * 10000))
      }
      expect(Math.min(...ys)).toBe(90)
      expect(Math.max(...ys)).toBe(105)
    }
  })
})
