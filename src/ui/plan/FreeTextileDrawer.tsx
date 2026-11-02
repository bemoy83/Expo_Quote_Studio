// Drawer for a frittstående tekstilvegg: one face seen straight on, with the frame, feet, braces, splices and corner
// posts it is built with. Each face is printed, white or the customer's own textile. Laid out like the wall drawer:
// settings · graphics shelf · the face.
import { FlipHorizontal2, Trash2, X } from 'lucide-react'
import type { FreeFrame } from '../../calc/freeFrames'
import { removeFreeTextile, resizeFreeTextile, updateFace, type FaceKey } from '../../domain/freeTextile'
import type { Variant } from '../../domain/types'
import type { Motif } from '../../persistence/file'
import { ALU, ALU_POST, BORDER_STRONG, FABRIC, FEET, INK, INK_MUTED, LAYER_COLOR } from '../colors'
import { IconButton } from '../controls'
import { rules } from '../env'
import { count, fmt } from '../format'
import { findMotif } from '../motifs'
import type { PlanSelection } from './PlanView'
import { DIM, TXT } from './drawerText'
import { FillPicker, Print, Shelf, SmallDim } from './drawerParts'

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
  const fr = 0.04
  // Splices along the rails, from the frame start (the corner post's face when `from` is a corner)
  const splices = f.railCuts.slice(0, -1).reduce<number[]>((a, c) => [...a, (a[a.length - 1] ?? f.railStart) + c], [])
  const cornerAt = [f.corners.from ? x(0) : null, f.corners.to ? x(f.length) : null].filter((c): c is number => c !== null)
  const PAD = 0.18
  const fillName = F.fill === 'reuse' ? 'kundens duk' : F.fill === 'white' ? 'hvit duk' : 'trykk'

  return (
    <section className="wall-drawer drawer3" aria-label="Frittstående tekstilvegg sett forfra">
      <div className="wd-insp">
        <div className="wd-head">
          <i className="dot" style={{ background: LAYER_COLOR.textile }} />
          <h3>Frittstående vegg {f.pos}</h3>
          <IconButton icon={Trash2} label="Fjern tekstilvegg (Delete)" size={14} onClick={remove} />
          <IconButton icon={X} label="Lukk" size={14} onClick={p.onClose} />
        </div>
        <p className="wd-meta num">
          {[
            `${fmt(H, 2)} m høy`,
            count(f.supports.length, 'fot', 'føtter'),
            f.railCuts.length > 1 ? `skjøtt i ${f.railCuts.length}` : '',
            f.nCorners ? count(f.nCorners, 'hjørne', 'hjørner') : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="wd-dims">
          <SmallDim label="Lengde" value={f.length / 1000} decimals={2} onChange={setLength} />
        </div>
        <FillPicker value={F.fill} onChange={(fill) => p.onEdit((x) => updateFace(x, t.id, face, { fill, ...(fill === 'print' ? {} : { motif: null }) }))} />
        <p className="wd-meta num">
          Duk {F.W} × {F.H} mm · {fillName}
          {F.fileName ? ` · fil ${F.fileName}` : ''}
        </p>
        <div className="wd-foot">
          <div className="dd-swing">
            <span className="eyebrow">Side {face.toUpperCase()}</span>
            <IconButton icon={FlipHorizontal2} label={`Vis side ${face === 'a' ? 'B' : 'A'}`} size={15} onClick={() => p.onSelect({ freeTextileId: t.id, freeFace: face === 'a' ? 'b' : 'a' })} />
          </div>
        </div>
      </div>

      <Shelf
        label={F.fill === 'print' ? `Trykk side ${face.toUpperCase()} · ${m?.name ?? 'uten motiv'}` : 'Motiv · velg for trykk'}
        motifs={motifs}
        value={F.fill === 'print' ? (F.motif ?? null) : undefined}
        onPick={(mo) => p.onEdit((x) => updateFace(x, t.id, face, { motif: mo, ...(mo ? { fill: 'print' as const } : {}) }))}
        onUpload={p.onUpload}
      />

      <div className="wd-view">
        <svg className="wd-svg" viewBox={`${-PAD - 0.25} ${-PAD} ${W + 2 * PAD + 0.25} ${H + PAD + 0.32}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${f.pos} side ${face.toUpperCase()}, ${fmt(W, 2)} m`}>
          <rect x={0} y={0} width={W} height={H} fill={F.fill === 'white' ? '#fff' : FABRIC} />
          {m && <Print m={m} x={fr} y={fr} width={Math.max(0, W - 2 * fr)} height={Math.max(0, H - 2 * fr)} />}
          {!m && (
            <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="middle" style={TXT}>
              {F.fill === 'print' ? 'Trykk uten motiv' : F.fill === 'white' ? 'Hvit, uten grafikk' : 'Kundens duk'}
            </text>
          )}
          {/* Braces behind the textile, at every foot */}
          {f.supports.map((at, i) => (
            <line key={`b${i}`} x1={x(at)} y1={fr} x2={x(at)} y2={H - fr} stroke={ALU} strokeOpacity={0.35} strokeWidth={0.02} strokeDasharray=".05 .04" />
          ))}
          <rect x={fr / 2} y={fr / 2} width={W - fr} height={H - fr} fill="none" stroke={ALU} strokeWidth={fr} />
          {splices.map((at, i) => (
            <g key={`s${i}`}>
              <line x1={x(at)} y1={0} x2={x(at)} y2={fr} stroke={INK} strokeWidth={0.012} />
              <line x1={x(at)} y1={H - fr} x2={x(at)} y2={H} stroke={INK} strokeWidth={0.012} />
            </g>
          ))}
          {cornerAt.map((cx, i) => (
            <rect key={`c${i}`} x={Math.min(Math.max(cx - 0.03, 0), W - 0.06)} y={0} width={0.06} height={H} fill={ALU_POST} />
          ))}
          {/* Foot plates */}
          {f.supports.map((at, i) => (
            <rect key={`f${i}`} x={x(at) - f.foot.along / 2000} y={H} width={f.foot.along / 1000} height={0.03} fill={FEET} />
          ))}
          <line x1={-PAD} y1={H + 0.03} x2={W + PAD} y2={H + 0.03} stroke={BORDER_STRONG} strokeWidth={0.01} />

          {/* Dimensions */}
          <line x1={-0.2} y1={0} x2={-0.2} y2={H} stroke={BORDER_STRONG} strokeWidth={0.008} />
          <text transform={`translate(${-0.26} ${H / 2}) rotate(-90)`} textAnchor="middle" style={DIM}>
            {f.H} mm
          </text>
          <line x1={0} y1={H + 0.14} x2={W} y2={H + 0.14} stroke={BORDER_STRONG} strokeWidth={0.008} />
          <text x={W / 2} y={H + 0.29} textAnchor="middle" style={DIM}>
            {F.W} mm · side {face.toUpperCase()}
          </text>
          {f.supports.map((at, i) => (
            <text key={`ft${i}`} x={x(at)} y={H + 0.12} textAnchor="middle" style={{ ...DIM, fill: INK_MUTED, fontSize: '0.08px' }}>
              {at}
            </text>
          ))}
        </svg>
      </div>
      <div className="wd-hint">Dra veggen i planen for å flytte den · tallene under er føttenes plass i mm fra enden · Delete fjerner</div>
    </section>
  )
}
