// Counter 6560 in 3D (Byggeregler K2–K5): every piece where the recipe puts it, the closed faces outward and the notch
// for the top inward. Row stand 4 × 3 centred on the origin, the counter in its middle, its front toward +z.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { calc } from '../../../calc/calc'
import { createVariant } from '../../../domain/variant'
import { counterBuild } from '../../../foga/counter'
import { RECIPES } from '../../../foga/recipes'
import { catalog, rules } from '../../env'
import { build, type Tag } from '../build'

const sketch = (rot: number) => ({ ...createVariant('A', { width: 4, depth: 3, type: 'row' }), walls: [], objects: [{ id: 'i1', product: '6560', x: 2, y: 1.5, rot }] })
const meshesOf = (rot: number) => {
  const v = sketch(rot)
  const g = build(v, calc(v, rules, catalog))
  g.updateMatrixWorld(true)
  const out: THREE.Mesh[] = []
  g.traverse((o) => {
    if ((o.userData as Partial<Tag>).pick?.objectId === 'i1') out.push(o as THREE.Mesh)
  })
  return out
}
const mm = (n: number) => Math.round(n * 10000) / 10
const world = (m: THREE.Mesh) => {
  const p = m.geometry.attributes.position
  return Array.from({ length: p.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld))
}
const b = counterBuild(RECIPES.counter, 1020, 520)
const all = meshesOf(0)
const profiles = all.filter((m) => m.geometry.name.startsWith('foga-'))

describe('counter in 3D', () => {
  it('draws every profile, plate and board of the recipe, pickable as the counter', () => {
    expect(profiles).toHaveLength(b.profiles.length)
    expect(all).toHaveLength(b.profiles.length + b.plates.length + b.boards.length)
    const size = new THREE.Box3()
    for (const m of all) size.expandByObject(m)
    expect([size.min.x, size.max.x, size.min.y, size.max.y, size.min.z, size.max.z].map(mm)).toEqual([-510, 510, 0, 1040, -260, 260])
  })

  it('puts each profile in its box', () => {
    const boxes = profiles.map((m) => new THREE.Box3().setFromObject(m)).map((x) => [x.min.x, x.max.x, x.min.y, x.max.y, x.min.z, x.max.z].map(mm).join(' '))
    expect(boxes.sort()).toEqual(b.profiles.map((x) => [...x.box.x, ...x.box.y, ...x.box.z].join(' ')).sort())
  })

  it('turns the 92L with its closed faces out (K2)', () => {
    const post = profiles.find((m) => m.geometry.name.startsWith('foga-92L') && mm(new THREE.Box3().setFromObject(m).min.x) === -510 && mm(new THREE.Box3().setFromObject(m).max.z) === 260)!
    const pts = world(post)
    // The outer faces have no channel: only their two edges
    expect([...new Set(pts.filter((p) => mm(p.x) === -510).map((p) => mm(p.z)))].sort()).toEqual([230, 260])
    expect([...new Set(pts.filter((p) => mm(p.z) === 260).map((p) => mm(p.x)))].sort((a, c) => a - c)).toEqual([-510, -480])
  })

  it('turns the top 93 with its notch at the inner top, where the top lies (K3, K5)', () => {
    const rail = profiles.find((m) => m.geometry.name.startsWith('foga-93') && mm(new THREE.Box3().setFromObject(m).min.y) === 1000 && mm(new THREE.Box3().setFromObject(m).max.z) === 260)!
    const inner = world(rail).filter((p) => mm(p.z) === 230)
    expect(Math.max(...inner.map((p) => mm(p.y)))).toBe(1030)
    expect(Math.min(...inner.map((p) => mm(p.y)))).toBe(1010)
  })

  it('turns with the object: a quarter turn puts the front toward −x', () => {
    const size = new THREE.Box3()
    for (const m of meshesOf(90)) size.expandByObject(m)
    expect([size.min.x, size.max.x, size.min.z, size.max.z].map(mm)).toEqual([-260, 260, -510, 510])
  })
})
