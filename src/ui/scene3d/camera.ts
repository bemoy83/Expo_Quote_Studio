// Camera angles shared by the 3D view and the plan's 3D thumbnail (Scene3DPreview), kept apart from Scene3D so the
// thumbnail does not pull in the whole view.
import type * as THREE from 'three'

const deg = Math.PI / 180

/** A camera angle: azimuth round the stand and elevation above the floor, radians. */
export interface Angle {
  az: number
  el: number
}

/** The default angle: from the front left corner, a little from above. */
export const HOME: Angle = { az: 28 * deg, el: 30 * deg }
/** Seen from the aisle in front, at about eye height. */
export const AISLE: Angle = { az: 0, el: 16 * deg }
/** Height the camera looks at, m. */
export const CAMERA_Y = 0.9

/** Points the camera at the stand centre from the given angle, far enough back to see the whole stand. */
export function setCamera(camera: THREE.PerspectiveCamera, W: number, D: number, at: Angle) {
  const dist = Math.hypot(W, D) * 1.45 + 3
  camera.position.set(Math.sin(at.az) * Math.cos(at.el) * dist, CAMERA_Y + Math.sin(at.el) * dist, Math.cos(at.az) * Math.cos(at.el) * dist)
  camera.lookAt(0, CAMERA_Y, 0)
}
