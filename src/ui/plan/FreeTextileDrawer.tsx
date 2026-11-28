// Drawer for a textile wall on foot plates (its settings are TextileSettings, the same as on a wall, X18): one face seen straight on, with the frame, feet, braces, splices and corner
// posts it is built with. Each face is printed, white or the customer's own textile. Laid out like the wall drawer:
// settings with the graphics shelf under them · the face.
import { FlipHorizontal2 } from 'lucide-react'
import { useRef } from 'react'
import type { FreeFrame } from '../../calc/textile/free'
import type { FaceKey } from '../../domain/textile/free'
import type { Motif, Variant } from '../../domain/types'
import { ALU_POST, BORDER_STRONG, FEET, LAYER_COLOR } from '../colors'
import { IconButton, Section } from '../controls'
import { count, fmt, mm } from '../format'
import { findMotif } from '../motifs'
import { type PlanSelection } from './selection'
import { TextileSettings } from './TextileSettings'
import { DrawerHead } from './drawerParts'
import { Raise, TextileFace } from './elevation'
import { WIRE_ROOM } from './raiseDrawing'
import { hintLine, REUSE_NOTE } from './drawerText'
import { planScale } from './planScale'
import { useElementSize } from '../useElementSize'
import { FreeElevationDims } from './wallDrawer/ElevationDims'
import { frame } from './wallDrawer/elevationMeasure'
import { freeTextiles } from '../../domain/textile/mounts'
import { removeTextile } from '../../domain/textile/edit'
import { neighbourNotes, neighbourText, noteFor } from '../../domain/neighbour'
import { beamNote } from '../../calc/beams/beamLift'
import { rules } from '../env'

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
  const t = freeTextiles(v).find((x) => x.id === f.textileId)
  if (!t) return null
  const face: FaceKey = p.selection.face ?? 'a'
  const F = f.faces[face === 'a' ? 0 : 1]
  const m = F.fill === 'print' ? findMotif(motifs, F.motif ?? undefined) : undefined
  const remove = () => {
    p.onEdit((x) => removeTextile(x, t.id))
    p.onClose()
  }

  // Elevation in metres: the face from its left end as seen from the front of this face
  const W = F.W / 1000
  const H = f.H / 1000
  // Seen from face A, from → to runs left to right; from face B it is mirrored
  const x = (atMm: number) => (face === 'a' ? (atMm - F.start) / 1000 : W - (atMm - F.start) / 1000)
  // Splices along the rails, from the frame start (the corner post's face when `from` is a corner)
  const splices = f.railCuts.slice(0, -1).reduce<number[]>((a, c) => [...a, (a[a.length - 1] ?? f.railStart) + c], [])
  const cornerAt = [f.corners.from ? x(0) : null, f.corners.to ? x(f.length) : null].filter((c): c is number => c !== null)
  // Over the standard top it hangs in ceiling wires (Byggeregel X14, X18), a 92LTX corner in its own, over the top rail
  const over = f.wireAt ?? []
  const wires = (over.length ? [...over, ...(f.corners.from ? [0] : []), ...(f.corners.to ? [f.length] : [])] : []).map((a) => ({ x: Math.min(Math.max(x(a), 0), W), len: 0 }))
  const PAD = 0.18
  const view = frame(size, W, H, [], { chainOver: true, above: wires.length ? WIRE_ROOM : 0 })
  const sc = planScale(1 / view.u, {})
  // Where the feet stand along the face, for the chain under it
  const feet = f.supports.map(x).filter((t) => t > 1e-6 && t < W - 1e-6)
  const braces = f.braces.map(x)
  // As in the wall drawer: the neighbour's approval (Byggeregel N1) and the takdrager over it (T19) lead the hint
  const near = noteFor(neighbourNotes(v, rules), t.id)
  const beams = beamNote(v, rules, t.id)

  return (
    <section className="wall-drawer drawer2" aria-label="Frittstående tekstilvegg sett forfra">
      <div className="wd-insp">
        <DrawerHead dot={LAYER_COLOR.textile} title={`Tekstilvegg ${f.pos}`} remove={{ label: 'Fjern tekstilvegg (Delete)', onClick: remove }} onClose={p.onClose} />
        <p className="wd-meta num">
          {[
            `${fmt(H, 2)} m høy`,
            count(f.supports.length, 'fot', 'føtter'),
            // The print file of the face shown, as in the wall drawer; its name is on the quote and the work order
            F.fill === 'print' ? `fil ${mm(F.pw / 1000)} × ${mm(F.ph / 1000)}` : '',
            count(f.braces.length, 'stag', 'stag'),
            f.railCuts.length > 1 ? `skjøtt i ${f.railCuts.length}` : '',
            f.nCorners ? count(f.nCorners, 'hjørne', 'hjørner') : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {/* Byggeregel X18: the same settings as a frame on a wall; only «Fra gulv» is left out, it stands on the floor */}
        <TextileSettings v={v} id={t.id} face={face} motifs={motifs} onEdit={p.onEdit} onUpload={p.onUpload} onToast={p.onToast} />

        <div className="wd-foot">
          <Section
            title="Side"
            aside={face.toUpperCase()}
            tools={<IconButton icon={FlipHorizontal2} label={`Vis side ${face === 'a' ? 'B' : 'A'}`} size={15} onClick={() => p.onSelect({ textileId: t.id, face: face === 'a' ? 'b' : 'a' })} />}
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
            {wires.length > 0 && <Raise felts={[]} posts={[]} wires={wires} x={() => 0} />}
            {/* Foot plates */}
            {f.supports.map((at, i) => (
              <rect key={`f${i}`} x={x(at) - f.foot.along / 2000} y={H} width={f.foot.along / 1000} height={0.03} fill={FEET} />
            ))}
            <line x1={-PAD} y1={H + 0.03} x2={W + PAD} y2={H + 0.03} stroke={BORDER_STRONG} strokeWidth={0.01} />

            <FreeElevationDims title={`${f.pos} · side ${face.toUpperCase()}`} W={W} H={H} feet={feet} braces={braces} top={view.top} sc={sc} />
          </svg>
        </div>
      </div>
      <div className="wd-hint">{hintLine(near && neighbourText(near), beams, F.fill === 'reuse' && REUSE_NOTE, 'Dra veggen i planen for å flytte den', 'målene under viser hvor føttene står', 'Delete fjerner')}</div>
    </section>
  )
}
