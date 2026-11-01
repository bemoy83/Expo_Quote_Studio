// 3D view. Rebuilds the scene from the model on every change (see build.ts) and keeps only the camera.
// Velg works as in the plan: click a wall to edit it, drag furniture, drag an inner wall to move it.
// A room is moved by dragging one of its walls or its see-through roof, and resized by grabbing the top of a side
// (the top GRIP metres of the wall): nothing is drawn there until the pointer is over it, then the edge lights up.
// Textile frames and foil decals are clicked to select and dragged along their face; a frame or a motif dragged
// from Profilering is dropped on the wall face under the pointer. The brushes draw in the plan.
import { House, RotateCcw, RotateCw, ScanEye } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CalcResult } from '../../calc/calc'
import { faceAt, faceNormal, faces, moveFoilBy, moveTextileBy, sideOf, textileOffset, type FaceSide } from '../../domain/decor'
import { faceOfPoint } from '../../domain/freeTextile'
import { canMoveWall } from '../../domain/edit'
import { pointAlong, wallDirection, wallLength } from '../../domain/grid'
import { moveObject } from '../../domain/objects'
import type { Motif } from '../../persistence/file'
import { roomSideAt } from '../../domain/rooms'
import { isHorizontal, outlineSide } from '../../domain/outline'
import type { Foil, Point, Room, TextileWall, Variant, Wall } from '../../domain/types'
import { wallHeight } from '../../rules/rules'
import { IconButton } from '../controls'
import { applyDrop, decorDrag, dropSpot, endDecorDrag, type DropSpot, type FaceTarget } from '../dnd'
import { dragRoom, dragWall, dropObject, dropRoom, roomDrag, type RoomDrag, type WallDrag } from '../drag'
import { place, rules } from '../env'
import { findMotif } from '../motifs'
import type { Highlight } from '../tools'
import type { PlanSelection } from '../plan/PlanView'
import { build, dispose, type Tag } from './build'
import { AISLE, CAMERA_Y, HOME, setCamera, type Angle } from './camera'

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
  /** A room: moved, or one side dragged. Tracked on a level plane at the height it was grabbed. */
  | ({ kind: 'room'; y: number } & RoomDrag)
  /** A textile or foil dragged on its face: deltas from where it was grabbed (t along the wall, h up). */
  | { kind: 'decor'; item: { textile: TextileWall } | { foil: Foil }; w: Wall; s: FaceSide; t0: number; h0: number; moved: boolean }

const deg = Math.PI / 180
/** Top part of a room wall that resizes the room instead of moving it, m. */
const GRIP = 0.2

interface View {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  sun: THREE.DirectionalLight
  content: THREE.Group | null
  /** Where a dragged frame or motif would land. */
  preview: { key: string; mesh: THREE.Mesh } | null
  /** The lit top edge of the room side under the pointer. */
  grip: { key: string; mesh: THREE.Mesh } | null
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
    const v: View = { renderer, scene, camera, controls, sun, content: null, preview: null, grip: null, render: () => renderer.render(scene, camera) }
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
    const setRay = (e: { clientX: number; clientY: number }) => {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
    }
    type Hit = NonNullable<Tag['pick']> & { point: THREE.Vector3 }
    const pick = (e: { clientX: number; clientY: number }): Hit | null => {
      if (!v.content) return null
      setRay(e)
      let roof: Hit | null = null
      for (const h of ray.intersectObjects(v.content.children, true)) {
        const t = h.object.userData as Partial<Tag>
        if (t.pick) {
          // A room roof is a handle only: furniture and decor seen through it win
          if (t.pick.roomId && !roof) {
            roof = { ...t.pick, point: h.point }
            continue
          }
          if (roof && !(t.pick.objectId || t.pick.textileId || t.pick.foilId || t.pick.freeTextileId)) return roof
          return { ...t.pick, point: h.point }
        }
        if (t.layer || !h.object.userData.label) return roof
      }
      return roof
    }
    const toModel = (q: THREE.Vector3) => {
      const s = props.current.v.stand
      return { x: q.x + s.width / 2, y: q.z + s.depth / 2 }
    }
    /** Offset along the wall of a model point, clamped to the wall. */
    const along = (w: Wall, q: { x: number; y: number }) => {
      const [dx, dy] = wallDirection(w)
      return Math.max(0, Math.min(wallLength(w), (q.x - w.from[0]) * dx + (q.y - w.from[1]) * dy))
    }
    /** The wall face under the pointer: the face of the frame or decal hit, else the side of the wall the hit is on. */
    const faceOf = (hit: Hit | null): FaceTarget | null => {
      const V = props.current.v
      const w = hit?.wallId && V.walls.find((x) => x.id === hit.wallId)
      if (!hit || !w) return null
      const q = toModel(hit.point)
      const deco = V.textiles.find((x) => x.id === hit.textileId) ?? V.foils.find((x) => x.id === hit.foilId)
      const t = along(w, q)
      if (deco) return { wallId: w.id, s: sideOf(V, deco), t, y: hit.point.y, foilId: hit.foilId }
      const n = faceNormal(w, 1)
      const raw: FaceSide = (q.x - w.from[0]) * n[0] + (q.y - w.from[1]) * n[1] >= 0 ? 1 : -1
      return { wallId: w.id, s: faceAt(V, w, q), t, y: hit.point.y, outside: !faces(V, w).includes(raw) }
    }
    /** Pointer on the vertical plane of a wall face: offset along the wall and height. */
    const onFace = (e: PointerEvent, w: Wall, s: FaceSide) => {
      setRay(e)
      const n = faceNormal(w, s)
      const W0 = props.current.v.stand
      const p0 = new THREE.Vector3(w.from[0] - W0.width / 2, 0, w.from[1] - W0.depth / 2)
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(n[0], 0, n[1]), p0)
      const q = new THREE.Vector3()
      if (!ray.ray.intersectPlane(plane, q)) return null
      const [dx, dy] = wallDirection(w)
      return { t: (q.x - p0.x) * dx + (q.z - p0.z) * dy, h: q.y }
    }
    /** Pointer on the floor plane (or a level plane at height y), in model coordinates. */
    const onFloor = (e: PointerEvent, y = 0) => {
      setRay(e)
      const q = new THREE.Vector3()
      if (!ray.ray.intersectPlane(y ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -y) : floor, q)) return null
      const s = props.current.v.stand
      return { x: q.x + s.width / 2, y: q.z + s.depth / 2 }
    }
    /** The room side whose top edge is under the pointer (a stand wall shared with the room counts too). */
    const sideAt = (hit: Hit | null): { room: Room; side: number } | undefined => {
      if (!hit?.wallId || hit.point.y < wallHeight(rules) - GRIP) return undefined
      const q = toModel(hit.point)
      return roomSideAt(props.current.v, q.x, q.y, 0.12)
    }
    const clearGrip = () => {
      if (!v.grip) return
      scene.remove(v.grip.mesh)
      dispose(v.grip.mesh)
      v.grip = null
      v.render()
    }
    const showGrip = (room: Room, side: number) => {
      const key = `${room.id}|${side}|${room.outline.join(' ')}`
      if (v.grip?.key === key) return
      clearGrip()
      const mesh = gripMesh(props.current.v.stand, outlineSide(room.outline, side), wallHeight(rules))
      scene.add(mesh)
      v.grip = { key, mesh }
      v.render()
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
    let drag: Drag | null = null
    let down: { x: number; y: number; hit: Hit | null } | null = null

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const hit = pick(e)
      down = { x: e.clientX, y: e.clientY, hit }
      const P = props.current
      drag = { kind: 'orbit' }
      const deco = hit?.textileId ? P.v.textiles.find((x) => x.id === hit.textileId) : hit?.foilId ? P.v.foils.find((x) => x.id === hit.foilId) : undefined
      const w = deco && P.v.walls.find((x) => x.id === deco.wallId)
      if (deco && w) {
        const s = sideOf(P.v, deco)
        const q = onFace(e, w, s)
        if (q) drag = { kind: 'decor', item: 'from' in deco ? { textile: deco } : { foil: deco }, w, s, t0: q.t, h0: q.h, moved: false }
      } else if (hit?.objectId) {
        const o = P.v.objects.find((x) => x.id === hit.objectId)
        const q = onFloor(e)
        if (o && q) drag = { kind: 'object', id: o.id, start: { x: o.x, y: o.y }, off: { x: q.x - o.x, y: q.y - o.y }, moved: false }
      } else if (sideAt(hit) || hit?.roomId || P.v.walls.find((x) => x.id === hit?.wallId)?.room) {
        // The top of a room side resizes the room; its roof or its own wall moves it
        const side = sideAt(hit)
        const w = P.v.walls.find((x) => x.id === hit!.wallId)
        const id = side?.room.id ?? hit!.roomId ?? w!.room!.id
        const mode = side?.side ?? 'move'
        const y = hit!.point.y
        const q = onFloor(e, y)
        if (q) drag = { kind: 'room', ...roomDrag(id, mode, q, P.v), y }
      } else if (hit?.wallId) {
        const w = P.v.walls.find((x) => x.id === hit.wallId)
        const q = onFloor(e)
        if (w && q && canMoveWall(w)) drag = { kind: 'wall', id: w.id, p0: q, v0: P.v, delta: '0,0', horizontal: w.from[1] === w.to[1], moved: false }
      }
      if (drag.kind !== 'orbit') {
        clearGrip()
        controls.enabled = false
        renderer.domElement.setPointerCapture(e.pointerId)
      }
    }
    const onMove = (e: PointerEvent) => {
      const P = props.current
      if (!drag || drag.kind === 'orbit') {
        if (!drag) {
          const hit = pick(e)
          const w = hit?.wallId ? P.v.walls.find((x) => x.id === hit.wallId) : undefined
          const side = sideAt(hit)
          if (side) showGrip(side.room, side.side)
          else clearGrip()
          const movable = hit?.objectId || hit?.textileId || hit?.foilId || hit?.roomId || (w && (w.room || canMoveWall(w)))
          renderer.domElement.style.cursor = side ? resizeCursor(side.room, side.side) : movable ? 'move' : hit ? 'pointer' : 'grab'
        }
        return
      }
      if (!down) return
      if (!drag.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) return
      if (drag.kind === 'decor') {
        const f = onFace(e, drag.w, drag.s)
        if (!f) return
        if (!drag.moved) P.onCheckpoint()
        drag.moved = true
        const { item, t0, h0 } = drag
        const dt = f.t - t0
        const dh = f.h - h0
        if ('textile' in item) P.onEdit((x) => moveTextileBy(x, rules, item.textile, dt, dh), false)
        else P.onEdit((x) => moveFoilBy(x, rules, item.foil, dt, dh, findMotif(P.motifs, item.foil.motif)?.ratio ?? 0), false)
        return
      }
      if (drag.kind === 'room') {
        const q = onFloor(e, drag.y)
        if (q) dragRoom(drag, q, P.onEdit, P.onCheckpoint)
        return
      }
      const q = onFloor(e)
      if (!q) return
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
      if (d?.kind === 'room' && d.moved) return dropRoom(d, P.onEdit)
      // A frame or decal is selected when let go, so the drawer does not open (and shrink the view) mid-drag
      if (hit?.textileId || hit?.foilId) {
        const deco = P.v.textiles.find((x) => x.id === hit.textileId) ?? P.v.foils.find((x) => x.id === hit.foilId)
        if (deco) P.onSelect({ wallId: deco.wallId, side: sideOf(P.v, deco), ...(hit.textileId ? { textileId: deco.id } : { foilId: deco.id }) })
        return
      }
      if (!click) return
      if (hit?.objectId) P.onSelect({ objectId: hit.objectId })
      else if (hit?.freeTextileId) {
        const t = P.v.freeTextiles.find((x) => x.id === hit.freeTextileId)
        if (t) P.onSelect({ freeTextileId: t.id, freeFace: faceOfPoint(t, toModel(hit.point)) })
      } else if (hit?.roomId) P.onSelect({ roomId: hit.roomId })
      else if (hit?.wallId) P.onSelect({ wallId: hit.wallId, side: faceOf(hit)?.s })
      else P.onSelect({})
    }

    // Drag and drop from Profilering: a frame or a motif lands on the wall face under the pointer
    const clearPreview = () => {
      if (!v.preview) return
      scene.remove(v.preview.mesh)
      dispose(v.preview.mesh)
      v.preview = null
      v.render()
    }
    const showPreview = (h: FaceTarget, spot: DropSpot) => {
      const key = [h.wallId, h.s, spot.on, spot.from, spot.to, spot.y0, !spot.error].join('|')
      if (v.preview?.key === key) return
      clearPreview()
      const w = props.current.v.walls.find((x) => x.id === h.wallId)
      if (!w) return
      const off = spot.on === 'wall' ? rules.wall.profile.thickness / 2 + 0.006 : textileOffset(rules) + rules.textile.depth / 2 + 0.008
      const mesh = previewMesh(props.current.v.stand, w, h.s, spot, off, !spot.error)
      scene.add(mesh)
      v.preview = { key, mesh }
      v.render()
    }
    const onDragOver = (e: DragEvent) => {
      const d = decorDrag(e)
      if (!d) return
      const h = faceOf(pick(e))
      const spot = h && dropSpot(props.current.v, d, h)
      // Over a wall the drop is always taken, so a refused one can say why
      e.preventDefault()
      e.dataTransfer!.dropEffect = h ? 'copy' : 'none'
      if (h && spot) showPreview(h, spot)
      else clearPreview()
    }
    const onDragLeave = (e: DragEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) clearPreview()
    }
    const onDrop = (e: DragEvent) => {
      const d = decorDrag(e)
      clearPreview()
      endDecorDrag()
      if (!d) return
      e.preventDefault()
      const P = props.current
      const h = faceOf(pick(e))
      if (!h) return P.onToast(d.kind === 'textile' ? 'Slipp tekstilveggen på en vegg' : 'Slipp grafikken på en vegg eller en tekstilvegg')
      const r = applyDrop(P.v, d, h, (id) => findMotif(P.motifs, id)?.ratio ?? 1)
      if ('error' in r) return P.onToast(r.error)
      P.onEdit(() => r.v)
      P.onSelect(r.select)
      if (r.toast) P.onToast(r.toast)
    }

    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
      clearPreview()
      clearGrip()
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
        <IconButton icon={RotateCcw} label="Roter venstre" onClick={() => turn(-45)} />
        <IconButton icon={RotateCw} label="Roter høyre" onClick={() => turn(45)} />
        <IconButton icon={ScanEye} label="Sett fra gangen" onClick={() => view.current && aim(view.current, W, D, AISLE)} />
        <IconButton icon={House} label="Nullstill" onClick={() => view.current && aim(view.current, W, D, HOME)} />
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

/** A see-through box on a wall face showing where a drop lands: blue when it can, red when it cannot. */
function previewMesh(stand: { width: number; depth: number }, w: Wall, s: FaceSide, b: { from: number; to: number; y0: number; y1: number }, off: number, ok: boolean) {
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
function gripMesh(stand: { width: number; depth: number }, [a, b]: [Point, Point], H: number) {
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
