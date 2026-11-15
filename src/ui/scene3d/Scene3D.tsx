// 3D view. Rebuilds the scene from the model on every change (see build.ts) and keeps only the camera.
// Velg works as in the plan: click a wall to edit it, drag furniture, drag an inner wall to move it.
// A room is moved by dragging one of its walls or its see-through roof, and resized by its grips when chosen (R5, R8).
// Textile frames and foil decals are clicked to select and dragged along their face; a frame or a motif dragged
// from Profilering is dropped on the wall face under the pointer (drop.ts). The brushes draw in the plan.
// The grips of what is chosen are the plan's, drawn on top (grips.ts) and dragged as there.
// What the pointer hits and where: pointer/hits.ts; what a press drags: pointer/drag.ts.
import { useFine } from '../fine'
import { House, RotateCcw, RotateCw, ScanEye } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CalcResult } from '../../calc/calc'
import { IconButton } from '../controls'
import type { Highlight } from '../tools'
import { type PlanSelection } from '../plan/selection'
import { build, dispose } from './build'
import { AISLE, CAMERA_Y, HOME, setCamera, type Angle } from './camera'
import { listenForDrops } from './drop'
import { addLights, aimSun } from './lights'
import { dimExcept } from './overlays'
import { CLICK_PX, endDrag, hoverCursor, moveDrag, startDrag, type Drag, type PointerProps } from './pointer/drag'
import { sceneHits, type Hit } from './pointer/hits'
import { dropGrips, gripAtScreen, gripSprites, sceneGrips, type SceneGrip } from './grips'
import { gripHint } from '../plan/grips'
import { fitToElement, newRenderer, swapContent } from './view'

interface Props extends Omit<PointerProps, 'fine'> {
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
  // «Fin» (ui/fine.tsx) for the drags, as Shift
  const { fine } = useFine()
  const props = useRef<PointerProps>({ ...p, fine })
  /** Draws the grips of what is chosen again (set up with the view). */
  const redrawGrips = useRef(() => {})
  useLayoutEffect(() => {
    props.current = { ...p, fine }
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
    // The grips of what is chosen (scene3d/grips.ts), redrawn when the sketch, the choice or the hot one changes (they
    // keep their size on screen as the camera moves)
    let gripGroup: THREE.Group | null = null
    let hot: SceneGrip | null = null
    const drawGrips = () => {
      dropGrips(scene, gripGroup)
      gripGroup = null
      const P = props.current
      const list = drag?.kind === 'grip' && drag.moved ? [] : sceneGrips(P.v, P.selection)
      if (list.length) {
        gripGroup = gripSprites(P.v, list, camera, renderer.domElement.clientHeight, hot)
        scene.add(gripGroup)
      }
    }
    redrawGrips.current = () => {
      drawGrips()
      v.render()
    }
    const gripAt = (e: PointerEvent) => gripAtScreen(props.current.v, sceneGrips(props.current.v, props.current.selection), camera, renderer.domElement, e)

    // Pointer: runs in the capture phase so a drag on furniture or a wall can switch off orbiting first.
    let drag: Drag | null = null
    let down: { x: number; y: number; hit: Hit | null } | null = null
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const hit = hits.pick(e)
      down = { x: e.clientX, y: e.clientY, hit }
      drag = startDrag(props.current, hits, hit, e, gripAt(e))
      if (drag.kind !== 'orbit') {
        controls.enabled = false
        renderer.domElement.setPointerCapture(e.pointerId)
      }
    }
    const onMove = (e: PointerEvent) => {
      if (!drag) {
        const g = gripAt(e)
        if (!!g !== !!hot || (g && hot && (g.at[0] !== hot.at[0] || g.at[1] !== hot.at[1]))) {
          hot = g
          redrawGrips.current()
        }
        if (g) {
          renderer.domElement.style.cursor = 'grab'
          renderer.domElement.title = gripHint(g.on, props.current.v)
          return
        }
        renderer.domElement.title = ''
        renderer.domElement.style.cursor = hoverCursor(props.current.v, hits.pick(e))
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
      if (d?.kind === 'grip') redrawGrips.current()
    }

    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    const unlisten = listenForDrops(el, scene, hits, () => props.current, v.render)
    return () => {
      dropGrips(scene, gripGroup)
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      unlisten()
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
    redrawGrips.current()
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
