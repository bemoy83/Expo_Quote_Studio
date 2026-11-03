// Ground, stand surface, floor tiles and lanes of roll, and the 1 m grid on a bare stand.
import * as THREE from 'three'
import { CELL } from '../../../domain/grid'
import type { FloorTile } from '../../../domain/types'
import { idx } from '../../env'
import { shade } from '../../colors'
import { GROUND, GROUND_MARGIN, JOINT, NO_COLOR, STAND_FLOOR, type BuildContext } from './context'

export function buildFloor(c: BuildContext) {
  const { v, W, D, root, at, mat, add } = c
  // Ground and stand surface
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * GROUND_MARGIN, D + 2 * GROUND_MARGIN), new THREE.MeshStandardMaterial({ color: GROUND, roughness: 1 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.002
  ground.receiveShadow = true
  root.add(ground)
  const base = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat('floor', STAND_FLOOR, { roughness: 1 }))
  base.rotation.x = -Math.PI / 2
  add(base, { layer: 'floor' })

  // Floor tiles, one instanced mesh per product. Carpet tiles and lanes of roll leave a joint at their edges; other
  // rolled floor (vinyl) is seamless.
  const byProduct = new Map<string, FloorTile[]>()
  for (const t of v.floor.tiles) byProduct.set(t.product, [...(byProduct.get(t.product) ?? []), t])
  const tileGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  const tmp = new THREE.Object3D()
  for (const [a, tiles] of byProduct) {
    const hit = idx.byArtnr.get(a)
    const color = hit?.variant.color ?? NO_COLOR
    // Carpet tiles: each tile a hair smaller than its place, over a slightly darker bed. A finished floor, not a drawing.
    const layers: [string, number, number][] = hit?.product.tiles || hit?.product.roll ? [[shade(color, 0.18), 0, 0.002], [color, JOINT, 0.003]] : [[color, 0, 0.003]]
    for (const [c, joint, y] of layers) {
      const inst = new THREE.InstancedMesh(tileGeo, mat('floor', c, { roughness: 1 }), tiles.length)
      tiles.forEach((t, n) => {
        tmp.position.copy(at([(t.i + t.w / 2) * CELL, (t.j + t.h / 2) * CELL], y))
        tmp.scale.set(t.w * CELL - joint, 1, t.h * CELL - joint)
        tmp.updateMatrix()
        inst.setMatrixAt(n, tmp.matrix)
      })
      inst.receiveShadow = true
      add(inst, { layer: 'floor' })
    }
  }
  // 1 m grid, faint, on a stand without floor: a laid floor shows its own joints
  const grid: number[] = []
  if (!v.floor.tiles.length) {
    for (let x = 1; x < W; x++) grid.push(x - W / 2, 0.005, -D / 2, x - W / 2, 0.005, D / 2)
    for (let y = 1; y < D; y++) grid.push(-W / 2, 0.005, y - D / 2, W / 2, 0.005, y - D / 2)
  }
  if (grid.length) {
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(grid, 3))
    add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#000', transparent: true, opacity: 0.08 })), { layer: 'floor' })
  }
}
