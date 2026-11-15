// The grips of what is chosen, in the 3D view (Bjørn 15.11.2026: grips in 3D too): the same grips as in the plan
// (plan/grips.ts), drawn on top of the scene at the height of what they move, the same size on screen whatever the
// distance. A press near one drags it on a level plane at its height; what a drag stores is what the plan's grip stores
// (dragGrip), shown live and kept or undone on release.
import * as THREE from 'three'
import { objectFootprint } from '../../domain/objects'
import type { Variant } from '../../domain/types'
import { RECIPES } from '../../foga/recipes'
import { wallHeight } from '../../rules/rules'
import { place, rules } from '../env'
import { gripsOf, gripWith, type GripOn, type PlanGrip } from '../plan/grips'
import type { PlanSelection } from '../plan/selection'

/** A grip as the 3D view shows it: the plan's grip and the height it stands at, m. */
export interface SceneGrip extends PlanGrip {
  y: number
}

/** How near a grip a press takes hold of it, screen px (as the plan, pointer/hits.ts). */
export const GRIP_HIT_PX = 16
/** A grip's size on screen, px. */
const GRIP_PX = 14

/** The grips of what is chosen, as Velg shows them (no move grip: the whole thing is one), each at its height. */
export function sceneGrips(v: Variant, selection: PlanSelection): SceneGrip[] {
  return gripsOf(v, selection)
    .filter((g) => gripWith(g.on, 'select', null))
    .map((g) => ({ ...g, y: gripHeight(v, g.on) }))
}

/** On top of what the grip moves: a room or a wall at the top of its walls, a counter on its top, furniture on its own. */
function gripHeight(v: Variant, on: GripOn): number {
  if (on.type === 'room' || on.type === 'end') return wallHeight(rules)
  const o = v.objects.find((x) => x.id === on.id)
  if (!o) return 0
  if (o.sections) return (Math.max(...o.sections.map((s) => s.h)) + RECIPES.counter.railHeight) / 1000
  return objectFootprint(place, o)?.h ?? 0
}

/** Model point at height y → world. */
const world = (v: Variant, g: SceneGrip) => new THREE.Vector3(g.at[0] - v.stand.width / 2, g.y, g.at[1] - v.stand.depth / 2)

/** The grip nearest the pointer on screen within GRIP_HIT_PX, if any. */
export function gripAtScreen(v: Variant, grips: SceneGrip[], camera: THREE.Camera, el: HTMLElement, e: { clientX: number; clientY: number }): SceneGrip | null {
  const r = el.getBoundingClientRect()
  let best: SceneGrip | null = null
  let d0 = GRIP_HIT_PX
  for (const g of grips) {
    const p = world(v, g).project(camera)
    if (p.z > 1) continue
    const d = Math.hypot(r.left + ((p.x + 1) / 2) * r.width - e.clientX, r.top + ((1 - p.y) / 2) * r.height - e.clientY)
    if (d < d0) [best, d0] = [g, d]
  }
  return best
}

/** The grips drawn as round (side, end), square (corner) or arrowed (turn) markers on top of everything; `hot` filled
 *  with ink. */
export function gripSprites(v: Variant, grips: SceneGrip[], camera: THREE.PerspectiveCamera, heightPx: number, hot: SceneGrip | null): THREE.Group {
  const g = new THREE.Group()
  // With sizeAttenuation off a sprite's scale is in view units per unit of distance: this many px on screen
  const scale = (GRIP_PX * 2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, heightPx)
  for (const x of grips) {
    const on = !!hot && sameAt(hot, x)
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(x.kind, on), depthTest: false, sizeAttenuation: false, transparent: true }))
    s.position.copy(world(v, x))
    s.scale.setScalar(scale * (on ? 1.25 : 1) * (x.kind === 'rotate' ? 1.35 : 1))
    s.renderOrder = 20
    g.add(s)
  }
  return g
}

const sameAt = (a: SceneGrip, b: SceneGrip) => a.at[0] === b.at[0] && a.at[1] === b.at[1] && a.y === b.y

const textures = new Map<string, THREE.Texture>()

/** One small picture per kind and state, drawn once. */
function texture(kind: SceneGrip['kind'], hot: boolean): THREE.Texture {
  // The app's own ink and surface (light or dark mode), as the plan's grips
  const css = (name: string, or: string) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v ? `rgb(${v})` : or
  }
  const [INK, SURFACE] = [css('--ink', '#1c1c1e'), css('--surface', '#ffffff')]
  const key = `${kind}:${hot}:${INK}:${SURFACE}`
  const have = textures.get(key)
  if (have) return have
  const n = 64
  const c = document.createElement('canvas')
  c.width = c.height = n
  const x = c.getContext('2d')!
  x.shadowColor = 'rgba(0,0,0,0.35)'
  x.shadowBlur = 6
  x.fillStyle = hot ? INK : SURFACE
  x.beginPath()
  if (kind === 'corner') x.roundRect(10, 10, n - 20, n - 20, 8)
  else x.arc(n / 2, n / 2, n / 2 - 10, 0, Math.PI * 2)
  x.fill()
  if (kind === 'rotate') {
    x.shadowBlur = 0
    x.strokeStyle = hot ? SURFACE : INK
    x.lineWidth = 5
    x.lineCap = 'round'
    x.beginPath()
    x.arc(n / 2, n / 2, 12, -Math.PI / 2, Math.PI * 1.0, true)
    x.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  textures.set(key, t)
  return t
}

/** Takes the grips' group out of the scene. */
export function dropGrips(scene: THREE.Scene, g: THREE.Group | null) {
  if (!g) return
  scene.remove(g)
  // The textures are shared and kept; only the materials go
  g.traverse((o) => {
    if (o instanceof THREE.Sprite) o.material.dispose()
  })
}
