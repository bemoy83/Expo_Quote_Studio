// Furniture: top, pole and foot from the footprint. A counter is built of its Foga profiles (counter.ts).
import * as THREE from 'three'
import { FURNITURE_WHITE } from '../../../catalog/defaultCatalog'
import { conflicts } from '../../../domain/objects'
import { idx, place } from '../../env'
import { CHROME, CONFLICT, NO_COLOR, SELECT, type BuildContext, type Tag } from './context'
import { buildCounter } from './counter'

export function buildObjects(c: BuildContext) {
  const { v, root, at, mat, add, sel } = c
  // Furniture: top, pole and foot from the footprint
  const bad = conflicts(v, place)
  for (const o of v.objects) {
    const r = idx.byArtnr.get(o.product)
    const f = r?.product.footprint
    if (!f) continue
    const color = r.variant.color ?? NO_COLOR
    const tag: Tag = { layer: 'objects', pick: { objectId: o.id } }
    const warn = bad.has(o.id) ? { emissive: CONFLICT, emissiveIntensity: 0.6 } : sel.objectId === o.id ? { emissive: SELECT, emissiveIntensity: 0.5 } : {}
    const g = new THREE.Group()
    g.position.copy(at([o.x, o.y]))
    g.rotation.y = (-o.rot * Math.PI) / 180
    root.add(g)
    const counter = r.product.counter
    if (counter) {
      buildCounter(c, g, counter, tag, warn)
      continue
    }
    const body = mat('objects', color, { roughness: 0.6, ...warn })
    const metal = mat('objects', CHROME, { metalness: 0.6, roughness: 0.35, ...warn })
    const top = 0.03
    const topGeo = f.round ? new THREE.CylinderGeometry(f.w / 2, f.w / 2, top, 40) : new THREE.BoxGeometry(f.w, top, f.d)
    const topMesh = new THREE.Mesh(topGeo, body)
    topMesh.position.y = f.h - top / 2
    add(topMesh, tag, g)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, f.h - top - 0.02, 16), color === FURNITURE_WHITE ? metal : body)
    pole.position.y = (f.h - top - 0.02) / 2 + 0.02
    add(pole, tag, g)
    const footR = Math.min(f.w, f.d) * 0.32
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(footR, footR, 0.02, 32), metal)
    foot.position.y = 0.01
    add(foot, tag, g)
  }
}
