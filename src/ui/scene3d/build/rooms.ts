// Rooms: a see-through roof at wall height, the handle that moves the room.
import * as THREE from 'three'
import { insetOutline, outlineSides } from '../../../domain/outline'
import { SELECT, type BuildContext } from './context'

export function buildRooms(c: BuildContext) {
  const { v, W, D, H, root, at, add, sel } = c
  // Rooms: a see-through roof at wall height to grab and move the room. There is no roof product; this is only a
  // handle. Sides are resized by grabbing the top of a wall (see Scene3D), so nothing is drawn on the walls.
  for (const r of v.rooms) {
    const selected = sel.roomId === r.id || v.walls.some((w) => w.id === sel.wallId && w.room?.id === r.id)
    // Shape (x, y) lies flat after turning about x: local (x, y) → world (x, −y), so y is mirrored here
    const shape = new THREE.Shape(insetOutline(r.outline, 0.04).map(([x, y]) => new THREE.Vector2(x - W / 2, D / 2 - y)))
    const roof = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: SELECT, transparent: true, opacity: selected ? 0.22 : 0.08, depthWrite: false, side: THREE.DoubleSide }),
    )
    roof.rotation.x = -Math.PI / 2
    roof.position.y = H + 0.012
    add(roof, { layer: 'walls', pick: { roomId: r.id } })
    roof.castShadow = false
    roof.receiveShadow = false
    const edge: number[] = []
    for (const [a, b] of outlineSides(r.outline)) {
      edge.push(...at(a, H + 0.014).toArray(), ...at(b, H + 0.014).toArray())
    }
    const outline = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(edge, 3)),
      new THREE.LineDashedMaterial({ color: SELECT, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: selected ? 0.9 : 0.5 }),
    )
    outline.computeLineDistances()
    outline.userData = { label: true }
    root.add(outline)
  }
}
