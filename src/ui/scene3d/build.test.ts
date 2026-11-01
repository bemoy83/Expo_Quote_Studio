import type * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { calc } from '../../calc/calc'
import { r2 } from '../../calc/referenceStands'
import { addObject } from '../../domain/objects'
import { fillFloor } from '../../domain/variant'
import { builtModules } from '../../domain/walls'
import { catalog, place, rules } from '../env'
import { build, type Tag } from './build'

/** Size of a box mesh, or null for anything else. */
const box = (o: THREE.Object3D) => {
  const g = (o as THREE.Mesh).geometry as THREE.BoxGeometry | undefined
  return g?.type === 'BoxGeometry' ? g.parameters : null
}

const meshes = (g: THREE.Object3D) => {
  const out: THREE.Object3D[] = []
  g.traverse((o) => {
    if ((o.userData as Partial<Tag>).layer) out.push(o)
  })
  return out
}

describe('3D scene from the model', () => {
  const v = addObject(fillFloor(r2(), '5903'), place, '5276', 4, 2.7)!
  const res = calc(v, rules, catalog)
  const g = build(v, res)
  const all = meshes(g)
  const layer = (l: Tag['layer']) => all.filter((o) => (o.userData as Tag).layer === l)

  it('draws one post per calc post and one beam per beam length', () => {
    const posts = all.filter((o) => box(o)?.width === rules.wall.post)
    expect(posts).toHaveLength(res.posts.length)
    const beams = layer('beams').filter((o) => box(o)?.height === rules.beam.height)
    expect(beams).toHaveLength(res.beams.segments.length)
  })

  it('every wall module can be picked and points at its wall', () => {
    const ids = new Set(all.map((o) => (o.userData as Tag).pick?.wallId).filter(Boolean))
    expect(ids).toEqual(new Set(builtModules(v).map((m) => m.wallId)))
  })

  it('furniture is pickable by object id', () => {
    const picks = layer('objects').map((o) => (o.userData as Tag).pick?.objectId)
    expect(picks.length).toBeGreaterThan(0)
    expect(new Set(picks)).toEqual(new Set(v.objects.map((o) => o.id)))
  })

  it('one print per foil decal, on its wall', () => {
    const f = { id: 'f1', wallId: 'side-left', module: 3, side: -1 as const, full: false, width: 0.5, height: 0.2, x: 0, y: 1.5 }
    const g2 = build({ ...v, foils: [f] }, res)
    const foils = meshes(g2).filter((o) => (o.userData as Tag).layer === 'foil')
    expect(foils).toHaveLength(1)
    expect((foils[0].userData as Tag).pick?.wallId).toBe('side-left')
  })

  it('one textile box per textile wall, and floor tiles are instanced per product, carpet tiles over a joint bed', () => {
    expect(layer('textile')).toHaveLength(v.textiles.length)
    const inst = layer('floor').filter((o) => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[]
    // Carpet tiles: the tiles over a bed in the joint shade
    expect(inst).toHaveLength(2)
    expect(inst.map((m) => m.count)).toEqual([v.floor.tiles.length, v.floor.tiles.length])
  })
})
