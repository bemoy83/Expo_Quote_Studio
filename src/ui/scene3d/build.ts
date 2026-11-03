// 3D scene derived from the stand model. No state of its own: build() turns a variant (and its calc) into a
// three.js group, and the view rebuilds it whenever the model changes.
// Model → world: x → x, y (toward the aisle) → z, height → y. The stand is centred on the origin.
// Each product is a part of its own in build/ (floor, walls, frame, textile, decor, rooms, objects, labels) on a shared
// context (build/context.ts); build() runs them in the order the scene is drawn.
import * as THREE from 'three'
import type { CalcResult } from '../../calc/calc'
import type { Variant } from '../../domain/types'
import { buildContext, type BuildOptions } from './build/context'
import { buildDecor } from './build/decor'
import { buildFloor } from './build/floor'
import { buildFrame } from './build/frame'
import { labels } from './build/labels'
import { buildObjects } from './build/objects'
import { buildRooms } from './build/rooms'
import { buildTextile } from './build/textile'
import { buildWalls } from './build/walls'

export type { BuildOptions, Layer, Tag } from './build/context'

export function build(v: Variant, res: CalcResult, opts: BuildOptions = {}): THREE.Group {
  const c = buildContext(v, res, opts)
  buildFloor(c)
  buildWalls(c)
  buildFrame(c)
  buildTextile(c)
  buildDecor(c)
  buildRooms(c)
  buildObjects(c)
  if (opts.labels) labels(c.root, v)
  return c.root
}

/** Free GPU memory of a built group. */
export function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose()
    const ms = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
    for (const x of ms) {
      ;(x as THREE.MeshBasicMaterial).map?.dispose()
      x.dispose()
    }
  })
}
