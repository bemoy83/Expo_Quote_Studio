// Drag and drop from Profilering into the 3D view: a frame or a motif lands on the wall face under the pointer, with a
// see-through box showing where (blue) or that it cannot (red).
import type * as THREE from 'three'
import { textileOffset } from '../../domain/textile/inFrame'
import { applyDrop, decorDrag, dropSpot, endDecorDrag, type DropSpot, type FaceTarget } from '../dnd'
import { rules } from '../env'
import { findMotif } from '../motifs'
import { clearOverlay, previewMesh, showOverlay, type Overlay } from './overlays'
import type { PointerProps } from './pointer/drag'
import type { SceneHits } from './pointer/hits'

/** Listen for drops on `el`. Returns the clean-up. */
export function listenForDrops(el: HTMLElement, scene: THREE.Scene, hits: SceneHits, props: () => PointerProps, render: () => void) {
  let preview: Overlay | null = null
  const clear = () => {
    preview = clearOverlay(scene, preview, render)
  }
  const show = (h: FaceTarget, spot: DropSpot) => {
    const key = [h.wallId, h.s, spot.on, spot.from, spot.to, spot.y0, !spot.error].join('|')
    preview = showOverlay(
      scene,
      preview,
      key,
      () => {
        const P = props()
        const w = P.v.walls.find((x) => x.id === h.wallId)
        if (!w) return null
        const off = spot.on === 'wall' ? rules.wall.profile.thickness / 2 + 0.006 : textileOffset(rules) + rules.textile.depth / 2 + 0.008
        return previewMesh(P.v.stand, w, h.s, spot, off, !spot.error)
      },
      render,
    )
  }
  const onDragOver = (e: DragEvent) => {
    const d = decorDrag(e)
    if (!d) return
    const h = hits.faceOf(hits.pick(e))
    const spot = h && dropSpot(props().v, d, h)
    // Over a wall the drop is always taken, so a refused one can say why
    e.preventDefault()
    e.dataTransfer!.dropEffect = h ? 'copy' : 'none'
    if (h && spot) show(h, spot)
    else clear()
  }
  const onDragLeave = (e: DragEvent) => {
    if (!el.contains(e.relatedTarget as Node | null)) clear()
  }
  const onDrop = (e: DragEvent) => {
    const d = decorDrag(e)
    clear()
    endDecorDrag()
    if (!d) return
    e.preventDefault()
    const P = props()
    const h = hits.faceOf(hits.pick(e))
    if (!h) return P.onToast(d.kind === 'textile' ? 'Slipp tekstilveggen på en vegg' : 'Slipp grafikken på en vegg eller en tekstilvegg')
    const r = applyDrop(P.v, d, h, (id) => findMotif(P.motifs, id)?.ratio ?? 1)
    if ('error' in r) return P.onToast(r.error)
    P.onEdit(() => r.v)
    P.onSelect(r.select)
    if (r.toast) P.onToast(r.toast)
  }
  el.addEventListener('dragover', onDragOver)
  el.addEventListener('dragleave', onDragLeave)
  el.addEventListener('drop', onDrop)
  return () => {
    el.removeEventListener('dragover', onDragOver)
    el.removeEventListener('dragleave', onDragLeave)
    el.removeEventListener('drop', onDrop)
    clear()
  }
}
