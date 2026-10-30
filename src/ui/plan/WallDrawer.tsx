// Wall drawer (veggskuff): the selected wall seen straight on, one face at a time, under the plan or 3D view.
// Textile frames and foil decals are placed, moved and resized here. Without a selection it edits the wall itself:
// plate colour, door swing, remove wall.
import { FlipHorizontal2, Minus, MoveHorizontal, Plus, Trash2, X } from 'lucide-react'
import { useRef, type PointerEvent as RPointerEvent } from 'react'
import { production, wallLabel } from '../../calc/production'
import {
  addTextile,
  faceNormal,
  faces,
  felt,
  fillTextile,
  foilsOn,
  freeSpans,
  removeFoil,
  removeTextile,
  textileBox,
  textilesOn,
  updateFoil,
  updateTextile,
  type FaceSide,
} from '../../domain/decor'
import { eraseWalls, flipSwing, isPerimeterWall, setWallPlate } from '../../domain/edit'
import { wallLength, wallModules } from '../../domain/grid'
import type { Foil, TextileWall, Variant, Wall } from '../../domain/types'
import { builtModules } from '../../domain/walls'
import type { Motif } from '../../persistence/file'
import { wallHeight } from '../../rules/rules'
import { BORDER_STRONG, INK, INK_FAINT, INK_MUTED, LAYER_COLOR, SUNKEN } from '../colors'
import { Button, CommitInput, IconButton, Segmented } from '../controls'
import { plateColor, productOf, rules, wallPlates } from '../env'
import { fmt, mm } from '../format'
import { VariantChips } from '../panel/ProductRow'
import type { PlanSelection } from './PlanView'

interface Props {
  v: Variant
  selection: PlanSelection
  motifs: Motif[]
  onSelect: (s: PlanSelection) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onCheckpoint: () => void
  onToast: (text: string) => void
  onClose: () => void
}

const ALU = '#b9bcc0'
const ALU_DARK = '#8d9095'
const FEET = '#2a2b2e'
const FABRIC = 'color-mix(in oklab, var(--line-violet) 14%, rgb(var(--surface)))'
const EPS = 1e-6

/** Face names by where the face looks. */
function faceName(w: Wall, s: FaceSide): string {
  const [nx, ny] = faceNormal(w, s)
  if (ny > 0) return 'Mot front'
  if (ny < 0) return 'Mot bak'
  return nx > 0 ? 'Mot høyre' : 'Mot venstre'
}

export function WallDrawer(p: Props) {
  const { v, selection: sel, motifs } = p
  const svg = useRef<SVGSVGElement>(null)
  const w = v.walls.find((x) => x.id === sel.wallId)
  if (!w) return null
  const fs = faces(v, w)
  const s: FaceSide = sel.side && fs.includes(sel.side) ? sel.side : fs[0]
  const L = wallLength(w)
  const H = wallHeight(rules)
  const dir = s === 1 ? 1 : -1
  /** Along-wall offset → x in the drawing. The face is drawn as seen standing in front of it. */
  const u = (t: number) => (s === 1 ? t : L - t)
  const spanX = (a: number, b: number) => Math.min(u(a), u(b))
  const z = (h: number) => H - h

  const tex = textilesOn(v, w.id, s)
  const foils = foilsOn(v, w.id, s)
  const T = tex.find((t) => t.id === sel.textileId)
  const F = foils.find((f) => f.id === sel.foilId)
  const built = new Map(builtModules(v).map((m) => [m.key, m]))
  const mods = wallModules(w).map((m) => built.get(m.key))
  const motifOf = (id?: string) => (id ? motifs.find((m) => m.id === id) : undefined)
  const ratioOf = (id?: string) => motifOf(id)?.ratio ?? 0
  const label = wallLabel(w, v.stand)
  const select = (x: Partial<PlanSelection>) => p.onSelect({ wallId: w.id, side: s, ...x })

  // ---- Dragging in the drawing: move, width, height of a frame; move and size of a decal
  const drag = (e: RPointerEvent, kind: 'tmove' | 'twidth' | 'theight' | 'fmove' | 'fsize', item: TextileWall | Foil) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const scale = svg.current?.getScreenCTM()?.a ?? 1
    const x0 = e.clientX
    const y0 = e.clientY
    let moved = false
    if ('from' in item) select({ textileId: item.id })
    else select({ foilId: item.id })
    const onMove = (ev: PointerEvent) => {
      const du = (ev.clientX - x0) / scale
      const dz = -(ev.clientY - y0) / scale
      if (!moved) {
        if (Math.hypot(du, dz) * scale < 3) return
        moved = true
        p.onCheckpoint()
      }
      p.onEdit((x) => applyDrag(x, kind, item, du, dz), false)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const applyDrag = (x: Variant, kind: string, item: TextileWall | Foil, du: number, dz: number): Variant => {
    if ('from' in item) {
      const { bottom, height } = textileBox(item, rules)
      if (kind === 'tmove') {
        const moved = updateTextile(x, rules, item.id, { from: item.from + du * dir }, 'move')
        return updateTextile(moved, rules, item.id, { bottom: bottom + dz })
      }
      if (kind === 'theight') return updateTextile(x, rules, item.id, { height: height + dz })
      // The right edge in the drawing is the wall's end on one face and its start on the other
      if (dir === 1) return updateTextile(x, rules, item.id, { width: item.width + du })
      const end = item.from + item.width
      const sp = freeSpans(x, rules, w.id, s, textilesOn(x, w.id, s, item.id)).find(([a, b]) => item.from >= a - EPS && end <= b + EPS)
      const from = Math.min(end - rules.textile.minWidth, Math.max(sp?.[0] ?? 0, item.from - du))
      return updateTextile(x, rules, item.id, { from, width: end - from })
    }
    const r = ratioOf(item.motif)
    if (kind === 'fsize') return updateFoil(x, rules, item.id, { width: item.width + 2 * du }, r)
    const c = felt(rules, item.module).center + item.x + du * dir
    const module = Math.max(0, Math.min(L - 1, Math.floor(c)))
    const y = item.y + dz
    const next = updateFoil(x, rules, item.id, { module, x: c - (module + 0.5), y }, r)
    return next !== x || module === item.module ? next : updateFoil(x, rules, item.id, { x: c - (item.module + 0.5), y }, r)
  }

  const remove = () => {
    if (T) p.onEdit((x) => removeTextile(x, T.id))
    else if (F) p.onEdit((x) => removeFoil(x, F.id))
    select({})
  }

  /** With a frame or decal selected, the face control moves it to the other face of the wall. */
  const moveToSide = (side: FaceSide) => {
    const next = T ? updateTextile(v, rules, T.id, { side }) : F ? updateFoil(v, rules, F.id, { side }, ratioOf(F.motif)) : v
    if (next === v) return p.onToast(T ? 'Ingen ledig veggflate på den siden' : 'Feltet på den siden kan ikke ha folie')
    p.onEdit(() => next)
    select(T ? { side, textileId: T.id } : { side, foilId: F!.id })
  }

  const addFrame = () => {
    const r = addTextile(v, rules, w.id, s, L / 2)
    if (!r) return p.onToast('Ingen ledig veggflate på denne siden')
    p.onEdit(() => r.v)
    select({ textileId: r.id })
  }

  const piece = T ? production(v, rules.textile.inFrame, '').pieces.find((x) => x.textileId === T.id) : undefined
  const openings = v.openings.filter((o) => o.wallId === w.id)
  const doors = openings.filter((o) => productOf(o.product)?.opening === 'door')
  const plates = wallPlates()
  const ral = w.plate ?? v.defaultPlate
  const hint = T
    ? 'Dra rammen for å flytte · håndtakene endrer bredde og høyde · Delete fjerner'
    : F
      ? F.full
        ? 'Dra for å flytte til et annet veggfelt · Delete fjerner'
        : 'Dra for å flytte innenfor veggfeltet · hjørnet endrer størrelse · Delete fjerner'
      : 'Klikk en ramme eller grafikk for å redigere · grafikk legges på med pensel fra Profilering'

  const PAD = 0.18
  return (
    <section className="wall-drawer" aria-label="Vegg sett forfra">
      <div className="wd-insp">
        <div className="wd-head">
          <i className="dot" style={{ background: T ? LAYER_COLOR.textile : F ? INK_FAINT : LAYER_COLOR.walls }} />
          <h3>{T ? 'Tekstilvegg' : F ? 'Foliedekor' : label === 'Innervegg' ? 'Innervegg' : `Standvegg · ${label.toLowerCase()}`}</h3>
          {(T || F) && <IconButton icon={Trash2} label={T ? 'Fjern tekstilvegg (Delete)' : 'Fjern grafikk (Delete)'} size={14} onClick={remove} />}
          <IconButton icon={X} label="Lukk" size={14} onClick={p.onClose} />
        </div>
        <p className="wd-meta num">
          {T && piece
            ? `${fmt(T.width)} × ${fmt(textileBox(T, rules).height, 2)} m · ramme ${mm(piece.W / 1000)} × ${mm(piece.H / 1000)} mm · ${fmt(piece.area)} m² trykk`
            : F
              ? `Felt ${F.module + 1} · ${mm(F.width)} × ${mm(F.height)} mm`
              : `${L} m · ${wallModules(w).length - openings.length} ${L - openings.length === 1 ? 'plate' : 'plater'}${openings.length ? ` · ${openings.length} ${openings.length === 1 ? 'åpning' : 'åpninger'}` : ''}${tex.length ? ` · ${tex.length} ${tex.length === 1 ? 'tekstilvegg' : 'tekstilvegger'}` : ''}`}
        </p>
        {fs.length > 1 ? (
          <>
            {(T || F) && <div className="eyebrow">{T ? 'Rammen står' : 'Folien sitter'}</div>}
            <Segmented<FaceSide>
              inWell
              label={T || F ? 'Flytt til side' : 'Vis side'}
              value={s}
              onChange={(side) => (T || F ? moveToSide(side) : p.onSelect({ wallId: w.id, side }))}
              options={fs.map((x) => ({ value: x, label: faceName(w, x) }))}
            />
          </>
        ) : null}

        {T && (
          <>
            <Dim label="Bredde" value={T.width} onChange={(n) => p.onEdit((x) => updateTextile(x, rules, T.id, { width: n }))} />
            <Dim label="Høyde" value={textileBox(T, rules).height} decimals={2} onChange={(n) => p.onEdit((x) => updateTextile(x, rules, T.id, { height: n }))} />
            <Dim label="Fra gulv" value={textileBox(T, rules).bottom} min={0} onChange={(n) => p.onEdit((x) => updateTextile(x, rules, T.id, { bottom: n }))} />
            <MotifPicker motifs={motifs} value={T.motif} onChange={(m) => p.onEdit((x) => updateTextile(x, rules, T.id, { motif: m }))} />
            <Button icon={MoveHorizontal} onClick={() => p.onEdit((x) => fillTextile(x, rules, T.id))}>
              Fyll ledig vegg
            </Button>
          </>
        )}

        {F && (
          <>
            <div className="eyebrow">Dekning</div>
            <Segmented<boolean>
              inWell
              label="Dekning"
              value={F.full}
              onChange={(full) => p.onEdit((x) => updateFoil(x, rules, F.id, { full }, ratioOf(F.motif)))}
              options={[
                { value: false, label: 'Dekal' },
                { value: true, label: 'Helt veggfelt' },
              ]}
            />
            <p className="panel-note">{F.full ? `Dekker feltet mellom stolpene og profilene, ${rules.wall.plate.width} × ${rules.wall.plate.height} mm.` : 'Ligger innenfor ett veggfelt, aldri over en stolpe.'}</p>
            {!F.full && <Dim label="Bredde" value={F.width} decimals={2} step={0.05} min={0.1} onChange={(n) => p.onEdit((x) => updateFoil(x, rules, F.id, { width: n }, ratioOf(F.motif)))} />}
            <MotifPicker motifs={motifs} value={F.motif} onChange={(m) => p.onEdit((x) => updateFoil(x, rules, F.id, { motif: m }, ratioOf(m ?? undefined)))} />
          </>
        )}

        {!T && !F && (
          <>
            <div className="eyebrow">
              Veggplate · {plates.find((x) => x.ral === ral)?.name} · RAL {ral}
            </div>
            <VariantChips
              chips={plates.map((x) => ({ name: `${x.name} · RAL ${x.ral}`, color: x.color }))}
              selected={plates.findIndex((x) => x.ral === ral)}
              onSelect={(i) => p.onEdit((x) => setWallPlate(x, w.id, plates[i].ral!))}
            />
            <Button variant="primary" icon={Plus} onClick={addFrame}>
              Legg til tekstilvegg
            </Button>
            <div className="wd-actions">
              {doors.map((d, i) => (
                <Button key={d.id} variant="ghost" icon={FlipHorizontal2} onClick={() => p.onEdit((x) => flipSwing(x, d.id))}>
                  Snu dør{doors.length > 1 ? ` ${i + 1}` : ''}
                </Button>
              ))}
              <Button
                variant="ghost"
                icon={Trash2}
                onClick={() => {
                  p.onEdit((x) => eraseWalls(x, wallModules(w).map((m) => m.key)))
                  p.onClose()
                }}
              >
                Fjern veggen
              </Button>
            </div>
            {!isPerimeterWall(v.stand, w) && <p className="panel-note">Dra veggen i planen for å flytte den.</p>}
          </>
        )}
      </div>

      <div className="wd-view">
        <svg
          ref={svg}
          className="wd-svg"
          viewBox={`${-PAD - 0.25} ${-PAD} ${L + 2 * PAD + 0.25} ${H + PAD + 0.32}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={() => select({})}
          role="img"
          aria-label={`${label}, ${faceName(w, s).toLowerCase()}, ${L} m`}
        >
          {/* Wall: plates, openings, profiles, posts, feet */}
          {mods.map((m, i) => {
            const x = spanX(i, i + 1)
            if (m?.opening) {
              const door = productOf(m.opening.product)?.opening === 'door'
              return (
                <g key={i}>
                  <rect x={x + 0.02} y={z(H)} width={0.96} height={H} fill="none" stroke={BORDER_STRONG} strokeWidth={0.012} strokeDasharray=".05 .04" />
                  <text x={x + 0.5} y={z(1.05)} textAnchor="middle" style={TXT}>
                    {door ? 'dør' : 'forheng'}
                  </text>
                </g>
              )
            }
            const f = felt(rules, i)
            return (
              <g key={i}>
                <rect x={spanX(f.a, f.b)} y={z(H)} width={f.w} height={H - rules.wall.feet} fill={plateColor(m?.plate ?? w.plate ?? v.defaultPlate)} />
                <rect x={x} y={z(H)} width={1} height={rules.wall.profile.top} fill={ALU} />
                <rect x={x} y={z(f.y0)} width={1} height={rules.wall.profile.bottom} fill={ALU} />
              </g>
            )
          })}
          {Array.from({ length: L + 1 }, (_, i) => (
            <g key={`p${i}`}>
              <rect x={u(i) - rules.wall.post / 2} y={z(H)} width={rules.wall.post} height={H - rules.wall.feet} fill={ALU_DARK} />
              <rect x={u(i) - 0.012} y={z(rules.wall.feet)} width={0.024} height={rules.wall.feet} fill={FEET} />
            </g>
          ))}
          <line x1={-PAD} y1={H} x2={L + PAD} y2={H} stroke={BORDER_STRONG} strokeWidth={0.01} />

          {/* Foil decals */}
          {foils.map((f) => {
            const c = felt(rules, f.module).center + f.x
            const x = spanX(c - f.width / 2, c + f.width / 2)
            const m = motifOf(f.motif)
            const on = F?.id === f.id
            return (
              <g key={f.id} onPointerDown={(e) => drag(e, 'fmove', f)} style={{ cursor: 'move' }}>
                {m ? (
                  <image href={m.src} x={x} y={z(f.y + f.height / 2)} width={f.width} height={f.height} preserveAspectRatio={f.full ? 'xMidYMid slice' : 'none'} />
                ) : (
                  <rect x={x} y={z(f.y + f.height / 2)} width={f.width} height={f.height} fill={SUNKEN} />
                )}
                {on && <rect x={x - 0.012} y={z(f.y + f.height / 2) - 0.012} width={f.width + 0.024} height={f.height + 0.024} fill="none" stroke={INK} strokeWidth={0.014} />}
                {on && !f.full && (
                  <rect
                    x={x + f.width - 0.04}
                    y={z(f.y - f.height / 2) - 0.04}
                    width={0.08}
                    height={0.08}
                    rx={0.015}
                    fill={INK}
                    style={{ cursor: 'nwse-resize' }}
                    onPointerDown={(e) => drag(e, 'fsize', f)}
                  />
                )}
              </g>
            )
          })}

          {/* Textile frames */}
          {tex.map((t) => {
            const { bottom, height } = textileBox(t, rules)
            const x = spanX(t.from, t.from + t.width)
            const y = z(bottom + height)
            const m = motifOf(t.motif)
            const on = T?.id === t.id
            const fr = 0.04
            return (
              <g key={t.id} onPointerDown={(e) => drag(e, 'tmove', t)} style={{ cursor: 'move' }}>
                <rect x={x} y={y} width={t.width} height={height} fill={FABRIC} />
                {m && (
                  <image href={m.src} x={x + fr} y={y + fr} width={Math.max(0, t.width - 2 * fr)} height={Math.max(0, height - 2 * fr)} preserveAspectRatio="xMidYMid slice" />
                )}
                <rect x={x + fr / 2} y={y + fr / 2} width={t.width - fr} height={height - fr} fill="none" stroke={ALU} strokeWidth={fr} />
                {!m && (
                  <text x={x + t.width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" style={TXT}>
                    Uten motiv
                  </text>
                )}
                {on && <rect x={x - 0.014} y={y - 0.014} width={t.width + 0.028} height={height + 0.028} fill="none" stroke={INK} strokeWidth={0.016} />}
                {on && (
                  <>
                    <rect x={x + t.width - 0.035} y={y + height / 2 - 0.1} width={0.07} height={0.2} rx={0.015} fill={INK} style={{ cursor: 'ew-resize' }} onPointerDown={(e) => drag(e, 'twidth', t)} />
                    <rect x={x + t.width / 2 - 0.1} y={y - 0.035} width={0.2} height={0.07} rx={0.015} fill={INK} style={{ cursor: 'ns-resize' }} onPointerDown={(e) => drag(e, 'theight', t)} />
                  </>
                )}
              </g>
            )
          })}

          {/* Dimensions */}
          <line x1={-0.2} y1={0} x2={-0.2} y2={H} stroke={BORDER_STRONG} strokeWidth={0.008} />
          <text transform={`translate(${-0.26} ${H / 2}) rotate(-90)`} textAnchor="middle" style={DIM}>
            {mm(H)} mm
          </text>
          <line x1={0} y1={H + 0.14} x2={L} y2={H + 0.14} stroke={BORDER_STRONG} strokeWidth={0.008} />
          {Array.from({ length: L + 1 }, (_, i) => (
            <line key={`t${i}`} x1={i} y1={H + 0.1} x2={i} y2={H + 0.18} stroke={BORDER_STRONG} strokeWidth={0.008} />
          ))}
          <text x={L / 2} y={H + 0.29} textAnchor="middle" style={DIM}>
            {L} m · {fs.length > 1 ? faceName(w, s).toLowerCase() : 'innsiden'}
          </text>
        </svg>
        <div className="wd-hint">{hint}</div>
      </div>
    </section>
  )
}

const TXT = { font: '500 0.11px var(--font-ui)', fill: INK_MUTED, pointerEvents: 'none' as const }
const DIM = { font: '500 0.12px var(--font-numeric)', fill: INK_FAINT }

/** A length in metres with − / + and a field you can type in. */
function Dim({ label, value, onChange, step = 0.1, min = 0.5, decimals = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; decimals?: number }) {
  return (
    <div className="opt flush">
      <span className="lbl">{label}</span>
      <span className="wd-dim">
        <IconButton icon={Minus} size={14} label={`${label} −${fmt(step, 2)} m`} disabled={value <= min + EPS} onClick={() => onChange(Math.round((value - step) * 1000) / 1000)} />
        <CommitInput
          className="field num"
          aria-label={`${label} i meter`}
          inputMode="decimal"
          value={fmt(value, decimals)}
          selectOnFocus
          onCommit={(text) => {
            const n = Number(text.replace(',', '.').replace(/[^\d.]/g, ''))
            if (!Number.isFinite(n) || text.trim() === '') return false
            onChange(n)
          }}
        />
        <IconButton icon={Plus} size={14} label={`${label} +${fmt(step, 2)} m`} onClick={() => onChange(Math.round((value + step) * 1000) / 1000)} />
        <span className="num unit">m</span>
      </span>
    </div>
  )
}

function MotifPicker({ motifs, value, onChange }: { motifs: Motif[]; value?: string; onChange: (id: string | null) => void }) {
  const cur = motifs.find((m) => m.id === value)
  return (
    <div className="wd-motifs">
      <div className="eyebrow">Motiv · {cur ? cur.name : 'uten motiv'}</div>
      <div className="mot-grid">
        {[null, ...motifs].map((m) => {
          const on = (value ?? null) === (m?.id ?? null)
          return (
            <button key={m?.id ?? 'none'} type="button" className={on ? 'mot on' : 'mot'} title={m ? m.name : 'Uten motiv'} aria-label={m ? m.name : 'Uten motiv'} aria-pressed={on} onClick={() => onChange(m?.id ?? null)}>
              {m ? <img src={m.src} alt="" /> : <span className="none" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
