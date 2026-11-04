// Light of the 3D scenes: a sky light and a sun, shared by the 3D view, its thumbnail in the plan and the picture on
// the quote, so they look alike. The sun casts soft shadows where the scene wants them (not in the thumbnail).
import * as THREE from 'three'

/** Adds the sky light and the sun to `scene`; returns the sun. */
export function addLights(scene: THREE.Scene, shadows: boolean): THREE.DirectionalLight {
  scene.add(new THREE.HemisphereLight('#ffffff', '#d6d2c8', 1.9))
  const sun = new THREE.DirectionalLight('#ffffff', 1.5)
  if (shadows) {
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0004
    sun.shadow.radius = 4
  }
  scene.add(sun, sun.target)
  return sun
}

/** The sun over the front left of a W × D stand, its shadow camera covering the stand. */
export function aimSun(sun: THREE.DirectionalLight, W: number, D: number) {
  const r = Math.max(W, D)
  sun.position.set(-W * 0.4, 9, D * 0.9 + 4)
  const sc = sun.shadow.camera
  sc.left = sc.bottom = -r
  sc.right = sc.top = r
  sc.updateProjectionMatrix()
}
