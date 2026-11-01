// Drawer for engangsteppe chosen with Velg, laid out like the wall drawer. A fill: the ways to lay it, cheapest first,
// with their waste, and its cut list. A lane placed by the seller: turn it, its length, its waste, take it off.
// Ink = what is laid now, muted fill = hover, no outlines.
import { RotateCw, Trash2, X } from 'lucide-react'
import { currentProposal, fillProposals, fillTilesOf, laneWaste, offered, removeFill, removeLane, resizeLane, rotateLane, relayFill, wasteKr, type Proposal } from '../../domain/carpet'
import { across, along, cellsIn, lanesOf, rollPieces, type RollPiece } from '../../domain/floor'
import { CELL } from '../../domain/grid'
import type { FloorTile, Variant } from '../../domain/types'
import { jointColor } from '../colors'
import { Button, IconButton } from '../controls'
import { idx, rules } from '../env'
import { fmt, kr } from '../format'
import type { PlanSelection } from './PlanView'
import { Dim } from './drawerParts'

interface Props {
  v: Variant
  selection: PlanSelection
  onSelect: (s: PlanSelection) => void
  onEdit: (fn: (v: Variant) => Variant) => void
  onClose: () => void
}

const nameOf = (a: string) => idx.byArtnr.get(a)?.variant.name.toLowerCase() ?? a
const colorOf = (a: string) => idx.byArtnr.get(a)?.variant.color
const rollOf = (a: string) => idx.byArtnr.get(a)?.product.roll ?? 2
const wasteText = (m2: number) => (m2 > 0.005 ? `svinn ${fmt(m2, 1)} m² · ${kr(wasteKr(m2, rules.carpet))} kr` : 'uten svinn')

export function CarpetDrawer(p: Props) {
  if (p.selection.fill) return <FillDrawer {...p} fill={p.selection.fill} />
  if (p.selection.lane) return <LaneDrawer {...p} lane={p.selection.lane} />
  return null
}

function FillDrawer({ v, fill, onEdit, onClose }: Props & { fill: string }) {
  const own = fillTilesOf(v, fill)
  if (!own.length) return null
  const product = own[0].product
  const roll = rollOf(product)
  const all = fillProposals(v, fill, roll, rules.carpet)
  const now = currentProposal(v, fill, all)
  const list = offered(all, 4, now)
  const laid = own.reduce((a, t) => a + t.w * t.h * CELL * CELL, 0)
  // Lanes numbered as in the plan (per colour over the whole stand), so the cut list names the lanes you see
  const pieces = rollPieces(lanesOf(v.floor.tiles, product, roll).filter((l) => l.tile.fill === fill))
  const lm = pieces.reduce((a, x) => a + x.length, 0)
  return (
    <section className="wall-drawer" aria-label="Engangsteppe, legging">
      <div className="wd-insp">
        <div className="wd-head">
          <i className="dot" style={{ background: colorOf(product) }} />
          <h3>Engangsteppe {nameOf(product)}</h3>
          <IconButton
            icon={Trash2}
            label="Fjern området (Delete)"
            size={14}
            onClick={() => {
              onEdit((x) => removeFill(x, fill))
              onClose()
            }}
          />
          <IconButton icon={X} label="Lukk" size={14} onClick={onClose} />
        </div>
        <p className="wd-meta num">
          {fmt(laid, 1)} m² lagt · {fmt(lm * roll, 1)} m² fra rull · {wasteText(lm * roll - laid)}
        </p>
        <div className="eyebrow">Kappliste</div>
        <CutList pieces={pieces} roll={roll} />
        <p className="panel-note">Kunden betaler lagt m². Forslagene er rangert etter intern kost: materiale, teip og arbeid. Satsene er forslag.</p>
      </div>
      <div className="wd-view cp-view">
        <div className="cp-props">
          {list.map((x) => (
            <button key={x.key} type="button" className="cp-prop" aria-pressed={x === now} onClick={() => x !== now && onEdit((y) => relayFill(y, fill, x.key, roll, rules.carpet))}>
              <Thumb p={x} color={colorOf(product)} />
              {x === all[0] && <span className="eyebrow">Lavest kost</span>}
              <span className="cp-prop-name">{x.name}</span>
              <span className="cp-prop-meta num">{wasteText(x.waste)}</span>
            </button>
          ))}
        </div>
        <div className="wd-hint">Velg et forslag for å legge området om · Delete fjerner området · Esc lukker</div>
      </div>
    </section>
  )
}

function LaneDrawer({ v, lane, onSelect, onEdit, onClose }: Props & { lane: { i: number; j: number } }) {
  const t = v.floor.tiles.find((x) => x.roll && x.i === lane.i && x.j === lane.j)
  if (!t) return null
  const roll = rollOf(t.product)
  const len = along(t).len * CELL
  const width = across(t).len * CELL
  const move = (r: { v: Variant; lane: FloorTile } | null) => {
    if (!r) return
    onEdit(() => r.v)
    onSelect({ lane: { i: r.lane.i, j: r.lane.j } })
  }
  const waste = laneWaste(t, roll)
  return (
    <section className="wall-drawer" aria-label="Engangsteppe, bane">
      <div className="wd-insp">
        <div className="wd-head">
          <i className="dot" style={{ background: colorOf(t.product) }} />
          <h3>Bane · {nameOf(t.product)}</h3>
          <IconButton
            icon={Trash2}
            label="Fjern banen (Delete)"
            size={14}
            onClick={() => {
              onEdit((x) => removeLane(x, lane))
              onClose()
            }}
          />
          <IconButton icon={X} label="Lukk" size={14} onClick={onClose} />
        </div>
        <p className="wd-meta num">
          {fmt(width, 2)} × {fmt(len, 2)} m lagt · {wasteText(waste)}
        </p>
        <Dim label="Lengde" value={len} step={CELL} decimals={2} min={CELL} onChange={(n) => move(resizeLane(v, lane, Math.round((n - len) / CELL)))} />
        <Button icon={RotateCw} onClick={() => move(rotateLane(v, lane))}>
          Snu banen (R)
        </Button>
        <p className="panel-note">Kappes {fmt(len + 0.2, 2)} m fra rullen med 10 cm i hver ende{width < roll - 1e-9 ? `, og ${fmt(roll - width, 2)} m av bredden er svinn` : ''}.</p>
      </div>
      <div className="wd-view">
        <LaneView t={t} roll={roll} />
        <div className="wd-hint">Lengre eller kortere i steg på 0,5 m, i enden borte fra standkanten · R snur · Delete fjerner · Esc lukker</div>
      </div>
    </section>
  )
}

/** The pieces cut from the roll, one by one: how long, and which lanes in the plan they become and how. */
function CutList({ pieces, roll }: { pieces: RollPiece[]; roll: number }) {
  const m = (n: number) => `${fmt(n, 2)} m`
  const names = (ns: number[]) => (ns.length === 1 ? `bane ${ns[0]}` : `bane ${ns.slice(0, -1).join(', ')} og ${ns[ns.length - 1]}`)
  return (
    <ol className="cut-list">
      {pieces.map((x, k) => {
        const ls = x.lanes
        const lanes = names(ls.map((l) => l.n))
        const what = x.endToEnd
          ? `Deles på langs i to halve à ${m(roll / 2)}, som legges etter hverandre som ${lanes}: ${m(ls[0].length)} + ${m(ls[1].length)}.`
          : x.split
            ? `Deles på langs i to à ${m(roll / 2)}: ${ls.map((l) => `bane ${l.n} ${m(l.length)}`).join(' og ')}${ls.some((l) => l.width < roll / 2 - 1e-9) ? ', kappet til bredden' : ''}.`
            : ls[0].width < roll - 1e-9
              ? `Blir ${lanes}, ${m(ls[0].length)} lang. Kappes til ${m(ls[0].width)} bredde, ${m(roll - ls[0].width)} av bredden er svinn.`
              : `Blir ${lanes}, ${m(ls[0].length)} lang i full bredde.`
        return (
          <li key={k} className="cut-list-row">
            <span className="cut-list-n num">{k + 1}</span>
            <span className="cut-list-body">
              <span className="cut-list-size num">
                Kapp {m(x.length)} av rullen
              </span>
              <span className="cut-list-note">{what}</span>
            </span>
          </li>
        )
      })}
      <li className="cut-list-foot">Hvert stykke kappes 10 cm lengre i hver ende og tilpasses ved legging.</li>
    </ol>
  )
}

/** The area with its lanes, joints in the carpet's joint colour. */
function Thumb({ p, color }: { p: Proposal; color: string | undefined }) {
  const cells = p.tiles.flatMap(cellsIn)
  const i0 = Math.min(...cells.map((c) => c[0]))
  const j0 = Math.min(...cells.map((c) => c[1]))
  const i1 = Math.max(...cells.map((c) => c[0])) + 1
  const j1 = Math.max(...cells.map((c) => c[1])) + 1
  const pad = 0.5
  return (
    <svg className="cp-thumb" viewBox={`${i0 - pad} ${j0 - pad} ${i1 - i0 + 2 * pad} ${j1 - j0 + 2 * pad}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {p.tiles.map((t) => (
        <rect key={`${t.i},${t.j}`} x={t.i} y={t.j} width={t.w} height={t.h} fill={color} stroke={jointColor(color)} strokeWidth={0.2} />
      ))}
    </svg>
  )
}

/** The lane on its own, the length along it and the strip cut off it hatched. */
function LaneView({ t, roll }: { t: FloorTile; roll: number }) {
  const L = along(t).len * CELL
  const w = across(t).len * CELL
  const color = colorOf(t.product)
  const pad = 0.4
  return (
    <svg className="wd-svg" viewBox={`${-pad} ${-pad} ${L + 2 * pad} ${roll + 2 * pad}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Bane ${fmt(L, 2)} m`}>
      <defs>
        <pattern id="cp-hatch-d" patternUnits="userSpaceOnUse" width={0.12} height={0.12} patternTransform="rotate(135)">
          <rect width={0.12} height={0.12} fill="rgb(var(--ink) / .06)" />
          <line x1={0} y1={0} x2={0} y2={0.12} stroke="rgb(var(--ink) / .45)" strokeWidth={0.025} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={L} height={w} fill={color} />
      {w < roll - 1e-9 && <rect x={0} y={w} width={L} height={roll - w} fill="url(#cp-hatch-d)" />}
      <text x={L / 2} y={w / 2} textAnchor="middle" dominantBaseline="middle" style={{ font: '600 0.2px var(--font-numeric)', fill: jointColor(color) }}>
        {fmt(L, 2)} m →
      </text>
      <text x={L / 2} y={roll + 0.28} textAnchor="middle" style={{ font: '500 0.15px var(--font-numeric)', fill: 'rgb(var(--ink-muted))' }}>
        rull {fmt(roll, 2)} m{w < roll - 1e-9 ? ` · ${fmt(w, 2)} m lagt, resten svinn` : ''}
      </text>
    </svg>
  )
}
