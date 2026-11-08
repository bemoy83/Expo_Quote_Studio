// Drawer for a frittstående tekstilvegg: one face seen straight on, with the frame, feet, braces, splices and corner
// posts it is built with. Each face is printed, white or the customer's own textile. Laid out like the wall drawer:
// settings with the graphics shelf under them · the face.
import { FlipHorizontal2 } from 'lucide-react'
import { useRef } from 'react'
import type { FreeFrame } from '../../calc/textile/free'
import { removeFreeTextile, resizeFreeTextile, updateFace, type FaceKey } from '../../domain/textile/free'
import type { Variant } from '../../domain/types'
import type { Motif } from '../../persistence/file'
import { ALU_POST, BORDER_STRONG, FEET, LAYER_COLOR } from '../colors'
import { Dim, IconButton, Section } from '../controls'
import { rules } from '../env'
import { count, fmt } from '../format'
import { findMotif } from '../motifs'
import { type PlanSelection } from './selection'
import { DrawerHead, FillPicker, Shelf } from './drawerParts'
import { TextileFace } from './elevation'
import { planScale } from './planScale'
import { useElementSize } from '../useElementSize'
import { FreeElevationDims } from './wallDrawer/ElevationDims'
import { frame } from './wallDrawer/elevationMeasure'

interface Props {
  v: Variant
  frame: FreeFrame
  selection: PlanSelection
  motifs: Motif[]
  onUpload: (f: File) => void
  onSelect: (s: PlanSelection) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onToast: (text: string) => void
  onClose: () => void
}

export function FreeTextileDrawer(p: Props) {
  const { v, frame: f, motifs } = p
  // Measured on a box the svg fills, as in the wall drawer (WallElevation): the dimension margins are screen px
  const box = useRef<HTMLDivElement>(null)
  const size = useElementSize(box, true)
  const t = v.freeTextiles.find((x) => x.id === f.textileId)
  if (!t) return null
  const face: FaceKey = p.selection.freeFace ?? 'a'
  const F = f.faces[face === 'a' ? 0 : 1]
  const m = F.fill === 'print' ? findMotif(motifs, F.motif ?? undefined) : undefined
  const remove = () => {
    p.onEdit((x) => removeFreeTextile(x, t.id))
    p.onClose()
  }
  const setLength = (n: number) => {
    const next = resizeFreeTextile(v, rules, t.id, n)
    if (!next) return p.onToast('Tekstilveggen får ikke plass med den lengden')
    p.onEdit(() => next)
  }

  // Elevation in metres: the face from its left end as seen from the front of this face
  const W = F.W / 1000
  const H = f.H / 1000
  // Seen from face A, from → to runs left to right; from face B it is mirrored
  const x = (atMm: number) => (face === 'a' ? (atMm - F.start) / 1000 : W - (atMm - F.start) / 1000)
  // Splices along the rails, from the frame start (the corner post's face when `from` is a corner)
  const splices = f.railCuts.slice(0, -1).reduce<number[]>((a, c) => [...a, (a[a.length - 1] ?? f.railStart) + c], [])
  const cornerAt = [f.corners.from ? x(0) : null, f.corners.to ? x(f.length) : null].filter((c): c is number => c !== null)
  const PAD = 0.18
  const view = frame(size, W, H, [], { chainOver: true })
  const sc = planScale(1 / view.u, {})
  // Where the feet stand along the face, for the chain under it
  const feet = f.supports.map(x).filter((t) => t > 1e-6 && t < W - 1e-6)
  const braces = f.braces.map(x)

  return (
    <section className="wall-drawer drawer2" aria-label="Frittstående tekstilvegg sett forfra">
      <div className="wd-insp">
        <DrawerHead dot={LAYER_COLOR.textile} title={`Frittstående vegg ${f.pos}`} remove={{ label: 'Fjern tekstilvegg (Delete)', onClick: remove }} onClose={p.onClose} />
        <p className="wd-meta num">
          {[
            `${fmt(H, 2)} m høy`,
            count(f.supports.length, 'fot', 'føtter'),
            count(f.braces.length, 'stag', 'stag'),
            f.railCuts.length > 1 ? `skjøtt i ${f.railCuts.length}` : '',
            f.nCorners ? count(f.nCorners, 'hjørne', 'hjørner') : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <Section title="Mål">
          <div className="wd-dims">
            <Dim big label="Lengde" value={f.length / 1000} decimals={2} onChange={setLength} />
          </div>
        </Section>
        <FillPicker
          value={F.fill}
          aside={`side ${face.toUpperCase()}`}
          note={`${F.W} × ${F.H} mm${F.fileName ? ` · ${F.fileName}` : ''}`}
          onChange={(fill) => p.onEdit((x) => updateFace(x, t.id, face, { fill, ...(fill === 'print' ? {} : { motif: null }) }))}
        />
        <Shelf
          title="Motiv"
          aside={F.fill === 'print' ? (m?.name ?? 'ikke valgt') : 'velg for trykk'}
          motifs={motifs}
          value={F.fill === 'print' ? (F.motif ?? null) : undefined}
          onPick={(mo) => p.onEdit((x) => updateFace(x, t.id, face, { motif: mo, ...(mo ? { fill: 'print' as const } : {}) }))}
          onUpload={p.onUpload}
        />

        <div className="wd-foot">
          <Section
            title="Side"
            aside={face.toUpperCase()}
            tools={<IconButton icon={FlipHorizontal2} label={`Vis side ${face === 'a' ? 'B' : 'A'}`} size={15} onClick={() => p.onSelect({ freeTextileId: t.id, freeFace: face === 'a' ? 'b' : 'a' })} />}
          />
        </div>
      </div>

      <div className="wd-view">
        <div ref={box} className="wd-fit">
          <svg className="wd-svg" viewBox={view.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${f.pos} side ${face.toUpperCase()}, ${fmt(W, 2)} m`}>
            {/* Braces behind the textile, by the splices and at most 2 m apart (not at the feet), and the rail splices */}
            <TextileFace x={0} y={0} w={W} h={H} m={m} fill={F.fill} u={view.u} braces={braces} splices={splices.map(x)} />
            {cornerAt.map((cx, i) => (
              <rect key={`c${i}`} x={Math.min(Math.max(cx - 0.03, 0), W - 0.06)} y={0} width={0.06} height={H} fill={ALU_POST} />
            ))}
            {/* Foot plates */}
            {f.supports.map((at, i) => (
              <rect key={`f${i}`} x={x(at) - f.foot.along / 2000} y={H} width={f.foot.along / 1000} height={0.03} fill={FEET} />
            ))}
            <line x1={-PAD} y1={H + 0.03} x2={W + PAD} y2={H + 0.03} stroke={BORDER_STRONG} strokeWidth={0.01} />

            <FreeElevationDims title={`${f.pos} · side ${face.toUpperCase()}`} W={W} H={H} feet={feet} braces={braces} top={view.top} sc={sc} />
          </svg>
        </div>
      </div>
      <div className="wd-hint">Dra veggen i planen for å flytte den · målene under viser hvor føttene står · Delete fjerner</div>
    </section>
  )
}
