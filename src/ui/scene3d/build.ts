// 3D scene derived from the stand model. No state of its own: build() turns a variant (and its calc) into a
// three.js group, and the view rebuilds it whenever the model changes.
// Model → world: x → x, y (toward the aisle) → z, height → y. The stand is centred on the origin.
import { RECIPES } from '../../foga/recipes'
import * as THREE from 'three'
import type { CalcResult } from '../../calc/calc'
import { alongRun } from '../../calc/freeFrames'
import { runDirection } from '../../domain/freeTextile'
import { FURNITURE_WHITE } from '../../catalog/defaultCatalog'
import { foilCenter, sideOf, textileBox, textileOffset } from '../../domain/decor'
import { cropBand, plateCrop, type Crop } from '../../domain/print'
import { doorHinge, doorRal, doorSwing } from '../../domain/doors'
import { CELL, pointAlong, pointKey, wallDirection, wallLength } from '../../domain/grid'
import { conflicts } from '../../domain/objects'
import { insetOutline, outlineSides } from '../../domain/outline'
import type { FloorTile, Point, Variant } from '../../domain/types'
import { builtModules, wallPoints, type BuiltModule } from '../../domain/walls'
import type { Motif } from '../../persistence/file'
import { doorInset, wallHeight } from '../../rules/rules'
import { idx, place, plateColor, productOf, rules } from '../env'
import { shade } from '../colors'
import { findMotif } from '../motifs'
import type { Highlight } from '../tools'

export type Layer = Exclude<Highlight, null>

/** What a mesh stands for. `pick` marks meshes the pointer can hit. */
export interface Tag {
  layer: Layer
  /** `roomId`: a room's see-through roof, the handle that moves the room. */
  pick?: { wallId?: string; objectId?: string; textileId?: string; foilId?: string; roomId?: string; freeTextileId?: string; openingId?: string }
}

/** Colours of the build system. Product colours come from the catalog. */
const ALU = '#9a9da1'
const BEAM = '#7d8084'
const CURTAIN = '#3a3c41'
const FABRIC = '#cfc7e6'
const STAND_FLOOR = '#e3e0d8'
/** Joint between carpet tiles, m: barely there, as on a laid floor. */
const JOINT = 0.006
/** Grey foot plates (750), darker than the floor so they show. */
const FOOT_PLATE = '#3d4045'
const SELECT = '#6aaecb'
const CONFLICT = '#d24b3f'
const GROUND = '#ebe9e3'
/** Floor shown around the stand on every side, m: just enough to anchor it, not to suggest aisles. */
const GROUND_MARGIN = 1
const HANDLE = '#55575b'
const CHROME = '#a4a6aa'
/** --ink, for lines and text drawn on the floor. */
const INK = '#171613'
/** Fallback when a product has no colour. */
const NO_COLOR = '#999'
/** Aluminium profiles: posts, rails, beams and textile frames. */
const ALU_FINISH = { metalness: 0.4, roughness: 0.5 }

export interface BuildOptions {
  selection?: { wallId?: string; objectId?: string; textileId?: string; foilId?: string; roomId?: string; freeTextileId?: string; openingId?: string }
  /** Flat text on the floor (dimensions, area). Needs a canvas, so tests turn it off. */
  labels?: boolean
  /** Motif library for prints on textiles and foils. Without it they are drawn blank. */
  motifs?: Motif[]
  /** Called when a motif image has loaded, so the view can render again. */
  onLoad?: () => void
}

/** Longest side of a motif in 3D. Uploads are already at most 640 px; the samples are SVG drawn at 4 x. */
const MOTIF_PX = 1024
/** A print shows this until its motif has loaded, instead of the black of a texture without a picture. */
const LOADING = '#d8d8d8'

interface MotifImage {
  /** The motif drawn once onto a canvas: the one picture every plate's texture shares, so it is sent to the GPU once. */
  source: THREE.Source<HTMLCanvasElement> | null
  failed: boolean
  waiting: (() => void)[]
}

/**
 * Motif pictures by source, shared by every build. The view rebuilds the scene on each edit (many times a second
 * while dragging); loading the image again each time left the print blank until it decoded, so it flickered.
 * Each image is drawn onto a canvas first: iPad Safari often gives a black texture straight from an SVG image
 * (the sample motifs are SVG), while a canvas works everywhere.
 */
const images = new Map<string, MotifImage>()

/** The motif picture for this source: loading, loaded or failed, started on first ask. */
function motifImage(src: string): MotifImage {
  const had = images.get(src)
  if (had) return had
  const e: MotifImage = { source: null, failed: false, waiting: [] }
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    const k = Math.min(1, MOTIF_PX / Math.max(w, h, 1))
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.round(w * k))
    cv.height = Math.max(1, Math.round(h * k))
    try {
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
      e.source = new THREE.Source(cv)
      e.source.needsUpdate = true
    } catch {
      e.failed = true
    }
    for (const f of e.waiting.splice(0)) f()
  }
  img.onerror = () => {
    e.failed = true
    for (const f of e.waiting.splice(0)) f()
  }
  img.src = src
  images.set(src, e)
  return e
}

/** A texture on the motif's shared picture. Each plate has its own, for its own part of the picture. */
function sharedTexture(source: THREE.Source<HTMLCanvasElement>, repeat: [number, number], offset: [number, number]): THREE.Texture {
  const tex = new THREE.Texture()
  tex.source = source
  // Mark it ready without bumping the picture's version (`needsUpdate` would): the renderer then sends the picture
  // to the GPU only when it is new, not once per plate and edit.
  tex.version = 1
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.repeat.set(...repeat)
  tex.offset.set(...offset)
  return tex
}

/** A material showing part of the motif. Light grey until the picture has loaded, then `onLoad` asks for a render. */
function motifMaterial(m: Motif, repeat: [number, number], offset: [number, number], onLoad?: () => void, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const e = motifImage(m.src)
  const mat = new THREE.MeshStandardMaterial({ color: LOADING, roughness: 0.9, metalness: 0, ...extra })
  const show = () => {
    if (!e.source) return
    mat.map = sharedTexture(e.source, repeat, offset)
    mat.color.set('#ffffff')
    mat.needsUpdate = true
  }
  if (e.source) show()
  else if (!e.failed)
    e.waiting.push(() => {
      show()
      onLoad?.()
    })
  return mat
}

/** The motif as a texture covering a face of the given aspect ratio (cropped, never stretched). */
function printMaterial(m: Motif, aspect: number, onLoad?: () => void, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const k = aspect / m.ratio
  return k > 1
    ? motifMaterial(m, [1, 1 / k], [0, (1 - 1 / k) / 2], onLoad, extra)
    : motifMaterial(m, [k, 1], [(1 - k) / 2, 0], onLoad, extra)
}

/** The part `crop` of the motif ([left, top, right, bottom] of the image) on a face: a plate of a stretched print. */
function cropMaterial(m: Motif, crop: Crop, onLoad?: () => void, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return motifMaterial(m, [crop[2] - crop[0], crop[3] - crop[1]], [crop[0], 1 - crop[3]], onLoad, extra)
}

export function build(v: Variant, res: CalcResult, opts: BuildOptions = {}): THREE.Group {
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

  // Ground and stand surface
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * GROUND_MARGIN, D + 2 * GROUND_MARGIN), new THREE.MeshStandardMaterial({ color: GROUND, roughness: 1 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.002
  ground.receiveShadow = true
  root.add(ground)
  const base = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat('floor', STAND_FLOOR, { roughness: 1 }))
  base.rotation.x = -Math.PI / 2
  add(base, { layer: 'floor' })

  // Floor tiles, one instanced mesh per product. Carpet tiles and lanes of roll leave a joint at their edges; other
  // rolled floor (vinyl) is seamless.
  const byProduct = new Map<string, FloorTile[]>()
  for (const t of v.floor.tiles) byProduct.set(t.product, [...(byProduct.get(t.product) ?? []), t])
  const tileGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  const tmp = new THREE.Object3D()
  for (const [a, tiles] of byProduct) {
    const hit = idx.byArtnr.get(a)
    const color = hit?.variant.color ?? NO_COLOR
    // Carpet tiles: each tile a hair smaller than its place, over a slightly darker bed. A finished floor, not a drawing.
    const layers: [string, number, number][] = hit?.product.tiles || hit?.product.roll ? [[shade(color, 0.18), 0, 0.002], [color, JOINT, 0.003]] : [[color, 0, 0.003]]
    for (const [c, joint, y] of layers) {
      const inst = new THREE.InstancedMesh(tileGeo, mat('floor', c, { roughness: 1 }), tiles.length)
      tiles.forEach((t, n) => {
        tmp.position.copy(at([(t.i + t.w / 2) * CELL, (t.j + t.h / 2) * CELL], y))
        tmp.scale.set(t.w * CELL - joint, 1, t.h * CELL - joint)
        tmp.updateMatrix()
        inst.setMatrixAt(n, tmp.matrix)
      })
      inst.receiveShadow = true
      add(inst, { layer: 'floor' })
    }
  }
  // 1 m grid, faint, on a stand without floor: a laid floor shows its own joints
  const grid: number[] = []
  if (!v.floor.tiles.length) {
    for (let x = 1; x < W; x++) grid.push(x - W / 2, 0.005, -D / 2, x - W / 2, 0.005, D / 2)
    for (let y = 1; y < D; y++) grid.push(-W / 2, 0.005, y - D / 2, W / 2, 0.005, y - D / 2)
  }
  if (grid.length) {
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(grid, 3))
    add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#000', transparent: true, opacity: 0.08 })), { layer: 'floor' })
  }

  // Walls: plate, top and bottom profile per module. Openings get a header panel and a door or curtain.
  const mods = builtModules(v)
  const sel = opts.selection ?? {}
  for (const m of mods) {
    const tag: Tag = m.opening ? { layer: 'openings', pick: { wallId: m.wallId, openingId: m.opening.id } } : { layer: 'walls', pick: { wallId: m.wallId } }
    const wallTag: Tag = { layer: 'walls', pick: { wallId: m.wallId } }
    const selected = sel.wallId === m.wallId && !sel.textileId && !sel.foilId
    const plate = mat('walls', plateColor(m.plate), selected ? { emissive: SELECT, emissiveIntensity: 0.35 } : {})
    const frame = mat('walls', ALU, ALU_FINISH)
    const len = rules.wall.cc - post
    along(m.a, m.b, len, prof.top, prof.thickness, H - prof.top, frame, wallTag)
    if (!m.opening) {
      along(m.a, m.b, len, prof.bottom, prof.thickness, feet, frame, wallTag)
      along(m.a, m.b, len - 0.004, H - prof.top - feet - prof.bottom, 0.012, feet + prof.bottom, plate, wallTag)
      continue
    }
    // The header plate belongs to the door: a click on it chooses the door
    along(m.a, m.b, len - 0.004, H - prof.top - rules.door.height, 0.012, rules.door.height, plate, tag)
    opening(m, tag)
  }

  function opening(m: BuiltModule, tag: Tag) {
    const o = m.opening!
    const w = v.walls.find((x) => x.id === o.wallId)
    if (!w) return
    const door = productOf(o.product)?.opening === 'door'
    if (!door) {
      // Curtain: a folded sheet in the opening
      const geo = new THREE.PlaneGeometry(rules.wall.cc - post - 0.02, rules.door.height - 0.03, 24, 1)
      const pos = geo.attributes.position
      for (let k = 0; k < pos.count; k++) pos.setZ(k, Math.sin((pos.getX(k) + 0.5) * Math.PI * 12) * 0.025)
      geo.computeVertexNormals()
      const mesh = new THREE.Mesh(geo, mat('openings', CURTAIN, { side: THREE.DoubleSide, roughness: 1 }))
      const dx = m.b[0] - m.a[0]
      const dz = m.b[1] - m.a[1]
      mesh.position.copy(at([(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2], (rules.door.height - 0.03) / 2 + 0.02))
      mesh.rotation.y = Math.atan2(-dz, dx)
      add(mesh, tag)
      return
    }
    // Door: closed leaf in its colour with a handle, and the swing on the floor
    const chosen = sel.openingId === o.id
    along(m.a, m.b, rules.door.swing, rules.door.height - 0.01, 0.04, 0, mat('openings', plateColor(doorRal(v, o)), chosen ? { emissive: SELECT, emissiveIntensity: 0.35 } : {}), tag)
    const [wx, wy] = wallDirection(w)
    const s = doorSwing(v.stand, w, o)
    const n: Point = [-wy * s, wx * s]
    // Leaf centred in the opening: hinge just in from its end of the module, handle near the free edge (as in the plan)
    const k = doorInset(rules)
    const hg = doorHinge(w, o)
    const [dx, dy] = hg.dir
    const a: Point = [hg.a[0] + dx * k, hg.a[1] + dy * k]
    const b: Point = [hg.b[0] - dx * k, hg.b[1] - dy * k]
    const hp: Point = [b[0] - dx * 0.08 + n[0] * 0.04, b[1] - dy * 0.08 + n[1] * 0.04]
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), mat('openings', HANDLE))
    handle.position.copy(at(hp, 1.05))
    handle.rotation.y = Math.atan2(-dy, dx)
    add(handle, tag)
    const r = rules.door.swing
    const pts: THREE.Vector3[] = []
    const a0 = Math.atan2(dy, dx)
    const a1 = Math.atan2(n[1], n[0])
    let da = a1 - a0
    if (da > Math.PI) da -= 2 * Math.PI
    if (da < -Math.PI) da += 2 * Math.PI
    for (let k = 0; k <= 24; k++) {
      const t = a0 + (da * k) / 24
      pts.push(at([a[0] + Math.cos(t) * r, a[1] + Math.sin(t) * r], 0.008))
    }
    pts.push(at(a, 0.008))
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: INK, dashSize: 0.05, gapSize: 0.05 }))
    line.computeLineDistances()
    add(line, { layer: 'openings' })
  }

  // Posts: wall posts and beam posts, from the calc so plan, 3D and quote agree
  const wallPts = wallPoints(mods)
  for (const p of res.posts) {
    const onWall = wallPts.has(pointKey(p))
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(post, H, post), mat(onWall ? 'walls' : 'beams', ALU, ALU_FINISH))
    mesh.position.copy(at(p, H / 2))
    add(mesh, { layer: onWall ? 'walls' : 'beams' })
  }

  // Støtteplater under walls that stand free, across the wall, on the floor
  const foot = RECIPES.wall.support.foot
  for (const { at: [x, y], orientation } of res.wallSupports) {
    const half = foot.across / 2000
    const [a, b]: [Point, Point] = orientation === 'h' ? [[x, y - half], [x, y + half]] : [[x - half, y], [x + half, y]]
    along(a, b, 2 * half, 0.012, foot.along / 1000, 0, mat('walls', FOOT_PLATE, ALU_FINISH), { layer: 'walls' })
  }

  // Beams (takdrager), top flush with the walls
  for (const s of res.beams.segments) {
    along(s.from, s.to, s.length, rules.beam.height, rules.beam.thickness, H - rules.beam.height, mat('beams', BEAM, ALU_FINISH), { layer: 'beams' })
  }

  // Textile walls (InFrame): a fabric box in an aluminium frame, standing in front of its face. The motif is
  // printed on the front.
  for (const t of v.textiles) {
    const w = v.walls.find((x) => x.id === t.wallId)
    if (!w) continue
    const L = wallLength(w)
    const from = Math.max(0, Math.min(L, t.from))
    const to = Math.max(from, Math.min(L, t.from + t.width))
    const s = sideOf(v, t)
    const off = s * (textileOffset(rules) + 0.005)
    const { bottom, height } = textileBox(t, rules)
    const h = Math.min(height, H - bottom)
    const glow = sel.textileId === t.id ? { emissive: SELECT, emissiveIntensity: 0.35 } : {}
    const fabric = mat('textile', FABRIC, { roughness: 1, ...glow })
    const alu = mat('textile', ALU, { ...ALU_FINISH, ...glow })
    const m = findMotif(opts.motifs, t.motif)
    const print = m ? printMaterial(m, (to - from) / h, opts.onLoad, glow) : fabric
    const faces = s === 1 ? [alu, alu, alu, alu, print, fabric] : [alu, alu, alu, alu, fabric, print]
    along(pointAlong(w, from), pointAlong(w, to), to - from - 0.02, h, rules.textile.depth, bottom, faces, { layer: 'textile', pick: { wallId: w.id, textileId: t.id } }, off)
  }

  // Frittstående tekstilvegger: a frame with textile on both faces (face A toward side 1), on foot plates
  for (const f of res.production.free) {
    const t = v.freeTextiles.find((x) => x.id === f.textileId)
    if (!t) continue
    const glow = sel.freeTextileId === t.id ? { emissive: SELECT, emissiveIntensity: 0.35 } : {}
    const alu = mat('textile', ALU, { ...ALU_FINISH, ...glow })
    const L = f.length / 1000
    const h = f.H / 1000
    const face = (x: (typeof f.faces)[number]) => {
      const m = x.fill === 'print' ? findMotif(opts.motifs, x.motif ?? undefined) : undefined
      if (m) return printMaterial(m, L / h, opts.onLoad, glow)
      return mat('textile', x.fill === 'white' ? '#ffffff' : FABRIC, { roughness: 1, ...glow })
    }
    const foot = rules.wall.feet / 10
    along(t.from, t.to, L, h, rules.textile.depth, foot, [alu, alu, alu, alu, face(f.faces[0]), face(f.faces[1])], { layer: 'textile', pick: { freeTextileId: t.id } })
    for (const at of f.supports) {
      const [x, y] = alongRun(t, at)
      const [dx, dy] = runDirection(t)
      const half = f.foot.along / 2000
      along([x - dx * half, y - dy * half], [x + dx * half, y + dy * half], 2 * half, foot, f.foot.across / 1000, 0, mat('textile', ALU, ALU_FINISH), { layer: 'textile' })
    }
  }

  // Foil decor: a thin print on the wall plate, inside its felt. A print over a door covers its header and its leaf.
  const doorAt = new Set(mods.filter((m) => m.opening && productOf(m.opening.product)?.opening === 'door').map((m) => `${m.opening!.wallId}|${m.opening!.module}`))
  for (const f of v.foils) {
    const w = v.walls.find((x) => x.id === f.wallId)
    if (!w) continue
    const s = sideOf(v, f)
    const c = foilCenter(rules, f)
    const m = findMotif(opts.motifs, f.motif)
    const glow = sel.foilId === f.id ? { emissive: SELECT, emissiveIntensity: 0.35 } : {}
    const tag: Tag = { layer: 'foil', pick: { wallId: w.id, foilId: f.id } }
    const blank = mat('foil', FABRIC, { roughness: 0.6, ...glow })
    const face = s * (rules.wall.profile.thickness / 2 + 0.002)
    if (!f.full || (!f.crop && !doorAt.has(`${f.wallId}|${f.module}`))) {
      const print = m ? printMaterial(m, f.width / f.height, opts.onLoad, glow) : blank
      along(pointAlong(w, c - f.width / 2), pointAlong(w, c + f.width / 2), f.width, f.height, 0.002, f.y - f.height / 2, print, tag, face)
      continue
    }
    const crop = plateCrop(f, m?.ratio ?? 0)
    const y0 = f.y - f.height / 2
    const y1 = f.y + f.height / 2
    const band = (lo: number, hi: number, width: number, off: number) => {
      const print = m ? cropMaterial(m, cropBand(crop, y0, y1, lo, hi), opts.onLoad, glow) : blank
      along(pointAlong(w, c - width / 2), pointAlong(w, c + width / 2), width, hi - lo, 0.002, lo, print, tag, off)
    }
    if (!doorAt.has(`${f.wallId}|${f.module}`)) {
      band(y0, y1, f.width, face)
      continue
    }
    // Door: the header plate above, the leaf (thicker, and down to the floor) below. The picture runs on over both.
    band(rules.door.height, y1, f.width, face)
    band(0, rules.door.height - 0.01, rules.door.swing, s * (0.02 + 0.002))
  }

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

  // Furniture: top, pole and foot from the footprint
  const bad = conflicts(v, place)
  for (const o of v.objects) {
    const r = idx.byArtnr.get(o.product)
    const f = r?.product.footprint
    if (!f) continue
    const color = r.variant.color ?? NO_COLOR
    const tag: Tag = { layer: 'objects', pick: { objectId: o.id } }
    const warn = bad.has(o.id) ? { emissive: CONFLICT, emissiveIntensity: 0.6 } : sel.objectId === o.id ? { emissive: SELECT, emissiveIntensity: 0.5 } : {}
    const body = mat('objects', color, { roughness: 0.6, ...warn })
    const metal = mat('objects', CHROME, { metalness: 0.6, roughness: 0.35, ...warn })
    const g = new THREE.Group()
    g.position.copy(at([o.x, o.y]))
    g.rotation.y = (-o.rot * Math.PI) / 180
    const top = 0.03
    const topGeo = f.round ? new THREE.CylinderGeometry(f.w / 2, f.w / 2, top, 40) : new THREE.BoxGeometry(f.w, top, f.d)
    const topMesh = new THREE.Mesh(topGeo, body)
    topMesh.position.y = f.h - top / 2
    add(topMesh, tag, g)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, f.h - top - 0.02, 16), color === FURNITURE_WHITE ? metal : body)
    pole.position.y = (f.h - top - 0.02) / 2 + 0.02
    add(pole, tag, g)
    const footR = Math.min(f.w, f.d) * 0.32
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(footR, footR, 0.02, 32), metal)
    foot.position.y = 0.01
    add(foot, tag, g)
    root.add(g)
  }

  if (opts.labels) labels(root, v)
  return root
}

/** Dimension lines along the front and right edge, lying on the floor. */
function labels(root: THREE.Group, v: Variant) {
  const { width: W, depth: D } = v.stand
  const lines: number[] = []
  const o = 0.55
  const tick = 0.12
  // front: x from -W/2 to W/2 at z = D/2 + o
  lines.push(-W / 2, 0.004, D / 2 + o, W / 2, 0.004, D / 2 + o)
  lines.push(-W / 2, 0.004, D / 2 + o - tick, -W / 2, 0.004, D / 2 + o + tick, W / 2, 0.004, D / 2 + o - tick, W / 2, 0.004, D / 2 + o + tick)
  // right: z from -D/2 to D/2 at x = W/2 + o
  lines.push(W / 2 + o, 0.004, -D / 2, W / 2 + o, 0.004, D / 2)
  lines.push(W / 2 + o - tick, 0.004, -D / 2, W / 2 + o + tick, 0.004, -D / 2, W / 2 + o - tick, 0.004, D / 2, W / 2 + o + tick, 0.004, D / 2)
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
  root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.45 })))
  const mm = (m: number) => String(Math.round(m * 1000)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  root.add(flatText(mm(W), 0, D / 2 + o + 0.28, 0, 0.26, 0.55))
  root.add(flatText(mm(D), W / 2 + o + 0.28, 0, Math.PI / 2, 0.26, 0.55))
}

function flatText(text: string, x: number, z: number, rot: number, size: number, alpha: number): THREE.Mesh {
  const px = 128
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  const font = `500 ${px}px "JetBrains Mono", ui-monospace, monospace`
  ctx.font = font
  const w = Math.ceil(ctx.measureText(text).width) + 16
  c.width = w
  c.height = px * 1.3
  ctx.font = font
  ctx.fillStyle = INK
  ctx.globalAlpha = alpha
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 8, c.height / 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const h = size
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry((h * c.width) / c.height, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }))
  mesh.rotation.x = -Math.PI / 2
  mesh.rotation.z = rot
  mesh.position.set(x, 0.006, z)
  mesh.userData = { label: true }
  return mesh
}

/** Free GPU memory of a built group. */
export function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose()
    const ms = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
    for (const x of ms) {
      ;(x as THREE.MeshBasicMaterial).map?.dispose()
      x.dispose()
    }
  })
}
