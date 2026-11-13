// Counter (bardisk 6560, Byggeregler K1–K8) from the same pieces the kalkyle costs (foga/counter.ts): in each node
// the profile for the directions it joins (92L, 93, 94), 93 and 92 rails round the outside and 94 between two parts,
// all from their measured outlines; the wall plates in the counter's colour (K6), the white tops and shelves. The 600 couplings sit inside the profiles and are not drawn. The closed front faces the object's +y.
import * as THREE from 'three'
import { podiumDecals, podiumPrints } from '../../../domain/podiumDecor'
import type { PodiumPart } from '../../../domain/podiumFaces'
import type { CounterSection } from '../../../domain/types'
import type { Box3, CounterBuild, CounterProfile } from '../../../foga/counter'
import { RECIPES } from '../../../foga/recipes'
import { findMotif } from '../../motifs'
import { cropMaterial, printMaterial } from './motifs'
import { plateColor } from '../../env'
import { ALU, ALU_FINISH, type BuildContext, type Tag } from './context'
import { turnedProfile } from './profiles'
import { BOARD } from './shelves'

const AXIS = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }
const mid = (b: Box3) => new THREE.Vector3((b.x[0] + b.x[1]) / 2000, (b.y[0] + b.y[1]) / 2000, (b.z[0] + b.z[1]) / 2000)

/** Outline x and y as directions in the counter (K2, K3): the closed faces outward. */
function outward(x: CounterProfile) {
  const [ox, oz] = x.out
  if (x.role === 'post') {
    // A 94 joins all four ways: any turn. A 93 has one closed face (K8): its channel side inward from it
    if (!ox && !oz) return { u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1) }
    if (!ox || !oz) return { u: new THREE.Vector3(-ox, 0, -oz), v: new THREE.Vector3(oz, 0, -ox) }
    return { u: new THREE.Vector3(-ox, 0, 0), v: new THREE.Vector3(0, 0, oz) }
  }
  // A rail inside the counter (a 94, K8) has no outer face: either side across it
  if (!ox && !oz) return { u: x.axis === 'x' ? AXIS.z.clone() : AXIS.x.clone(), v: AXIS.y.clone() }
  return { u: new THREE.Vector3(-ox, 0, -oz), v: AXIS.y.clone() }
}

/** Every piece of counter `b` into group `g`, in the counter's own coordinates (the group places and turns it). */
export function buildCounter(c: BuildContext, g: THREE.Group, b: CounterBuild, ral: string, tag: Tag, warn: THREE.MeshStandardMaterialParameters) {
  const { mat, add } = c
  const alu = mat('objects', ALU, { ...ALU_FINISH, ...warn })
  for (const x of b.profiles) {
    const { u, v: vv } = outward(x)
    const { geo, q } = turnedProfile(x.code, AXIS[x.axis], u, vv)
    const mesh = new THREE.Mesh(geo, alu)
    mesh.quaternion.copy(q)
    mesh.scale.x = x.len / 1000
    mesh.position.copy(mid(x.box))
    add(mesh, tag, g)
  }
  const box = (bx: Box3, m: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry((bx.x[1] - bx.x[0]) / 1000, (bx.y[1] - bx.y[0]) / 1000, (bx.z[1] - bx.z[0]) / 1000), m)
    mesh.position.copy(mid(bx))
    add(mesh, tag, g)
  }
  // K4, K6: the wall plate in the counter's colour (print and decal over it: buildPodiumDecor)
  const plate = mat('objects', plateColor(ral), { roughness: 0.6, ...warn })
  for (const p of b.plates) box(p.box, plate)
  const board = mat('objects', BOARD, { roughness: 0.55, ...warn })
  for (const x of b.boards) box(x.box, board)
}

/** Print and decals on a counter of Disker og podier (Byggeregel K20), a thin sheet just outside the plates, facing
 *  out: print its share of the motif in each window of plate and door, decals whole. `locked`: parts held to a plate. */
export function buildPodiumDecor(c: BuildContext, g: THREE.Group, sections: readonly CounterSection[], locked: ReadonlySet<string>, tag: Tag, warn: THREE.MeshStandardMaterialParameters) {
  const { opts, add } = c
  const ratio = (id: string) => findMotif(opts.motifs, id)?.ratio ?? 0
  const R = RECIPES.counter
  // A sheet on the part's outer face from t0 to t1 along and y0 to y1 up (mm), its local x running left to right as
  // seen from outside
  const sheet = (p: PodiumPart, t0: number, t1: number, y0: number, y1: number, m: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry((t1 - t0) / 1000, (y1 - y0) / 1000), m)
    const across = (p.at + p.out * (R.face + 1)) / 1000
    const along = (t0 + t1) / 2000
    mesh.position.set(p.axis === 'x' ? across : along, (y0 + y1) / 2000, p.axis === 'x' ? along : across)
    mesh.rotation.y = p.axis === 'z' ? (p.out > 0 ? 0 : Math.PI) : p.out > 0 ? Math.PI / 2 : -Math.PI / 2
    add(mesh, tag, g)
  }
  for (const w of podiumPrints(sections, locked, ratio)) {
    const m = findMotif(opts.motifs, w.motif)
    if (m) sheet(w.part, w.t0, w.t1, w.y0, w.y1, cropMaterial(m, w.crop, opts.onLoad, warn))
  }
  for (const d of podiumDecals(sections, locked)) {
    const m = findMotif(opts.motifs, d.decal.motif)
    if (m) sheet(d.part, d.t0, d.t1, d.y0, d.y1, printMaterial(m, d.decal.w / d.decal.h, opts.onLoad, { ...warn, polygonOffset: true, polygonOffsetFactor: -2 }))
  }
}
