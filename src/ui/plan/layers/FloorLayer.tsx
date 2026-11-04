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
import { linePx, usePlanScale } from '../planScale'
import { GONE_FILL, useErasing } from './erasing'

/** Fill opacity of the muted floor (docs/arbeidstegning.md): a layer that is just visible while drawing something else. */
const MUTED_FILL = 0.18
/** Rolled floor (engangsteppe) a little stronger, so a thin carpet still reads. */
const MUTED_FILL_ROLL = 0.22

/**
 * Floor. Full: carpet tiles with a joint at every tile edge, rolled floor in lanes with numbers. Muted (the default
 * while drawing something else, and on the quote): a faint fill without joints, one area per product with a thin
 * outline.
 */
export function FloorLayer({ v, dim, full }: { v: Variant; dim: (...layers: Layer[]) => number; full: boolean }) {
  if (!full) return <MutedFloor v={v} dim={dim} />
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
            fillOpacity={t === goneTile ? GONE_FILL : undefined}
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

/** The floor as a muted layer: each product one faint area with a thin outline, no joints or lane numbers. */
function MutedFloor({ v, dim }: { v: Variant; dim: (...layers: Layer[]) => number }) {
  const sc = usePlanScale()
  const { gone, hatch } = useErasing()
  const goneTile = v.floor.tiles.find((t) => gone('floor', `${t.i},${t.j},${t.w},${t.h}`))
  const products = [...new Set(v.floor.tiles.map((t) => t.product))]
  return (
    <g opacity={dim('floor')} pointerEvents="none">
      {products.map((a) => {
        const hit = idx.byArtnr.get(a)
        if (!hit) return null
        const tiles = v.floor.tiles.filter((t) => t.product === a)
        const op = tiles.some((t) => t.roll) ? MUTED_FILL_ROLL : MUTED_FILL
        return (
          <g key={a}>
            {tiles.map((t) => (
              <rect
                key={`${t.i},${t.j}`}
                x={t.i * CELL}
                y={t.j * CELL}
                width={t.w * CELL}
                height={t.h * CELL}
                fill={hit.variant.color}
                fillOpacity={t === goneTile ? GONE_FILL : op}
              />
            ))}
            <path d={outlinePath(v.floor.tiles, a)} fill="none" stroke={jointColor(hit.variant.color)} strokeOpacity={0.6} strokeWidth={linePx(sc, 0.75)} />
          </g>
        )
      })}
      {goneTile && <rect x={goneTile.i * CELL} y={goneTile.j * CELL} width={goneTile.w * CELL} height={goneTile.h * CELL} fill={hatch} />}
    </g>
  )
}

/** The outline of all floor of one product: every cell edge with another product (or none) on the other side. */
export function outlinePath(tiles: FloorTile[], product: string): string {
  const owner = new Map<string, string>()
  for (const t of tiles) for (let i = t.i; i < t.i + t.w; i++) for (let j = t.j; j < t.j + t.h; j++) owner.set(`${i},${j}`, t.product)
  const mine = (i: number, j: number) => owner.get(`${i},${j}`) === product
  const d: string[] = []
  for (const [key, p] of owner) {
    if (p !== product) continue
    const [i, j] = key.split(',').map(Number)
    const x0 = i * CELL
    const y0 = j * CELL
    const x1 = x0 + CELL
    const y1 = y0 + CELL
    if (!mine(i, j - 1)) d.push(`M${x0} ${y0}H${x1}`)
    if (!mine(i, j + 1)) d.push(`M${x0} ${y1}H${x1}`)
    if (!mine(i - 1, j)) d.push(`M${x0} ${y0}V${y1}`)
    if (!mine(i + 1, j)) d.push(`M${x1} ${y0}V${y1}`)
  }
  return d.join('')
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
