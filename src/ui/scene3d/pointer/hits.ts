// What lies under the pointer in the 3D view, and where the pointer is on the floor or on a wall face, in model metres.
// Model → world: x → x, y → z, centred on the stand (see build.ts).
import * as THREE from 'three'
import { faceAt, faceNormal, faces, sideOf, type FaceSide } from '../../../domain/faces'
import { offsetAlong, wallDirection } from '../../../domain/grid'
import { roomSideAt } from '../../../domain/rooms'
import type { Room, Variant, Wall } from '../../../domain/types'
import { wallHeight } from '../../../rules/rules'
import type { FaceTarget } from '../../dnd'
import { rules } from '../../env'
import type { Tag } from '../build'

/** Top part of a room wall that resizes the room instead of moving it, m. */
export const GRIP = 0.2

/** A pickable mesh under the pointer, and where it was hit. */
export type Hit = NonNullable<Tag['pick']> & { point: THREE.Vector3 }

type At = { clientX: number; clientY: number }

export function sceneHits(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, content: () => THREE.Group | null, model: () => Variant) {
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  ray.params.Line = { threshold: 0.01 }
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const setRay = (e: At) => {
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
  }
  /** World → model. */
  const toModel = (q: THREE.Vector3) => {
    const s = model().stand
    return { x: q.x + s.width / 2, y: q.z + s.depth / 2 }
  }

  /** The pickable thing on top under the pointer. A room roof is a handle only: furniture and decor seen through it win. */
  const pick = (e: At): Hit | null => {
    const root = content()
    if (!root) return null
    setRay(e)
    let roof: Hit | null = null
    for (const h of ray.intersectObjects(root.children, true)) {
      const t = h.object.userData as Partial<Tag>
      if (t.pick) {
        if (t.pick.roomId && !roof) {
          roof = { ...t.pick, point: h.point }
          continue
        }
        if (roof && !(t.pick.objectId || t.pick.textileId || t.pick.foilId || t.pick.shelfId || t.pick.freeTextileId)) return roof
        return { ...t.pick, point: h.point }
      }
      if (t.layer || !h.object.userData.label) return roof
    }
    return roof
  }

  /** The wall face under the pointer: the face of the frame or decal hit, else the side of the wall the hit is on. */
  const faceOf = (hit: Hit | null): FaceTarget | null => {
    const V = model()
    const w = hit?.wallId && V.walls.find((x) => x.id === hit.wallId)
    if (!hit || !w) return null
    const q = toModel(hit.point)
    const deco = V.textiles.find((x) => x.id === hit.textileId) ?? V.foils.find((x) => x.id === hit.foilId)
    const t = offsetAlong(w, q)
    if (deco) return { wallId: w.id, s: sideOf(V, deco), t, y: hit.point.y, foilId: hit.foilId }
    const n = faceNormal(w, 1)
    const raw: FaceSide = (q.x - w.from[0]) * n[0] + (q.y - w.from[1]) * n[1] >= 0 ? 1 : -1
    return { wallId: w.id, s: faceAt(V, w, q), t, y: hit.point.y, outside: !faces(V, w).includes(raw) }
  }

  /** Pointer on the vertical plane of a wall face: offset along the wall and height. */
  const onFace = (e: At, w: Wall, s: FaceSide) => {
    setRay(e)
    const n = faceNormal(w, s)
    const W0 = model().stand
    const p0 = new THREE.Vector3(w.from[0] - W0.width / 2, 0, w.from[1] - W0.depth / 2)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(n[0], 0, n[1]), p0)
    const q = new THREE.Vector3()
    if (!ray.ray.intersectPlane(plane, q)) return null
    const [dx, dy] = wallDirection(w)
    return { t: (q.x - p0.x) * dx + (q.z - p0.z) * dy, h: q.y }
  }

  /** Pointer on the floor plane (or a level plane at height y), in model coordinates. */
  const onFloor = (e: At, y = 0) => {
    setRay(e)
    const q = new THREE.Vector3()
    if (!ray.ray.intersectPlane(y ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -y) : floor, q)) return null
    return toModel(q)
  }

  /** The room side whose top edge is under the pointer (a stand wall shared with the room counts too). */
  const sideAt = (hit: Hit | null): { room: Room; side: number } | undefined => {
    if (!hit?.wallId || hit.point.y < wallHeight(rules) - GRIP) return undefined
    const q = toModel(hit.point)
    return roomSideAt(model(), q.x, q.y, 0.12)
  }

  return { pick, faceOf, onFace, onFloor, sideAt, toModel }
}

export type SceneHits = ReturnType<typeof sceneHits>
