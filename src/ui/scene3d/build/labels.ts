// Flat text on the floor: the stand's width and depth along the front and right edge.
import * as THREE from 'three'
import type { Variant } from '../../../domain/types'
import { INK } from './context'

/** Dimension lines along the front and right edge, lying on the floor. */
export function labels(root: THREE.Group, v: Variant) {
  const { width: W, depth: D } = v.stand
  const lines: number[] = []
  const o = 0.55
  const tick = 0.12
  // front: x from -W/2 to W/2 at z = D/2 + o
  lines.push(-W / 2, 0.004, D / 2 + o, W / 2, 0.004, D / 2 + o)
  lines.push(-W / 2, 0.004, D / 2 + o - tick, -W / 2, 0.004, D / 2 + o + tick, W / 2, 0.004, D / 2 + o - tick, W / 2, 0.004, D / 2 + o + tick)
  // right: z from -D/2 to D/2 at x = W/2 + o
  lines.push(W / 2 + o, 0.004, -D / 2, W / 2 + o, 0.004, D / 2)
  lines.push(W / 2 + o - tick, 0.004, -D / 2, W / 2 + o + tick, 0.004, -D / 2, W / 2 + o - tick, 0.004, D / 2, W / 2 + o + tick, 0.004, D / 2)
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
  root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.45 })))
  const mm = (m: number) => String(Math.round(m * 1000)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  root.add(flatText(mm(W), 0, D / 2 + o + 0.28, 0, 0.26, 0.55))
  root.add(flatText(mm(D), W / 2 + o + 0.28, 0, Math.PI / 2, 0.26, 0.55))
}

function flatText(text: string, x: number, z: number, rot: number, size: number, alpha: number): THREE.Mesh {
  const px = 128
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  const font = `500 ${px}px "JetBrains Mono", ui-monospace, monospace`
  ctx.font = font
  const w = Math.ceil(ctx.measureText(text).width) + 16
  c.width = w
  c.height = px * 1.3
  ctx.font = font
  ctx.fillStyle = INK
  ctx.globalAlpha = alpha
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 8, c.height / 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const h = size
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry((h * c.width) / c.height, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }))
  mesh.rotation.x = -Math.PI / 2
  mesh.rotation.z = rot
  mesh.position.set(x, 0.006, z)
  mesh.userData = { label: true }
  return mesh
}
