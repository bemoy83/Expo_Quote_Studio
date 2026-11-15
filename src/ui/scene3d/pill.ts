// Where the selection pill stands in 3D (docs/pille-og-skuff.md): over what is chosen as it lies on screen, else under
// it. The box is that of the meshes picked as the selection (their Tag), seen through the camera; placePill does the rest
// as in the plan, keeping clear of what floats over the view.
import * as THREE from 'three'
import type { Variant } from '../../domain/types'
import { avoidIn, PILL_GAP, type PillPlace } from '../plan/pill/pillAnchor'
import { chosen, chosenShelves, type PlanSelection } from '../plan/selection'
import type { Tag } from './build'

type Pick = NonNullable<Tag['pick']>

/** Whether a mesh picked as `p` is part of what is chosen. */
function matcher(v: Variant, sel: PlanSelection): ((p: Pick) => boolean) | null {
  const c = chosen(v, sel)
  if (!c) return null
  switch (c.kind) {
    case 'object':
      return (p) => p.objectId === c.object.id
    case 'room':
      return (p) => p.roomId === c.room.id && !p.objectId
    case 'free':
      return (p) => p.freeTextileId === c.textile.id
    case 'opening':
      return (p) => p.openingId === c.opening.id
    case 'textile':
      return (p) => p.textileId === c.textile.id
    case 'foil':
      return (p) => p.foilId === c.foil.id
    case 'shelf': {
      const ids = new Set(chosenShelves(v, sel))
      return (p) => !!p.shelfId && ids.has(p.shelfId)
    }
    case 'wall':
      return (p) => p.wallId === c.wall.id && !p.textileId && !p.foilId && !p.shelfId && !p.openingId
    default:
      // Not chosen in 3D (floor, takdrager): no pill
      return null
  }
}

const corner = new THREE.Vector3()

/** The box around what is chosen in the built scene, world metres; empty when none of it is drawn. */
export function chosenBox(root: THREE.Object3D, v: Variant, sel: PlanSelection): THREE.Box3 {
  const box = new THREE.Box3()
  const match = matcher(v, sel)
  if (!match) return box
  // Placed groups (furniture, counters) move their meshes: world matrices as drawn, also before the first render
  root.updateMatrixWorld()
  root.traverse((o) => {
    const p = (o.userData as Partial<Tag>).pick
    if (p && o.visible && match(p)) box.expandByObject(o)
  })
  return box
}

/** The pill's place for `sel` in the 3D view, or null when nothing chosen is in sight. `wrap`: the view's box. */
export function pillPlace3d(root: THREE.Object3D | null, camera: THREE.Camera, wrap: HTMLElement | null, v: Variant, sel: PlanSelection): PillPlace | null {
  if (!root || !wrap) return null
  const box = chosenBox(root, v, sel)
  if (box.isEmpty()) return null
  const w = wrap.clientWidth
  const h = wrap.clientHeight
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera)
    // Behind the camera: no place on screen
    if (corner.z > 1) return null
    const x = ((corner.x + 1) / 2) * w
    const y = ((1 - corner.y) / 2) * h
    left = Math.min(left, x)
    right = Math.max(right, x)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }
  // Out of sight
  if (right < 0 || left > w || bottom < 0 || top > h) return null
  return {
    box: { left, top, right, bottom },
    anchor: { x0: 0, y0: 0, x1: 0, y1: 0, tries: [{ dir: 'up', gap: PILL_GAP }, { dir: 'down', gap: PILL_GAP }] },
    size: { w, h },
    avoid: avoidIn(wrap),
  }
}
