// The 3D picture at the top of the quote (docs/arbeidstegning.md, «Tilbudet»): the stand from the 3D view's home angle,
// with shadows, drawn once and kept as an <img>, because browsers often leave WebGL canvases out of print and PDF.
// It is drawn again when a motif image has loaded and when the stand changes. Position numbers stand on the textile
// walls (calc/positions.ts), as HTML chips over the picture.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { CalcResult } from '../../calc/calc'
import { positions } from '../../calc/positions'
import { pointAlong } from '../../domain/grid'
import type { Point, Variant } from '../../domain/types'
import type { Motif } from '../../persistence/file'
import { catalog, rules } from '../env'
import { build, dispose } from './build'
import { HOME } from './camera'

/** Picture size in CSS px is the box's; drawn at twice that for print. */
const SCALE = 2
/** Height of a number on a textile wall, m. */
const CHIP_Y = 1.9
/** Wait after the last motif loads before the picture is taken again, ms. */
const SETTLE = 120

interface Shot {
  src: string
  chips: { pos: number; x: number; y: number }[]
}

export function QuoteRender({ v, res, motifs }: { v: Variant; res: CalcResult; motifs: Motif[] }) {
  const box = useRef<HTMLDivElement>(null)
  const [shot, setShot] = useState<Shot | null>(null)
  // Drawn for the box's size, and again when it changes (the page settling, a narrow window)
  const [size, setSize] = useState<[number, number]>([0, 0])
  useEffect(() => {
    const el = box.current!
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.clientWidth)
      const h = Math.round(el.clientHeight)
      setSize((s) => (s[0] === w && s[1] === h ? s : [w, h]))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const [w, h] = size
    if (!w || !h) return
    let live = true
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(SCALE)
    renderer.setSize(w, h, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 200)
    scene.add(new THREE.HemisphereLight('#ffffff', '#d6d2c8', 1.9))
    const { width: W, depth: D } = v.stand
    const sun = new THREE.DirectionalLight('#ffffff', 1.5)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0004
    sun.shadow.radius = 4
    sun.position.set(-W * 0.4, 9, D * 0.9 + 4)
    const r = Math.max(W, D)
    Object.assign(sun.shadow.camera, { left: -r, bottom: -r, right: r, top: r })
    sun.shadow.camera.updateProjectionMatrix()
    scene.add(sun, sun.target)

    let timer: ReturnType<typeof setTimeout> | undefined
    const take = () => {
      if (!live) return
      renderer.render(scene, camera)
      const at = (p: Point, y: number) => new THREE.Vector3(p[0] - W / 2, y, p[1] - D / 2).project(camera)
      const chips = textileChips(v, res).map(({ pos, p }) => {
        const n = at(p, CHIP_Y)
        return { pos, x: ((n.x + 1) / 2) * 100, y: ((1 - n.y) / 2) * 100 }
      })
      setShot({ src: renderer.domElement.toDataURL('image/png'), chips })
    }
    const onLoad = () => {
      clearTimeout(timer)
      timer = setTimeout(take, SETTLE)
    }
    const g = build(v, res, { motifs, onLoad })
    scene.add(g)
    fit(camera, W, D)
    take()
    return () => {
      live = false
      clearTimeout(timer)
      dispose(g)
      renderer.dispose()
      renderer.forceContextLoss()
    }
  }, [v, res, motifs, size])

  return (
    <div ref={box} className="qdoc-render">
      {shot && <img src={shot.src} alt="Standen i 3D" />}
      {shot?.chips.map((c, i) => (
        <span key={i} className="pos-chip num" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
          {c.pos}
        </span>
      ))}
    </div>
  )
}

/** Where the numbers of the textile walls stand in the plan: the middle of each frame. */
function textileChips(v: Variant, res: CalcResult): { pos: number; p: Point }[] {
  const p = positions(
    v,
    res.groups.flatMap((g) => g.lines),
    catalog,
  )
  return p.items.flatMap((i) => {
    if (i.kind === 'textile') {
      const t = v.textiles.find((x) => x.id === i.id)!
      const w = v.walls.find((x) => x.id === t.wallId)
      return w ? [{ pos: i.pos, p: pointAlong(w, t.from + t.width / 2) }] : []
    }
    if (i.kind === 'freeTextile') {
      const t = v.freeTextiles.find((x) => x.id === i.id)!
      return [{ pos: i.pos, p: [(t.from[0] + t.to[0]) / 2, (t.from[1] + t.to[1]) / 2] as Point }]
    }
    return []
  })
}

/** From the home angle, as close as the stand (floor to wall top) allows with a little air round it. */
function fit(camera: THREE.PerspectiveCamera, W: number, D: number) {
  const dir = new THREE.Vector3(Math.sin(HOME.az) * Math.cos(HOME.el), Math.sin(HOME.el), Math.cos(HOME.az) * Math.cos(HOME.el))
  const target = new THREE.Vector3(0, 1, 0)
  // The stand's box: floor to the top of the walls, plus what stands outside it (a free textile, a foot plate)
  const b = new THREE.Box3(new THREE.Vector3(-W / 2, 0, -D / 2), new THREE.Vector3(W / 2, rules.wall.height + rules.wall.feet + 0.05, D / 2))
  b.getCenter(target)
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z))
  // Step in from far away until a corner leaves the picture's inner 90 %
  let dist = Math.hypot(W, D) * 3 + 6
  const place = (d: number) => {
    camera.position.copy(target).addScaledVector(dir, d)
    camera.lookAt(target)
    camera.updateMatrixWorld(true)
  }
  for (let d = dist; d > 1; d *= 0.97) {
    place(d)
    if (corners.some((c) => {
      const n = c.clone().project(camera)
      return Math.abs(n.x) > 0.9 || Math.abs(n.y) > 0.9
    })) break
    dist = d
  }
  place(dist)
}
