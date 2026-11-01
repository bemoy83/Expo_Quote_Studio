// Small menu at the engangsteppe chosen with Velg. A lane placed by the seller: turn it, make it longer or shorter, see
// its waste, take it off. A fill: the ways to lay it, cheapest first, with their waste, and take it off.
// Same look as the quick picks: ink = what is laid now, muted fill = hover, no outlines.
import { Minus, Plus, RotateCw, Trash2 } from 'lucide-react'
import { currentProposal, fillProposals, fillTilesOf, laneWaste, offered, removeFill, removeLane, resizeLane, rotateLane, relayFill, wasteKr, type Proposal } from '../../domain/carpet'
import { along, cellsIn } from '../../domain/floor'
import { CELL } from '../../domain/grid'
import type { FloorTile, Variant } from '../../domain/types'
import { jointColor } from '../colors'
import { idx, rules } from '../env'
import { fmt, kr } from '../format'
import type { PlanSelection } from './PlanView'

export interface CarpetMenuProps {
  v: Variant
  selection: PlanSelection
  /** Where the chosen carpet is, px from the top left of the plan. */
  at: { x: number; y: number; w: number; h: number }
  /** Size of the plan, px. */
  box: { w: number; h: number }
  onEdit: (fn: (v: Variant) => Variant) => void
  onSelect: (s: PlanSelection) => void
}

const colourName = (a: string) => idx.byArtnr.get(a)?.variant.name ?? a
const rollOf = (a: string) => idx.byArtnr.get(a)?.product.roll ?? 2

export function CarpetMenu(p: CarpetMenuProps) {
  if (p.selection.fill) return <FillCard {...p} fill={p.selection.fill} />
  if (p.selection.lane) return <LanePill {...p} lane={p.selection.lane} />
  return null
}

const wasteText = (m2: number) => (m2 > 0.005 ? `svinn ${fmt(m2, 1)} m² · ${kr(wasteKr(m2, rules.carpet))} kr` : 'uten svinn')

function LanePill({ v, lane, at, box, onEdit, onSelect }: CarpetMenuProps & { lane: { i: number; j: number } }) {
  const t = v.floor.tiles.find((x) => x.roll && x.i === lane.i && x.j === lane.j)
  if (!t) return null
  const roll = rollOf(t.product)
  const len = along(t).len * CELL
  const move = (r: { v: Variant; lane: FloorTile } | null) => {
    if (!r) return
    onEdit(() => r.v)
    onSelect({ lane: { i: r.lane.i, j: r.lane.j } })
  }
  // Over the lane, or under it when there is no room above
  const above = at.y > 70
  const style = { left: Math.max(8, Math.min(box.w - 8, at.x + at.w / 2)), top: above ? at.y - 10 : at.y + at.h + 10 }
  return (
    <div className={`dock-pill cp-menu cp-pill ${above ? 'above' : 'below'}`} style={style} onPointerDown={(e) => e.stopPropagation()}>
      <span className="q-name">
        <span className="q-name-main">Bane · {colourName(t.product)}</span>
        <span className="q-name-meta num">{wasteText(laneWaste(t, roll))}</span>
      </span>
      <span className="q-sep" aria-hidden />
      <button type="button" className="q-btn" title="Snu banen (R)" aria-label="Snu banen" onClick={() => move(rotateLane(v, lane))}>
        <RotateCw size={15} />
      </button>
      <button type="button" className="q-btn" title="0,5 m kortere" aria-label="Kortere" disabled={len <= CELL} onClick={() => move(resizeLane(v, lane, -1))}>
        <Minus size={15} />
      </button>
      <span className="cp-len num">{fmt(len, 2)} m</span>
      <button type="button" className="q-btn" title="0,5 m lengre" aria-label="Lengre" onClick={() => move(resizeLane(v, lane, 1))}>
        <Plus size={15} />
      </button>
      <span className="q-sep" aria-hidden />
      <button
        type="button"
        className="q-btn"
        title="Fjern banen (Delete)"
        aria-label="Fjern banen"
        onClick={() => {
          onEdit((x) => removeLane(x, lane))
          onSelect({})
        }}
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

function FillCard({ v, fill, at, box, onEdit, onSelect }: CarpetMenuProps & { fill: string }) {
  const own = fillTilesOf(v, fill)
  if (!own.length) return null
  const product = own[0].product
  const roll = rollOf(product)
  const all = fillProposals(v, fill, roll, rules.carpet)
  const now = currentProposal(v, fill, all)
  const list = offered(all, 3, now)
  const laid = own.reduce((a, t) => a + t.w * t.h * CELL * CELL, 0)
  const W = 312
  const right = at.x + at.w + 12 + W < box.w
  const style = { left: right ? at.x + at.w + 12 : Math.max(8, at.x - 12 - W), top: Math.max(8, Math.min(at.y, box.h - 300)), width: W }
  return (
    <div className="popover cp-menu cp-card" style={style} onPointerDown={(e) => e.stopPropagation()}>
      <div className="cp-head">
        <span className="cp-title">Legging</span>
        <span className="cp-sub num">
          {colourName(product)} · {fmt(laid, 1)} m²
        </span>
        <span className="spacer" />
        <button
          type="button"
          className="q-btn"
          title="Fjern området (Delete)"
          aria-label="Fjern området"
          onClick={() => {
            onEdit((x) => removeFill(x, fill))
            onSelect({})
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>
      {list.map((x, n) => (
        <button key={x.key} type="button" className="cp-row" aria-pressed={x === now} onClick={() => x !== now && onEdit((y) => relayFill(y, fill, x.key, roll, rules.carpet))}>
          <Thumb p={x} color={idx.byArtnr.get(product)?.variant.color} />
          <span className="cp-row-text">
            {n === 0 && x === all[0] && <span className="eyebrow">Lavest kost</span>}
            <span className="cp-row-name">{x.name}</span>
            <span className="cp-row-meta num">{wasteText(x.waste)}</span>
          </span>
        </button>
      ))}
      <p className="cp-note">Kunden betaler lagt m². Rangert etter intern kost: materiale, teip og arbeid. Satsene er forslag.</p>
    </div>
  )
}

/** The area with its lanes, 76 × 52, joints in the carpet's joint colour. */
function Thumb({ p, color }: { p: Proposal; color: string | undefined }) {
  const cells = p.tiles.flatMap(cellsIn)
  const i0 = Math.min(...cells.map((c) => c[0]))
  const j0 = Math.min(...cells.map((c) => c[1]))
  const i1 = Math.max(...cells.map((c) => c[0])) + 1
  const j1 = Math.max(...cells.map((c) => c[1])) + 1
  const pad = 0.5
  const joint = jointColor(color)
  return (
    <svg className="cp-thumb" viewBox={`${i0 - pad} ${j0 - pad} ${i1 - i0 + 2 * pad} ${j1 - j0 + 2 * pad}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {p.tiles.map((t) => (
        <rect key={`${t.i},${t.j}`} x={t.i} y={t.j} width={t.w} height={t.h} fill={color} stroke={joint} strokeWidth={0.25} />
      ))}
    </svg>
  )
}
