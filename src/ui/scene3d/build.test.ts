import type * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { calc } from '../../calc/calc'
import { r2 } from '../../calc/referenceStands'
import { setOpeningProduct } from '../../domain/doors'
import { addObject } from '../../domain/objects'
import { fillFloor } from '../../domain/variant'
import { builtModules } from '../../domain/walls'
import { catalog, place, rules } from '../env'
import { build, type Tag } from './build'

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
    const posts = all.filter((o) => (o as THREE.Mesh).geometry?.name === 'foga-94')
    expect(posts).toHaveLength(res.posts.length)
    // An adjustable foot (pad with its hex, and the screw) under every post that does not stand on a foot plate
    const named = (n: string) => all.filter((o) => (o as THREE.Mesh).geometry?.name === n)
    expect(named('foot-pad')).toHaveLength(res.posts.length - res.wallSupports.length)
    expect(named('foot-screw')).toHaveLength(res.posts.length - res.wallSupports.length)
    // ...and a 795 pin from every foot plate up into its post
    expect(named('foot-pin')).toHaveLength(res.wallSupports.length)
    const beams = layer('beams').filter((o) => (o as THREE.Mesh).geometry?.name === 'foga-292')
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

  it('a 43TX frame (four profiles, one textile out from the wall, a 90 per brace) per textile wall, and floor tiles are instanced per product, carpet tiles over a joint bed', () => {
    const textile = layer('textile')
    const braces = res.production.pieces.reduce((a, p) => a + (p.braces?.qty ?? 0), 0)
    expect(textile).toHaveLength(5 * v.textiles.length + braces)
    expect(textile.filter((o) => (o as THREE.Mesh).geometry?.name === 'foga-90')).toHaveLength(braces)
    expect(textile.filter((o) => (o as THREE.Mesh).geometry.type === 'PlaneGeometry')).toHaveLength(v.textiles.length)
    const inst = layer('floor').filter((o) => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[]
    // Carpet tiles: the tiles over a bed in the joint shade
    expect(inst).toHaveLength(2)
    expect(inst.map((m) => m.count)).toEqual([v.floor.tiles.length, v.floor.tiles.length])
  })

  it('the door leaf is a 292 frame with one plate, two hinges and the lock on both faces; the header has 91 at the bottom, 92 over a curtain (D2, D5)', () => {
    const named = (list: THREE.Object3D[], n: string) => list.filter((o) => (o as THREE.Mesh).geometry?.name === n)
    const door = layer('openings')
    expect(v.openings).toHaveLength(1)
    expect(named(door, 'foga-292')).toHaveLength(4)
    expect(named(door, 'door-hinge')).toHaveLength(2)
    expect(named(door, 'lock-knob')).toHaveLength(2)
    expect(named(door, 'lock-rosette')).toHaveLength(2)
    const mods = builtModules(v).length
    expect(named(all, 'foga-91-flip')).toHaveLength(mods)
    expect(named(all, 'foga-92')).toHaveLength(mods)
    // A curtain instead: no leaf, and the header's bottom rail is a 92 for the glider
    const cv = setOpeningProduct(v, v.openings[0].id, '6131')
    const c = meshes(build(cv, calc(cv, rules, catalog)))
    expect(named(c, 'foga-292').filter((o) => (o.userData as Tag).layer === 'openings')).toHaveLength(0)
    expect(named(c, 'foga-91-flip')).toHaveLength(mods - 1)
    expect(named(c, 'foga-92')).toHaveLength(mods + 1)
  })
})
