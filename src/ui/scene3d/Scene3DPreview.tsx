// Read-only 3D thumbnail: the plan view's mini map, the counterpart of the plan mini map in the 3D view.
// No controls, no shadows and no labels, seen from the 3D view's home angle. The scene is rebuilt at most a few
// times a second, so drawing or dragging in the plan stays smooth.
import { useEffect, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import type { CalcResult } from '../../calc/calc'
import type { Variant } from '../../domain/types'
import type { Motif } from '../../persistence/file'
import { build, dispose } from './build'
import { HOME, setCamera } from './camera'
import { addLights } from './lights'
import { fitToElement, newRenderer, swapContent } from './view'

/** Least time between two rebuilds, ms. */
const THROTTLE = 200

export function Scene3DPreview({ v, res, motifs }: { v: Variant; res: CalcResult; motifs: Motif[] }) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; content: THREE.Group | null } | null>(
    null,
  )
  const props = useRef({ v, res, motifs })
  useLayoutEffect(() => {
    props.current = { v, res, motifs }
  })

  useEffect(() => {
    const el = host.current!
    const renderer = newRenderer({ shadows: false })
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200)
    // No shadows in the thumbnail, the sun fixed
    addLights(scene, false).position.set(-2, 9, 6)
    view.current = { renderer, scene, camera, content: null }
    const unfit = fitToElement(el, renderer, camera, () => renderer.render(scene, camera))
    return () => {
      unfit()
      const cur = view.current
      if (cur?.content) dispose(cur.content)
      renderer.dispose()
      el.removeChild(renderer.domElement)
      view.current = null
    }
  }, [])

  // Content: rebuilt from the model, throttled
  const last = useRef(0)
  useEffect(() => {
    const draw = () => {
      const cur = view.current
      if (!cur) return
      last.current = performance.now()
      const p = props.current
      const onLoad = () => view.current === cur && cur.renderer.render(cur.scene, cur.camera)
      const g = build(p.v, p.res, { motifs: p.motifs, onLoad })
      const { width: W, depth: D } = p.v.stand
      setCamera(cur.camera, W, D, HOME)
      cur.content = swapContent(cur.scene, cur.content, g, () => cur.renderer.render(cur.scene, cur.camera))
    }
    const wait = THROTTLE - (performance.now() - last.current)
    if (wait <= 0) {
      draw()
      return
    }
    const t = setTimeout(draw, wait)
    return () => clearTimeout(t)
  }, [v, res, motifs])

  return <div ref={host} className="scene3d-canvas" />
}
