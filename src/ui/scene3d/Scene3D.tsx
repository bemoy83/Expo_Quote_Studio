// 3D view. Rebuilds the scene from the model on every change (see build.ts) and keeps only the camera.
// Velg works as in the plan: click a wall to edit it, drag furniture, drag an inner wall to move it.
// The brushes draw in the plan.
import { House, RotateCcw, RotateCw, ScanEye } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CalcResult } from '../../calc/calc'
import { isPerimeterWall } from '../../domain/edit'
import { moveObject } from '../../domain/objects'
import type { Motif } from '../../persistence/file'
import type { Variant } from '../../domain/types'
import { IconButton } from '../controls'
import { dragWall, dropObject, type WallDrag } from '../drag'
import { place } from '../env'
import type { Highlight } from '../tools'
import type { PlanSelection } from '../plan/PlanView'
import { build, dispose, type Tag } from './build'

interface Props {
  v: Variant
  res: CalcResult
  highlight: Highlight
  selection: PlanSelection
  onSelect: (s: PlanSelection) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onCheckpoint: () => void
  onToast: (text: string) => void
  motifs: Motif[]
}

type Drag =
  | { kind: 'orbit' }
  | { kind: 'object'; id: string; start: { x: number; y: number }; off: { x: number; y: number }; moved: boolean }
  | ({ kind: 'wall'; moved: boolean } & WallDrag)

const deg = Math.PI / 180
const HOME = { az: 28 * deg, el: 30 * deg }
const AISLE = { az: 0, el: 16 * deg }

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
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200)
    scene.add(new THREE.HemisphereLight('#ffffff', '#d6d2c8', 1.9))
    const sun = new THREE.DirectionalLight('#ffffff', 1.5)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0004
    sun.shadow.radius = 4
    scene.add(sun, sun.target)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.minPolarAngle = 5 * deg
    controls.maxPolarAngle = 86 * deg
    controls.minDistance = 2
    controls.maxDistance = 60
    controls.zoomToCursor = true
    const v: View = { renderer, scene, camera, controls, sun, content: null, render: () => renderer.render(scene, camera) }
    view.current = v
    controls.addEventListener('change', v.render)

    const resize = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      v.render()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    // Pointer: runs in the capture phase so a drag on furniture or a wall can switch off orbiting first.
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    ray.params.Line = { threshold: 0.01 }
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const setRay = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
    }
    const pick = (e: PointerEvent): Tag['pick'] | null => {
      if (!v.content) return null
      setRay(e)
      for (const h of ray.intersectObjects(v.content.children, true)) {
        const t = h.object.userData as Partial<Tag>
        if (t.pick) return t.pick
        if (t.layer || !h.object.userData.label) return null
      }
      return null
    }
    /** Pointer on the floor plane, in model coordinates. */
    const onFloor = (e: PointerEvent) => {
      setRay(e)
      const q = new THREE.Vector3()
      if (!ray.ray.intersectPlane(floor, q)) return null
      const s = props.current.v.stand
      return { x: q.x + s.width / 2, y: q.z + s.depth / 2 }
    }
    let drag: Drag | null = null
    let down: { x: number; y: number; hit: Tag['pick'] | null } | null = null

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const hit = pick(e)
      down = { x: e.clientX, y: e.clientY, hit }
      const P = props.current
      drag = { kind: 'orbit' }
      if (hit?.objectId) {
        const o = P.v.objects.find((x) => x.id === hit.objectId)
        const q = onFloor(e)
        if (o && q) drag = { kind: 'object', id: o.id, start: { x: o.x, y: o.y }, off: { x: q.x - o.x, y: q.y - o.y }, moved: false }
      } else if (hit?.wallId) {
        const w = P.v.walls.find((x) => x.id === hit.wallId)
        const q = onFloor(e)
        if (w && q && !isPerimeterWall(P.v.stand, w)) drag = { kind: 'wall', id: w.id, p0: q, v0: P.v, delta: 0, horizontal: w.from[1] === w.to[1], moved: false }
      }
      if (drag.kind !== 'orbit') {
        controls.enabled = false
        renderer.domElement.setPointerCapture(e.pointerId)
      }
    }
    const onMove = (e: PointerEvent) => {
      const P = props.current
      if (!drag || drag.kind === 'orbit') {
        if (!drag) {
          const hit = pick(e)
          const movable = hit?.objectId || (hit?.wallId && !isPerimeterWall(P.v.stand, P.v.walls.find((x) => x.id === hit.wallId)!))
          renderer.domElement.style.cursor = movable ? 'move' : hit ? 'pointer' : 'grab'
        }
        return
      }
      const q = onFloor(e)
      if (!q || !down) return
      if (!drag.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) return
      if (drag.kind === 'object') {
        if (!drag.moved) P.onCheckpoint()
        drag.moved = true
        const d = drag
        P.onEdit((x) => moveObject(x, place, d.id, q.x - d.off.x, q.y - d.off.y), false)
      } else {
        drag.moved = true
        dragWall(drag, q, P.onEdit, P.onCheckpoint)
      }
    }
    const onUp = (e: PointerEvent) => {
      const P = props.current
      const d = drag
      drag = null
      controls.enabled = true
      if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId)
      if (!down) return
      const click = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4
      const hit = down.hit
      down = null
      if (d?.kind === 'object' && d.moved) return dropObject(P.v, d.id, d.start, P.onEdit, P.onToast)
      if (!click) return
      if (hit?.objectId) P.onSelect({ objectId: hit.objectId })
      else if (hit?.wallId) P.onSelect({ wallId: hit.wallId })
      else P.onSelect({})
    }
    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      ro.disconnect()
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
    if (v.content) {
      v.scene.remove(v.content)
      dispose(v.content)
    }
    v.content = g
    v.scene.add(g)
    v.render()
  }, [p.v, p.res, p.selection, p.highlight, p.motifs])

  // Camera and sun follow the stand size
  useEffect(() => {
    const v = view.current
    if (!v) return
    const r = Math.max(W, D)
    v.sun.position.set(-W * 0.4, 9, D * 0.9 + 4)
    const sc = v.sun.shadow.camera
    sc.left = sc.bottom = -r
    sc.right = sc.top = r
    sc.updateProjectionMatrix()
    setCamera(v, W, D, HOME)
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
        <IconButton icon={RotateCcw} label="Roter venstre" onClick={() => turn(-45)} />
        <IconButton icon={RotateCw} label="Roter høyre" onClick={() => turn(45)} />
        <IconButton icon={ScanEye} label="Sett fra gangen" onClick={() => view.current && setCamera(view.current, W, D, AISLE)} />
        <IconButton icon={House} label="Nullstill" onClick={() => view.current && setCamera(view.current, W, D, HOME)} />
      </div>
    </div>
  )
}

function setCamera(v: View, W: number, D: number, at: { az: number; el: number }) {
  const dist = Math.hypot(W, D) * 1.45 + 3
  const target = new THREE.Vector3(0, 0.9, 0)
  v.controls.target.copy(target)
  v.camera.position.set(Math.sin(at.az) * Math.cos(at.el) * dist, 0.9 + Math.sin(at.el) * dist, Math.cos(at.az) * Math.cos(at.el) * dist)
  v.controls.update()
}

/** Fade everything outside the hovered calc group. */
function dimExcept(root: THREE.Object3D, keep: Exclude<Highlight, null>) {
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
