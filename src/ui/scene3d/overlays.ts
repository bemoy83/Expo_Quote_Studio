// What the 3D view draws over the built scene: where a drop from Profilering lands, the lit top edge of a room side
// that resizes the room, and the fading of everything outside the hovered calc group.
import * as THREE from 'three'
import { faceNormal, type FaceSide } from '../../domain/faces'
import { pointAlong, wallDirection } from '../../domain/grid'
import type { Point, Wall } from '../../domain/types'
import type { Highlight } from '../tools'
import { dispose, type Tag } from './build'

/** One mesh shown over the scene, kept while its key is the same. */
export interface Overlay {
  key: string
  mesh: THREE.Mesh
}

/** Show `make()` under `key` in place of `cur`, unless `cur` already shows that key. Returns what is shown. */
export function showOverlay(scene: THREE.Scene, cur: Overlay | null, key: string, make: () => THREE.Mesh | null, render: () => void): Overlay | null {
  if (cur?.key === key) return cur
  clearOverlay(scene, cur, render)
  const mesh = make()
  if (!mesh) return null
  scene.add(mesh)
  render()
  return { key, mesh }
}

export function clearOverlay(scene: THREE.Scene, cur: Overlay | null, render: () => void): null {
  if (!cur) return null
  scene.remove(cur.mesh)
  dispose(cur.mesh)
  render()
  return null
}

/** A see-through box on a wall face showing where a drop lands: blue when it can, red when it cannot. */
export function previewMesh(stand: { width: number; depth: number }, w: Wall, s: FaceSide, b: { from: number; to: number; y0: number; y1: number }, off: number, ok: boolean) {
  const n = faceNormal(w, s)
  const [dx, dy] = wallDirection(w)
  const a = pointAlong(w, (b.from + b.to) / 2)
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(b.to - b.from - 0.02, b.y1 - b.y0, 0.01),
    new THREE.MeshBasicMaterial({ color: ok ? '#6aaecb' : '#d24b3f', transparent: true, opacity: 0.4, depthWrite: false }),
  )
  mesh.position.set(a[0] + n[0] * off - stand.width / 2, (b.y0 + b.y1) / 2, a[1] + n[1] * off - stand.depth / 2)
  mesh.rotation.y = Math.atan2(-dy, dx)
  mesh.renderOrder = 10
  return mesh
}

/** A lit strip along the top of a room side: shown while the pointer is over the part that resizes the room. */
export function gripMesh(stand: { width: number; depth: number }, [a, b]: [Point, Point], H: number) {
  const len = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(len + 0.04, 0.035, 0.07),
    new THREE.MeshBasicMaterial({ color: '#6aaecb', transparent: true, opacity: 0.9, depthTest: false }),
  )
  mesh.position.set((a[0] + b[0]) / 2 - stand.width / 2, H + 0.018, (a[1] + b[1]) / 2 - stand.depth / 2)
  mesh.rotation.y = a[1] === b[1] ? 0 : Math.PI / 2
  mesh.renderOrder = 11
  return mesh
}

/** Fade everything outside the hovered calc group. */
export function dimExcept(root: THREE.Object3D, keep: Exclude<Highlight, null>) {
  const seen = new Set<THREE.Material>()
  root.traverse((o) => {
    const t = o.userData as Partial<Tag>
    if (!t.layer || t.layer === keep) return
    const m = (o as THREE.Mesh).material
    for (const x of Array.isArray(m) ? m : m ? [m] : []) {
      if (seen.has(x)) continue
      seen.add(x)
      x.transparent = true
      x.opacity = 0.18
      x.depthWrite = false
    }
    o.castShadow = false
  })
}
