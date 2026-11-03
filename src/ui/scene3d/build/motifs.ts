// Motif textures shared by every build: each picture is loaded and drawn onto a canvas once, and every plate's texture
// shares it (the iPad print fix). A print shows light grey until its picture has loaded.
import * as THREE from 'three'
import type { Crop } from '../../../domain/print'
import type { Motif } from '../../../persistence/file'

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
export function printMaterial(m: Motif, aspect: number, onLoad?: () => void, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const k = aspect / m.ratio
  return k > 1
    ? motifMaterial(m, [1, 1 / k], [0, (1 - 1 / k) / 2], onLoad, extra)
    : motifMaterial(m, [k, 1], [(1 - k) / 2, 0], onLoad, extra)
}

/** The part `crop` of the motif ([left, top, right, bottom] of the image) on a face: a plate of a stretched print. */
export function cropMaterial(m: Motif, crop: Crop, onLoad?: () => void, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return motifMaterial(m, [crop[2] - crop[0], crop[3] - crop[1]], [crop[0], 1 - crop[3]], onLoad, extra)
}
