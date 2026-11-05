// What the three 3D pictures share: the 3D view, its mini map in the plan and the picture on the quote.
import * as THREE from 'three'
import { dispose } from './build'

/** A WebGL renderer as the 3D pictures set it up. Shadows only where the picture shows them (not the mini map). */
export function newRenderer({ shadows, pixelRatio, preserve }: { shadows: boolean; pixelRatio?: number; preserve?: boolean }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, ...(preserve ? { preserveDrawingBuffer: true } : {}) })
  renderer.setPixelRatio(pixelRatio ?? Math.min(2, window.devicePixelRatio))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  if (shadows) {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
  }
  return renderer
}

/** Keep the renderer and camera at the element's size, drawing again on each change. Returns the clean-up. */
export function fitToElement(el: HTMLElement, renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, render: () => void) {
  const resize = () => {
    const w = el.clientWidth
    const h = el.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    render()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(el)
  resize()
  return () => ro.disconnect()
}

/**
 * Put a newly built scene in place of the old one. The new one is drawn before the old one is freed: freeing first
 * lets three.js drop the shader programs and motif textures both share, and then compile and upload them all again,
 * on every edit while dragging.
 */
export function swapContent(scene: THREE.Scene, old: THREE.Group | null, next: THREE.Group, render: () => void): THREE.Group {
  if (old) scene.remove(old)
  scene.add(next)
  render()
  if (old) dispose(old)
  return next
}
