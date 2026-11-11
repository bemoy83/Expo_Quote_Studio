// The frame: posts (from the calc, so plan, 3D and quote agree), støtteplater under free walls, and takdragere.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fogaPart } from '../../../foga/parts'
import { RECIPES } from '../../../foga/recipes'
import { pointKey } from '../../../domain/grid'
import type { Point } from '../../../domain/types'
import { wallPoints } from '../../../domain/walls'
import { rules } from '../../env'
import { profile, shared, unitProfile } from './profiles'
import { ALU, ALU_FINISH, BEAM, FOOT_PLATE, type BuildContext } from './context'

export function buildFrame(c: BuildContext) {
  const { res, H, at, mat, add, along, mods } = c
  // Posts: wall posts and beam posts, from the calc so plan, 3D and quote agree
  const wallPts = wallPoints(mods)
  // A post over a foot plate is picked without its adjustable foot
  const onPlate = new Set(res.wallSupports.map((f) => pointKey(f.at)))
  for (const p of res.posts) {
    const onWall = wallPts.has(pointKey(p))
    const layer = onWall ? 'walls' : 'beams'
    const mesh = new THREE.Mesh(unitProfile('94'), mat(layer, ALU, ALU_FINISH))
    mesh.scale.x = H - c.feet
    mesh.rotation.z = Math.PI / 2
    mesh.position.copy(at(p, c.feet + (H - c.feet) / 2))
    add(mesh, { layer })
    if (onPlate.has(pointKey(p))) continue
    // Adjustable foot (M10 × 65): a tapered rubber pad with a hex on top, the screw up into the post's centre tube
    // (the 700 insert is not drawn)
    const pad = new THREE.Mesh(footPad(), mat(layer, FOOT_PAD, { roughness: 0.9 }))
    pad.position.copy(at(p))
    add(pad, { layer })
    const screw = new THREE.Mesh(screwGeometry(), mat(layer, SCREW, { metalness: 0.15, roughness: 0.35 }))
    screw.scale.y = Math.max(0.001, c.feet - FOOT.pad - FOOT.hex)
    screw.position.copy(at(p, FOOT.pad + FOOT.hex + screw.scale.y / 2))
    add(screw, { layer })
  }

  // Støtteplater under walls that stand free, across the wall, on the floor
  const foot = RECIPES.wall.support.foot
  for (const { at: [x, y], orientation } of res.wallSupports) {
    const half = foot.across / 2000
    const [a, b]: [Point, Point] = orientation === 'h' ? [[x, y - half], [x, y + half]] : [[x - half, y], [x + half, y]]
    along(a, b, 2 * half, PLATE, foot.along / 1000, 0, mat('walls', FOOT_PLATE, ALU_FINISH), { layer: 'walls' })
    // Post mount 795: a square pin on the plate, up into the post's centre tube (the post has no adjustable foot here)
    const pin = new THREE.Mesh(pinGeometry(), mat('walls', ALU, ALU_FINISH))
    pin.scale.y = Math.max(0.001, c.feet - PLATE)
    pin.position.copy(at([x, y], PLATE + pin.scale.y / 2))
    add(pin, { layer: 'walls' })
  }

  // Beams (takdrager) in 292, top flush with the walls, cut between the posts (centres − 40). A beam lifted over a
  // textile wall (calc/beams/beamLift.ts) is one piece of 94 higher
  const lift = RECIPES.beam.lift.length / 1000
  for (const s of res.beams.segments) {
    const [a, b] = [s.from, s.to]
    const mesh = new THREE.Mesh(unitProfile('292'), mat('beams', BEAM, ALU_FINISH))
    mesh.scale.x = Math.max(0.001, Math.hypot(b[0] - a[0], b[1] - a[1]) - rules.wall.post)
    mesh.position.copy(at([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], H - rules.beam.height / 2 + (s.lifted ? lift : 0)))
    mesh.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
    add(mesh, { layer: 'beams' })
  }
  // Hooks in 01 where a beam hangs on another (calc/beams/beamHooks.ts): set as a T over the beam it hangs on, a 20 mm piece
  // lying on top with its channel up, and an 80 mm leg down the side each hanging beam comes from, channel out to it
  const hook = RECIPES.beam.hook
  const [top, leg] = [hook.top / 1000, hook.leg / 1000]
  // The leg stands out from the beam by the profile's height (01: 11,5)
  const [beamHalf, legHalf] = [rules.beam.thickness / 2, (fogaPart(hook.profile).section?.[1] ?? 0) / 2000]
  for (const h of res.hooks) {
    const base = H + (h.lifted ? lift : 0)
    // Across the beam it hangs on: plan y (three z) when that beam runs along x
    const acrossZ = h.along === 'h'
    const tab = new THREE.Mesh(unitProfile(profile(hook.profile), true), mat('beams', ALU, ALU_FINISH))
    tab.scale.x = top
    if (acrossZ) tab.rotation.y = Math.PI / 2
    tab.position.copy(at(h.at, base + legHalf))
    add(tab, { layer: 'beams' })
    for (const side of h.sides) {
      const m = new THREE.Mesh(unitProfile(profile(hook.profile)), mat('beams', ALU, ALU_FINISH))
      m.scale.x = leg
      // Upright, channel out along +x or −x; turned to ±z when the beam runs along x
      m.rotation.set(0, acrossZ ? -Math.PI / 2 : 0, (side * Math.PI) / 2)
      const off = side * (beamHalf + legHalf)
      m.position.copy(at(acrossZ ? [h.at[0], h.at[1] + off] : [h.at[0] + off, h.at[1]], base - leg / 2))
      add(m, { layer: 'beams' })
    }
  }

  // The 94 pieces that lift them: on top of each post under a lifted beam, and at a hook point between a lifted beam and
  // one that is not, at the level of the beam hanging there
  if (res.lift) {
    const piece = (p: Point, bottom: number, layer: 'walls' | 'beams') => {
      const mesh = new THREE.Mesh(unitProfile('94'), mat(layer, ALU, ALU_FINISH))
      mesh.scale.x = lift
      mesh.rotation.z = Math.PI / 2
      mesh.position.copy(at(p, bottom + lift / 2))
      add(mesh, { layer })
    }
    for (const p of res.lift.posts) piece(p, H, wallPts.has(pointKey(p)) ? 'walls' : 'beams')
    // A lifted beam ending on a wall between its posts (Byggeregel T15): the piece on top of the wall
    for (const p of res.lift.walls ?? []) piece(p, H, 'beams')
    for (const p of res.lift.hooks) {
      const k = pointKey(p)
      const hanging = res.beams.segments.filter((s) => pointKey(s.from) === k || pointKey(s.to) === k)
      piece(p, hanging.some((s) => s.lifted) ? H : H - rules.beam.height, 'beams')
    }
  }
}

/** Adjustable foot under a wall or beam post (Bjørn 6.11.2026, photo): M10 × 65 screw, a black rubber pad Ø 40
 *  tapering to Ø 28 and 6 mm high, and a hex 17 mm across flats on top of it, m. */
const FOOT = { pad: 0.006, padBottom: 0.02, padTop: 0.014, hex: 0.006, hexRadius: 0.0098, screwRadius: 0.005 }
const FOOT_PAD = '#1f2023'
const SCREW = '#d4d7db'
/** Foot plate 750 is 5 mm, m. */
const PLATE = 0.005
/** Post mount 795 (Bjørn 6.11.2026, photo): a square bar that fits the 17 × 17 centre tube of post 94, m. */
const PIN = 0.016

/** Pad and hex as one piece (one rubber), standing on y = 0. */
function footPad() {
  return shared('foot-pad', () => {
    const pad = new THREE.CylinderGeometry(FOOT.padTop, FOOT.padBottom, FOOT.pad, 24).translate(0, FOOT.pad / 2, 0)
    const hex = new THREE.CylinderGeometry(FOOT.hexRadius, FOOT.hexRadius, FOOT.hex, 6).translate(0, FOOT.pad + FOOT.hex / 2, 0)
    const g = mergeGeometries([pad, hex])
    pad.dispose()
    hex.dispose()
    return g
  })
}

/** The screw and the 795 pin are 1 m upright and scaled to what shows. */
const screwGeometry = () => shared('foot-screw', () => new THREE.CylinderGeometry(FOOT.screwRadius, FOOT.screwRadius, 1, 12))
const pinGeometry = () => shared('foot-pin', () => new THREE.BoxGeometry(PIN, 1, PIN))
