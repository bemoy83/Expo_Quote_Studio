// 3D view. Rebuilds the scene from the model on every change (see build.ts) and keeps only the camera.
// Velg works as in the plan: click a wall to edit it, drag furniture, drag an inner wall to move it.
// A room is moved by dragging one of its walls or its see-through roof, and resized by grabbing the top of a side
// (the top GRIP metres of the wall): nothing is drawn there until the pointer is over it, then the edge lights up.
// Textile frames and foil decals are clicked to select and dragged along their face; a frame or a motif dragged
// from Profilering is dropped on the wall face under the pointer (drop.ts). The brushes draw in the plan.
// What the pointer hits and where: pointer/hits.ts; what a press drags: pointer/drag.ts.
import { House, RotateCcw, RotateCw, ScanEye } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CalcResult } from '../../calc/calc'
import { isHorizontal, outlineSide } from '../../domain/outline'
import type { Room } from '../../domain/types'
import { wallHeight } from '../../rules/rules'
import { IconButton } from '../controls'
import { rules } from '../env'
import type { Highlight } from '../tools'
import { type PlanSelection } from '../plan/selection'
import { build, dispose } from './build'
import { AISLE, CAMERA_Y, HOME, setCamera, type Angle } from './camera'
import { listenForDrops } from './drop'
import { addLights, aimSun } from './lights'
import { clearOverlay, dimExcept, gripMesh, showOverlay, type Overlay } from './overlays'
import { CLICK_PX, endDrag, hoverCursor, moveDrag, startDrag, type Drag, type PointerProps } from './pointer/drag'
import { sceneHits, type Hit } from './pointer/hits'
import { fitToElement, newRenderer, swapContent } from './view'

interface Props extends PointerProps {
  res: CalcResult
  highlight: Highlight
  selection: PlanSelection
}

const deg = Math.PI / 180

interface View {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  sun: THREE.DirectionalLight
  content: THREE.Group | null
  render: () => void
}

export function Scene3D(p: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<View | null>(null)
  const props = useRef(p)
  useLayoutEffect(() => {
    props.current = p
  })
  const { width: W, depth: D } = p.v.stand

  // Renderer, camera, light and pointer handling: set up once
  useEffect(() => {
    const el = host.current!
    const renderer = newRenderer({ shadows: true })
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200)
    const sun = addLights(scene, true)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.minPolarAngle = 5 * deg
    controls.maxPolarAngle = 86 * deg
    controls.minDistance = 2
    controls.maxDistance = 60
    controls.zoomToCursor = true
    const v: View = { renderer, scene, camera, controls, sun, content: null, render: () => renderer.render(scene, camera) }
    view.current = v
    controls.addEventListener('change', v.render)
    const unfit = fitToElement(el, renderer, camera, v.render)

    const hits = sceneHits(renderer, camera, () => v.content, () => props.current.v)
    /** The lit top edge of the room side under the pointer. */
    let grip: Overlay | null = null
    const clearGrip = () => {
      grip = clearOverlay(scene, grip, v.render)
    }
    const showGrip = (room: Room, side: number) => {
      const key = `${room.id}|${side}|${room.outline.join(' ')}`
      grip = showOverlay(scene, grip, key, () => gripMesh(props.current.v.stand, outlineSide(room.outline, side), wallHeight(rules)), v.render)
    }
    /** Resize cursor across the side as it appears on screen. */
    const resizeCursor = (room: Room, side: number) => {
      const s = props.current.v.stand
      const [a, b] = outlineSide(room.outline, side)
      const mid = new THREE.Vector3((a[0] + b[0]) / 2 - s.width / 2, wallHeight(rules), (a[1] + b[1]) / 2 - s.depth / 2)
      const n = isHorizontal([a, b]) ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
      const p0 = mid.clone().project(camera)
      const p1 = mid.clone().add(n).project(camera)
      return Math.abs(p1.x - p0.x) * camera.aspect > Math.abs(p1.y - p0.y) ? 'ew-resize' : 'ns-resize'
    }

    // Pointer: runs in the capture phase so a drag on furniture or a wall can switch off orbiting first.
    let drag: Drag | null = null
    let down: { x: number; y: number; hit: Hit | null } | null = null
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const hit = hits.pick(e)
      down = { x: e.clientX, y: e.clientY, hit }
      drag = startDrag(props.current, hits, hit, e)
      if (drag.kind !== 'orbit') {
        clearGrip()
        controls.enabled = false
        renderer.domElement.setPointerCapture(e.pointerId)
      }
    }
    const onMove = (e: PointerEvent) => {
      if (!drag) {
        const hit = hits.pick(e)
        const side = hits.sideAt(hit)
        if (side) showGrip(side.room, side.side)
        else clearGrip()
        renderer.domElement.style.cursor = hoverCursor(props.current.v, hit, side ? resizeCursor(side.room, side.side) : null)
        return
      }
      if (drag.kind === 'orbit' || !down) return
      if (!drag.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < CLICK_PX) return
      moveDrag(props.current, hits, drag, e)
    }
    const onUp = (e: PointerEvent) => {
      const d = drag
      drag = null
      controls.enabled = true
      if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId)
      if (!down) return
      const click = Math.hypot(e.clientX - down.x, e.clientY - down.y) < CLICK_PX
      const hit = down.hit
      down = null
      endDrag(props.current, hits, d, hit, click)
    }

    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    const unlisten = listenForDrops(el, scene, hits, () => props.current, v.render)
    return () => {
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      unlisten()
      clearGrip()
      unfit()
      controls.dispose()
      if (v.content) dispose(v.content)
      renderer.dispose()
      el.removeChild(renderer.domElement)
      view.current = null
    }
  }, [])

  // Content: rebuilt from the model
  useEffect(() => {
    const v = view.current
    if (!v) return
    // A motif that finishes loading after this view is gone must not render into a disposed renderer.
    const onLoad = () => view.current === v && v.render()
    const g = build(p.v, p.res, { selection: p.selection, labels: true, motifs: p.motifs, onLoad })
    if (p.highlight) dimExcept(g, p.highlight)
    v.content = swapContent(v.scene, v.content, g, v.render)
  }, [p.v, p.res, p.selection, p.highlight, p.motifs])

  // Camera and sun follow the stand size
  useEffect(() => {
    const v = view.current
    if (!v) return
    aimSun(v.sun, W, D)
    aim(v, W, D, HOME)
  }, [W, D])

  const turn = (deltaDeg: number) => {
    const v = view.current
    if (!v) return
    const off = v.camera.position.clone().sub(v.controls.target)
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), deltaDeg * deg)
    v.camera.position.copy(v.controls.target).add(off)
    v.controls.update()
  }

  return (
    <div className="scene3d">
      <div ref={host} className="scene3d-canvas" />
      <div className="scene3d-tools">
        <IconButton icon={RotateCcw} label="Roter venstre" title="Roter venstre · 45° rundt standen" onClick={() => turn(-45)} />
        <IconButton icon={RotateCw} label="Roter høyre" title="Roter høyre · 45° rundt standen" onClick={() => turn(45)} />
        <IconButton icon={ScanEye} label="Sett fra gangen" title="Sett fra gangen · slik en besøkende ser standen" onClick={() => view.current && aim(view.current, W, D, AISLE)} />
        <IconButton icon={House} label="Nullstill" title="Nullstill · tilbake til startvinkelen" onClick={() => view.current && aim(view.current, W, D, HOME)} />
      </div>
    </div>
  )
}

/** Camera and orbit controls both turned to the stand centre from the given angle. */
function aim(v: View, W: number, D: number, at: Angle) {
  setCamera(v.camera, W, D, at)
  v.controls.target.set(0, CAMERA_Y, 0)
  v.controls.update()
}
