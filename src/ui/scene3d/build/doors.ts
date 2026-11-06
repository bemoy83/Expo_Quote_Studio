// Doors and curtains in an opening module. The door leaf is Foga's: a 292 frame (stiles full height, rails between),
// 80 mm seen from the front and 20 thick, one wall plate in the channels in the leaf's colour, two hinges 403 and the
// lock 410 the same on both sides. A curtain hangs from the glider in the header's bottom rail.
// Byggeregler D2, D5 (docs/byggeregler.md).
import * as THREE from 'three'
import { doorHinge, doorRal, doorSwing } from '../../../domain/doors'
import { wallDirection } from '../../../domain/grid'
import type { BuiltModule } from '../../../domain/walls'
import { RECIPES } from '../../../foga/recipes'
import { plateColor, productOf, rules } from '../../env'
import { shared, unitProfile } from './profiles'
import { ALU, ALU_FINISH, CHROME, CURTAIN, INK, LOCK, selectGlow, type BuildContext, type Tag } from './context'

/** Heights in the opening, m from the floor: leaf bottom and top, header bottom (2490 post on its foot, D2). */
export function doorLevels() {
  const d = RECIPES.door
  const leaf = rules.wall.feet + d.floorGap / 1000
  return { leaf, top: leaf + d.leaf / 1000, header: leaf + (d.leaf + d.topGap) / 1000 }
}

/** The 292 seen from the front (80) and its depth (20), m. */
const FACE = 0.08
const DEPTH = 0.02
/** How far the plate goes into the channel on each side, m (as in the wall). */
const IN_CHANNEL = 0.008

export function buildOpening(c: BuildContext, m: BuiltModule, tag: Tag) {
  const { v, at, mat, add, root, post, sel } = c
  const o = m.opening!
  const w = v.walls.find((x) => x.id === o.wallId)
  if (!w) return
  const lv = doorLevels()
  // Local frame of the opening: x along the wall, z its left normal, origin on the floor at the module centre
  const [wx, wy] = wallDirection(w)
  const g = new THREE.Group()
  g.position.copy(at([(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2]))
  g.rotation.y = Math.atan2(-wy, wx)
  root.add(g)

  if (productOf(o.product)?.opening !== 'door') {
    // Curtain: a folded sheet from the glider down to just above the floor
    const h = lv.header - 0.02
    const geo = new THREE.PlaneGeometry(rules.wall.cc - post - 0.02, h, 24, 1)
    const pos = geo.attributes.position
    for (let k = 0; k < pos.count; k++) pos.setZ(k, Math.sin((pos.getX(k) + 0.5) * Math.PI * 12) * 0.025)
    geo.computeVertexNormals()
    const mesh = new THREE.Mesh(geo, mat('openings', CURTAIN, { side: THREE.DoubleSide, roughness: 1 }))
    mesh.position.y = 0.02 + h / 2
    add(mesh, tag, g)
    return
  }

  const glow = selectGlow(sel.openingId === o.id)
  const alu = mat('openings', ALU, { ...ALU_FINISH, ...glow })
  const W = rules.door.swing
  const H = lv.top - lv.leaf
  const piece = (len: number, x: number, y: number, upright: boolean) => {
    const mesh = new THREE.Mesh(unitProfile(RECIPES.door.frame as '292'), alu)
    mesh.scale.x = len
    if (upright) mesh.rotation.z = Math.PI / 2
    mesh.position.set(x, y, 0)
    add(mesh, tag, g)
  }
  // Stiles full height, rails between them
  for (const x of [-1, 1]) piece(H, x * (W / 2 - FACE / 2), lv.leaf + H / 2, true)
  for (const y of [lv.leaf + FACE / 2, lv.top - FACE / 2]) piece(W - 2 * FACE, 0, y, false)
  const plate = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * FACE + 2 * IN_CHANNEL, H - 2 * FACE + 2 * IN_CHANNEL, 0.003), mat('openings', plateColor(doorRal(v, o)), glow))
  plate.position.y = lv.leaf + H / 2
  add(plate, tag, g)

  // Hinge side and swing side in the local frame: the hinge sits at the leaf edge toward `hinge`, swing toward `s`
  const hg = doorHinge(w, o)
  const hinge = hg.dir[0] * wx + hg.dir[1] * wy > 0 ? -1 : 1
  const s = doorSwing(v.stand, w, o)
  const chrome = mat('openings', CHROME, { metalness: 0.8, roughness: 0.3 })
  const fromEnd = RECIPES.door.hinge.fromEnd / 1000
  for (const y of [lv.leaf + fromEnd, lv.top - fromEnd]) {
    const barrel = new THREE.Mesh(shared('door-hinge', () => new THREE.CylinderGeometry(0.007, 0.007, 0.08, 12)), chrome)
    barrel.position.set(hinge * W / 2, y, s * (DEPTH / 2 + 0.004))
    add(barrel, tag, g)
  }
  // Lock 410 on the free stile: black rosette and knob, the same on both faces
  const black = mat('openings', LOCK, { roughness: 0.6 })
  const lx = -hinge * (W / 2 - FACE / 2)
  const ly = RECIPES.door.lock.height / 1000
  for (const side of [-1, 1]) {
    const rosette = new THREE.Mesh(shared('lock-rosette', () => new THREE.CylinderGeometry(0.0275, 0.0275, 0.006, 24)), black)
    rosette.rotation.x = (side * Math.PI) / 2
    rosette.position.set(lx, ly, side * (DEPTH / 2 + 0.003))
    add(rosette, tag, g)
    const knob = new THREE.Mesh(shared('lock-knob', () => new THREE.CylinderGeometry(0.015, 0.02, 0.035, 24)), black)
    knob.rotation.x = (side * Math.PI) / 2
    knob.position.set(lx, ly, side * (DEPTH / 2 + 0.006 + 0.0175))
    add(knob, tag, g)
  }

  // The swing on the floor: a quarter circle from the closed leaf out to the swing side
  const pts: THREE.Vector3[] = []
  for (let k = 0; k <= 24; k++) {
    const t = ((Math.PI / 2) * k) / 24
    pts.push(new THREE.Vector3(hinge * W / 2 - hinge * Math.cos(t) * W, 0.008, s * Math.sin(t) * W))
  }
  pts.push(new THREE.Vector3(hinge * W / 2, 0.008, 0))
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: INK, dashSize: 0.05, gapSize: 0.05 }))
  line.computeLineDistances()
  add(line, { layer: 'openings' }, g)
}
