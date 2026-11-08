// The note on a textile in 3D (ui/textileNote.ts, Bjørn 8.11.2026): the faint cross and the pill drawn on a see-through
// sheet over the face, so the frame still reads as bare and no motif seems chosen. One canvas per size and note, shared.
import * as THREE from 'three'
import { NOTE_ICON, NOTE_PILL, noteAngle, type TextileNote } from '../../textileNote'

/** Canvas pixels per metre of textile, and the longest side allowed. */
const PX_PER_M = 160
const MAX_PX = 2048
/** The pill's height on the textile, m. */
const PILL_M = 0.16
const MUTED = '#5b5953'

const canvases = new Map<string, HTMLCanvasElement>()

function noteCanvas(note: TextileNote, w: number, h: number): HTMLCanvasElement {
  const key = `${note.text}|${w.toFixed(2)}|${h.toFixed(2)}`
  const had = canvases.get(key)
  if (had) return had
  const k = Math.min(PX_PER_M, MAX_PX / Math.max(w, h))
  const cv = document.createElement('canvas')
  cv.width = Math.max(2, Math.round(w * k))
  cv.height = Math.max(2, Math.round(h * k))
  const g = cv.getContext('2d')
  if (g) {
    const [W, H] = [cv.width, cv.height]
    g.strokeStyle = 'rgba(23, 22, 19, 0.3)'
    g.lineWidth = Math.max(1.5, 0.006 * k)
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(W, H)
    g.moveTo(0, H)
    g.lineTo(W, 0)
    g.stroke()
    const ph = PILL_M * k
    const font = NOTE_PILL.font * ph
    g.font = `500 ${font}px system-ui, -apple-system, sans-serif`
    const pad = NOTE_PILL.pad * ph
    const icon = NOTE_PILL.icon * ph
    const gap = NOTE_PILL.gap * ph
    const pw = 2 * pad + icon + gap + g.measureText(note.text).width
    g.translate(W / 2, H / 2)
    g.rotate((noteAngle(w, h) * Math.PI) / 180)
    g.fillStyle = 'rgba(255, 255, 255, 0.9)'
    g.beginPath()
    if (g.roundRect) g.roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2)
    else g.rect(-pw / 2, -ph / 2, pw, ph)
    g.fill()
    g.save()
    g.translate(-pw / 2 + pad, -icon / 2)
    g.scale(icon / 24, icon / 24)
    g.strokeStyle = MUTED
    g.lineWidth = 2
    g.lineCap = 'round'
    g.lineJoin = 'round'
    for (const d of NOTE_ICON[note.icon]) g.stroke(new Path2D(d))
    g.restore()
    g.fillStyle = MUTED
    g.textBaseline = 'middle'
    g.fillText(note.text, -pw / 2 + pad + icon + gap, 0)
  }
  if (canvases.size > 64) canvases.clear()
  canvases.set(key, cv)
  return cv
}

/** A see-through material with the note for a face `w` × `h` m. */
export function noteMaterial(note: TextileNote, w: number, h: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0, depthWrite: false, roughness: 1, metalness: 0, ...extra })
  // Without a page (the build tests) the sheet stays empty
  if (typeof document === 'undefined') return m
  const tex = new THREE.CanvasTexture(noteCanvas(note, w, h))
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  m.map = tex
  m.opacity = 1
  return m
}
