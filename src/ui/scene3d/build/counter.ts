// Counter (bardisk 6560, Byggeregler K1–K5) from the same pieces the kalkyle costs (foga/counter.ts): 92L in the
// corners, 93 and 92 rails from their measured outlines, the wall plates in the sketch's wall colour, the white top and
// shelf. The 600 couplings sit inside the profiles and are not drawn. The closed front faces the object's +y.
import * as THREE from 'three'
import type { Box3, CounterBuild, CounterProfile } from '../../../foga/counter'
import { plateColor } from '../../env'
import { ALU, ALU_FINISH, type BuildContext, type Tag } from './context'
import { turnedProfile } from './profiles'
import { BOARD } from './shelves'

const AXIS = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }
const mid = (b: Box3) => new THREE.Vector3((b.x[0] + b.x[1]) / 2000, (b.y[0] + b.y[1]) / 2000, (b.z[0] + b.z[1]) / 2000)

/** Outline x and y as directions in the counter (K2, K3): the closed faces outward. */
function outward(x: CounterProfile) {
  const [ox, oz] = x.out
  if (x.role === 'post') return { u: new THREE.Vector3(-ox, 0, 0), v: new THREE.Vector3(0, 0, oz) }
  return { u: new THREE.Vector3(-ox, 0, -oz), v: AXIS.y.clone() }
}

/** Every piece of counter `b` into group `g`, in the counter's own coordinates (the group places and turns it). */
export function buildCounter(c: BuildContext, g: THREE.Group, b: CounterBuild, tag: Tag, warn: THREE.MeshStandardMaterialParameters) {
  const { v, mat, add } = c
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
  // K4: the wall plate in the sketch's wall colour (its own colour, print and decal come later)
  const plate = mat('objects', plateColor(v.defaultPlate), { roughness: 0.6, ...warn })
  for (const p of b.plates) box(p.box, plate)
  const board = mat('objects', BOARD, { roughness: 0.55, ...warn })
  for (const x of b.boards) box(x.box, board)
}
