// What every part of the 3D build shares: the stand in world coordinates, the root group, one material per layer and
// colour (so the view can dim a layer), and the helpers that add a mesh with its tag. The colours of the build system
// are here too; product colours come from the catalog.
import * as THREE from 'three'
import type { CalcResult } from '../../../calc/calc'
import type { Point, Variant } from '../../../domain/types'
import { builtModules, type BuiltModule } from '../../../domain/walls'
import type { Motif } from '../../../persistence/file'
import { wallHeight } from '../../../rules/rules'
import { rules } from '../../env'
import type { Highlight } from '../../tools'

export type Layer = Exclude<Highlight, null>

/** What a mesh stands for. `pick` marks meshes the pointer can hit. */
export interface Tag {
  layer: Layer
  /** `roomId`: a room's see-through roof, the handle that moves the room. */
  pick?: { wallId?: string; objectId?: string; textileId?: string; foilId?: string; roomId?: string; freeTextileId?: string; openingId?: string; shelfId?: string; shelfOnly?: boolean }
}

/** Colours of the build system. Product colours come from the catalog. */
export const ALU = '#9a9da1'
export const BEAM = '#7d8084'
export const CURTAIN = '#3a3c41'
export const FABRIC = '#cfc7e6'
export const STAND_FLOOR = '#e3e0d8'
/** Joint between carpet tiles, m: barely there, as on a laid floor. */
export const JOINT = 0.006
/** Grey foot plates (750), darker than the floor so they show. */
export const FOOT_PLATE = '#3d4045'
export const SELECT = '#6aaecb'
/** The blue glow of a chosen part, mixed into its material. */
export const selectGlow = (on: boolean): THREE.MeshStandardMaterialParameters => (on ? { emissive: SELECT, emissiveIntensity: 0.35 } : {})
export const CONFLICT = '#d24b3f'
export const GROUND = '#ebe9e3'
/** Floor shown around the stand on every side, m: just enough to anchor it, not to suggest aisles. */
export const GROUND_MARGIN = 1
/** Lock 410: black rosette and knob. */
export const LOCK = '#1d1e20'
export const CHROME = '#a4a6aa'
/** --ink, for lines and text drawn on the floor. */
export const INK = '#171613'
/** Fallback when a product has no colour. */
export const NO_COLOR = '#999'
/** Aluminium profiles: posts, rails, beams and textile frames. */
export const ALU_FINISH = { metalness: 0.4, roughness: 0.5 }

export interface BuildOptions {
  selection?: { wallId?: string; objectId?: string; textileId?: string; foilId?: string; roomId?: string; freeTextileId?: string; openingId?: string; shelfId?: string; shelfOnly?: boolean }
  /** Flat text on the floor (dimensions, area). Needs a canvas, so tests turn it off. */
  labels?: boolean
  /** Motif library for prints on textiles and foils. Without it they are drawn blank. */
  motifs?: Motif[]
  /** Called when a motif image has loaded, so the view can render again. */
  onLoad?: () => void
}

export interface BuildContext {
  v: Variant
  res: CalcResult
  opts: BuildOptions
  /** Stand width and depth, wall height, m. */
  W: number
  D: number
  H: number
  post: number
  feet: number
  prof: typeof rules.wall.profile
  root: THREE.Group
  /** Model point → world, at height y. */
  at: (p: Point, y?: number) => THREE.Vector3
  /** One material per layer and colour, so the view can dim a layer by changing a few materials. */
  mat: (layer: Layer, color: string, extra?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial
  add: (mesh: THREE.Mesh | THREE.Line | THREE.InstancedMesh, tag: Tag, parent?: THREE.Object3D) => THREE.Mesh | THREE.Line | THREE.InstancedMesh
  /** A box of `len` along a → b (centred on the segment), offset `off` along the left normal. */
  along: (a: Point, b: Point, len: number, h: number, thick: number, y: number, m: THREE.Material | THREE.Material[], tag: Tag, off?: number) => THREE.Mesh | THREE.Line | THREE.InstancedMesh
  mods: BuiltModule[]
  sel: NonNullable<BuildOptions['selection']>
}

export function buildContext(v: Variant, res: CalcResult, opts: BuildOptions): BuildContext {
  const { width: W, depth: D } = v.stand
  const H = wallHeight(rules)
  const { post, feet } = rules.wall
  const prof = rules.wall.profile
  const root = new THREE.Group()
  const at = (p: Point, y = 0) => new THREE.Vector3(p[0] - W / 2, y, p[1] - D / 2)

  // One material per layer and colour, so the view can dim a layer by changing a few materials.
  const mats = new Map<string, THREE.MeshStandardMaterial>()
  const mat = (layer: Layer, color: string, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const key = `${layer}|${color}|${JSON.stringify(extra)}`
    let m = mats.get(key)
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra })
      mats.set(key, m)
    }
    return m
  }
  const add = (mesh: THREE.Mesh | THREE.Line | THREE.InstancedMesh, tag: Tag, parent: THREE.Object3D = root) => {
    mesh.userData = tag
    if (mesh instanceof THREE.Mesh) {
      mesh.castShadow = tag.layer !== 'floor'
      mesh.receiveShadow = true
    }
    parent.add(mesh)
    return mesh
  }
  /** A box of `len` along a → b (centred on the segment), offset `off` along the left normal. */
  const along = (a: Point, b: Point, len: number, h: number, thick: number, y: number, m: THREE.Material | THREE.Material[], tag: Tag, off = 0) => {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const L = Math.hypot(dx, dz)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, h, thick), m)
    const mid: Point = [(a[0] + b[0]) / 2 + (-dz / L) * off, (a[1] + b[1]) / 2 + (dx / L) * off]
    mesh.position.copy(at(mid, y + h / 2))
    mesh.rotation.y = Math.atan2(-dz, dx)
    return add(mesh, tag)
  }
  const mods = builtModules(v)
  const sel = opts.selection ?? {}
  return { v, res, opts, W, D, H, post, feet, prof, root, at, mat, add, along, mods, sel }
}
