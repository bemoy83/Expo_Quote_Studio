// Motif library: a few sample motifs plus the customer's own uploads (stored in the sketch file as egneMotiver).
import type { Motif } from '../persistence/file'

/** A flat sample motif drawn as SVG, so the PoC ships without image files. */
function sample(id: string, name: string, ratio: number, bg: string, fg: string, text: string): Motif {
  const h = 100
  const w = Math.round(h * ratio)
  const fs = Math.min(w / (text.length * 0.62), h * 0.34)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 4}" height="${h * 4}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/><text x="50%" y="53%" fill="${fg}" font-family="system-ui,sans-serif" font-weight="700" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`
  return { id, name, ratio, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }
}

export const SAMPLE_MOTIFS: Motif[] = [
  sample('logo', 'Logo', 2.4, '#ffffff', '#1d3557', 'LOGO'),
  sample('hoved', 'Hovedmotiv', 1.6, '#3d5a80', '#ffffff', 'Hovedmotiv'),
  sample('prod', 'Produktbilde', 1, '#e9c46a', '#264653', 'Produkt'),
  sample('banner', 'Banner', 0.4, '#2a9d8f', '#ffffff', 'Ny'),
]

export const motifLibrary = (own: Motif[]) => [...SAMPLE_MOTIFS, ...own]

/** Read an image file, scale it to at most 640 px and return it as a motif. PNG keeps transparency. */
export function readMotif(file: File, taken: string[]): Promise<Motif> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('Kunne ikke lese bildet'))
    r.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Filen er ikke et bilde'))
      img.onload = () => {
        const sc = Math.min(1, 640 / Math.max(img.width, img.height))
        const cv = document.createElement('canvas')
        cv.width = Math.max(1, Math.round(img.width * sc))
        cv.height = Math.max(1, Math.round(img.height * sc))
        cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
        const png = file.type === 'image/png' || file.type === 'image/svg+xml'
        let n = 1
        while (taken.includes(`m${n}`)) n++
        resolve({
          id: `m${n}`,
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Motiv',
          ratio: img.width / img.height,
          src: cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85),
        })
      }
      img.src = String(r.result)
    }
    r.readAsDataURL(file)
  })
}
