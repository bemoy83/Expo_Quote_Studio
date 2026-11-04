// The floor in the plan: carpet tiles and rolled floor (engangsteppe) with lane numbers, and the previews of lanes
// being laid and of the strip cut off a lane.
import { CELL } from '../../../domain/grid'
import type { FloorTile, Variant } from '../../../domain/types'
import { INK, jointColor } from '../../colors'
import { fmt } from '../../format'
import { idx } from '../../env'
import type { Layer } from '../../tools'
import { across, lanesOf, type RollDir } from '../../../domain/floor/lanes'
import { Hatched } from '../Hatched'
import { JOINT_WIDTH } from '../planStyle'
import { GONE, useErasing } from './erasing'

/** Floor: carpet tiles with a joint at every tile edge, rolled floor without, and lane numbers on rolled floor. */
export function FloorLayer({ v, dim }: { v: Variant; dim: (...layers: Layer[]) => number }) {
  // Lanes of rolled floor: numbered per product, with the roll direction
  const rollLanes = [...new Set(v.floor.tiles.filter((t) => t.roll).map((t) => t.product))].flatMap((a) => {
    const hit = idx.byArtnr.get(a)
    return hit?.product.roll ? lanesOf(v.floor.tiles, a, hit.product.roll).map((l) => ({ ...l, color: jointColor(hit.variant.color) })) : []
  })
  // Tøm: the tile or lane about to go is dimmed and hatched
  const { gone, hatch } = useErasing()
  const goneTile = v.floor.tiles.find((t) => gone('floor', `${t.i},${t.j},${t.w},${t.h}`))
  return (
    <g opacity={dim('floor')} pointerEvents="none">
      {v.floor.tiles.map((t) => {
        const hit = idx.byArtnr.get(t.product)
        if (!hit) return null
        return (
          <rect
            key={`${t.i},${t.j}`}
            opacity={t === goneTile ? GONE : undefined}
            x={t.i * CELL}
            y={t.j * CELL}
            width={t.w * CELL}
            height={t.h * CELL}
            fill={hit.variant.color}
            stroke={hit.product.tiles || t.roll ? jointColor(hit.variant.color) : hit.variant.color}
            strokeWidth={hit.product.tiles || t.roll ? JOINT_WIDTH : 0.004}
          />
        )
      })}
      {goneTile && <rect x={goneTile.i * CELL} y={goneTile.j * CELL} width={goneTile.w * CELL} height={goneTile.h * CELL} fill={hatch} />}
      {rollLanes.map(({ n, tile: t, color }) => (
        <LaneMark key={`lane${t.i},${t.j}`} n={n} x={(t.i + t.w / 2) * CELL} y={(t.j + t.h / 2) * CELL} dir={t.roll!} length={(t.roll === 'x' ? t.w : t.h) * CELL} color={color} />
      ))}
    </g>
  )
}

/** Lanes a roll brush will lay: each with its joints, the roll direction and its width, cut lanes dashed. With
 * `stand`, a cut lane shows the strip cut off it, hatched, as waste. */
export function RollPreview({ tiles, color, roll, stand }: { tiles: FloorTile[]; color: string | undefined; roll: number; stand?: { nx: number; ny: number } }) {
  const mark = jointColor(color)
  return (
    <g pointerEvents="none">
      {tiles.map((t) => {
        const width = (t.roll === 'x' ? t.h : t.w) * CELL
        const cut = width < roll - 1e-9
        return (
          <g key={`${t.i},${t.j}`}>
            {cut && stand && !t.split && <Offcut t={t} roll={roll} stand={stand} />}
            <rect x={t.i * CELL} y={t.j * CELL} width={t.w * CELL} height={t.h * CELL} fill={color} fillOpacity={0.8} stroke={INK} strokeWidth={0.03} strokeDasharray={cut ? '.12 .08' : undefined} />
            <LaneMark n={cut ? `${fmt(width)} m kappet` : `${fmt(width)} m`} x={(t.i + t.w / 2) * CELL} y={(t.j + t.h / 2) * CELL} dir={t.roll!} length={(t.roll === 'x' ? t.w : t.h) * CELL} color={mark} />
          </g>
        )
      })}
    </g>
  )
}

/** The strip cut off a lane narrower than the roll, hatched as waste: over the stand edge when the lane lies against
 * it, else beside the lane. */
export function Offcut({ t, roll, stand }: { t: FloorTile; roll: number; stand: { nx: number; ny: number } }) {
  const c = across(t)
  const rest = Math.round(roll / CELL) - c.len
  if (rest <= 0 || t.split) return null
  const n = t.roll === 'x' ? stand.ny : stand.nx
  const start = c.start + c.len >= n || c.start > 0 ? c.start + c.len : c.start - rest
  const r = t.roll === 'x' ? { x: t.i, y: start, w: t.w, h: rest } : { x: start, y: t.j, w: rest, h: t.h }
  return <Hatched x={r.x * CELL} y={r.y * CELL} width={r.w * CELL} height={r.h * CELL} />
}

/** Lane number and an arrow along the roll direction, in the middle of a lane of rolled floor. */
export function LaneMark({ n, x, y, dir, length, color }: { n: number | string; x: number; y: number; dir: RollDir; length: number; color: string }) {
  const half = Math.min(0.45, length / 2 - 0.15)
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      {half > 0.1 && (
        <g transform={dir === 'y' ? 'rotate(90)' : undefined} stroke={color} strokeWidth={0.03} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1={-half} y1={0.2} x2={half} y2={0.2} />
          <polyline points={`${half - 0.1},0.12 ${half},0.2 ${half - 0.1},0.28`} />
        </g>
      )}
      <text x={dir === 'y' ? 0.12 : 0} y={dir === 'y' ? 0.08 : -0.02} textAnchor={dir === 'y' ? 'start' : 'middle'} style={{ font: '600 0.24px var(--font-numeric)', fill: color }}>
        {n}
      </text>
    </g>
  )
}
