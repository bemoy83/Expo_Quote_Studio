// Counter 6560 in 3D (Byggeregler K2–K5): every piece where the recipe puts it, the closed faces outward and the notch
// for the top inward. Row stand 4 × 3 centred on the origin, the counter in its middle, its front toward +z.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { calc } from '../../../calc/calc'
import { createVariant } from '../../../domain/variant'
import { stockCounter } from '../../../foga/counter'
import { counterBuildOf } from '../../../domain/counterShape'
import { drawCounter } from '../../../domain/counters'
import type { Variant } from '../../../domain/types'
import { catalog, isCounter, place, rules } from '../../env'
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
const b = stockCounter({ length: 1020, depth: 520 })
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

  /** The meshes of the first counter in a sketch drawn with these strokes, and that counter. */
  const drawn = (...strokes: [[number, number], [number, number]][]) => {
    let v: Variant = { ...createVariant('A', { width: 4, depth: 4, type: 'row' }), walls: [] }
    for (const [a, b] of strokes) {
      const r = drawCounter(v, place, isCounter, { product: '6560' }, a, b)
      if ('error' in r) throw new Error(r.error)
      v = r.v
    }
    const o = v.objects[0]
    const g = build(v, calc(v, rules, catalog))
    g.updateMatrixWorld(true)
    const ms: THREE.Mesh[] = []
    g.traverse((x) => {
      if ((x.userData as Partial<Tag>).pick?.objectId === o.id && (x as THREE.Mesh).geometry?.name.startsWith('foga-')) ms.push(x as THREE.Mesh)
    })
    // In the counter's own coordinates (mm): the stand is centred on the origin, the counter unturned
    const local = (m: THREE.Box3) => [m.min.x - o.x + 2, m.max.x - o.x + 2, m.min.y, m.max.y, m.min.z - o.y + 2, m.max.z - o.y + 2].map(mm)
    return { o, ms, b: counterBuildOf(o), local, at: (m: THREE.Mesh) => local(new THREE.Box3().setFromObject(m)) }
  }
  const boxes = (d: ReturnType<typeof drawn>) => ({
    drawn: d.ms.map((m) => d.at(m).join(' ')).sort(),
    built: d.b.profiles.map((p) => [...p.box.x, ...p.box.y, ...p.box.z].join(' ')).sort(),
  })

  it('draws every profile of a drawn counter in its box: 93 in the joints, 94 across between the parts (K8)', () => {
    const d = drawn([[1.5, 1.5], [3.5, 1.5]])
    expect(d.b.length).toBe(2520)
    expect(d.ms.filter((m) => m.geometry.name.startsWith('foga-94'))).toHaveLength(4)
    const { drawn: got, built } = boxes(d)
    expect(got).toEqual(built)
    expect(d.ms.every((m) => Number.isFinite(m.quaternion.x) && Number.isFinite(m.position.x))).toBe(true)
  })

  it('turns a 93 in a joint with its closed face out and its third channel in, toward the rail across', () => {
    const d = drawn([[1.5, 1.5], [2.5, 1.5]])
    const tee = d.ms.find((m) => m.geometry.name.startsWith('foga-93') && d.at(m)[3] === 1040 && d.at(m)[5] === 260)!
    const pts = (() => {
      const p = tee.geometry.attributes.position
      return Array.from({ length: p.count }, (_, i) => d.local(new THREE.Box3().setFromPoints([new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(tee.matrixWorld)])))
    })()
    const xsAt = (z: number) => [...new Set(pts.filter((p) => p[4] === z).map((p) => p[0]))].sort((a, b) => a - b)
    // The front face (z 260) is closed: only its two edges. The inner face (z 230) has the channel the rail goes in
    expect(xsAt(260)).toEqual([230, 270])
    expect(xsAt(230).length).toBeGreaterThan(2)
  })

  it('draws a drawn L the same way (Bjørn 12.11.2026)', () => {
    const d = drawn([[1.5, 1.5], [2, 1.5]], [[1.2, 1.5], [1.2, 0.5]])
    expect(d.ms).toHaveLength(d.b.profiles.length)
    const { drawn: got, built } = boxes(d)
    expect(got).toEqual(built)
  })
})
