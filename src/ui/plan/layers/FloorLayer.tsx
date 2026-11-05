// The floor in the plan: carpet tiles and rolled floor (engangsteppe) with lane numbers, and the previews of lanes
// being laid and of the strip cut off a lane.
import { CELL } from '../../../domain/grid'
import type { FloorTile, Variant } from '../../../domain/types'
import { useId } from 'react'
import { INK, jointColor } from '../../colors'
import { fmt } from '../../format'
import { idx } from '../../env'
import type { Layer } from '../../tools'
import { across, lanesOf, type RollDir } from '../../../domain/floor/lanes'
import { jointWidth, LANE_MARK } from '../planStyle'
import { linePx, sizePx, usePlanScale } from '../planScale'
import { jointPath, outlinePath } from '../floorOutline'
import { HatchPattern } from './Previews'
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
  return full ? <FullFloor v={v} dim={dim} /> : <MutedFloor v={v} dim={dim} />
}

/** The floor in full colour: tiles with their joints, lanes with number and roll direction. */
function FullFloor({ v, dim }: { v: Variant; dim: (...layers: Layer[]) => number }) {
  const sc = usePlanScale()
  // Lanes of rolled floor: numbered per product, with the roll direction
  const rollLanes = [...new Set(v.floor.tiles.filter((t) => t.roll).map((t) => t.product))].flatMap((a) => {
    const hit = idx.byArtnr.get(a)
    return hit?.product.roll ? lanesOf(v.floor.tiles, a, hit.product.roll).map((l) => ({ ...l, color: jointColor(hit.variant.color) })) : []
  })
  const products = [...new Set(v.floor.tiles.map((t) => t.product))]
  const jointed = (t: FloorTile) => !!(t.roll || idx.byArtnr.get(t.product)?.product.tiles)
  // Tøm: the tile or lane about to go is dimmed and hatched
  const { gone, hatch } = useErasing()
  const goneTile = v.floor.tiles.find((t) => gone('floor', `${t.i},${t.j},${t.w},${t.h}`))
  return (
    <g opacity={dim('floor')} pointerEvents="none">
      {v.floor.tiles.map((t) => {
        const hit = idx.byArtnr.get(t.product)
        if (!hit) return null
        // A hairline in the floor's own colour closes the seams between pieces of a seamless floor
        return (
          <rect
            key={`${t.i},${t.j}`}
            fillOpacity={t === goneTile ? GONE_FILL : undefined}
            x={t.i * CELL}
            y={t.j * CELL}
            width={t.w * CELL}
            height={t.h * CELL}
            fill={hit.variant.color}
            stroke={hit.variant.color}
            strokeWidth={sizePx(sc, 0.5)}
          />
        )
      })}
      {products.map((a) => {
        const hit = idx.byArtnr.get(a)
        const of = v.floor.tiles.filter((t) => t.product === a && jointed(t))
        if (!hit || !of.length) return null
        return <path key={a} d={jointPath(v.floor.tiles, of, jointed)} fill="none" stroke={jointColor(hit.variant.color)} strokeWidth={jointWidth(sc)} />
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

/** Lanes a roll brush will lay: each with its edge in ink, the roll direction and its width, cut lanes dashed. With
 * `stand`, a cut lane shows the strip cut off it, hatched, as waste. */
export function RollPreview({ tiles, color, roll, stand }: { tiles: FloorTile[]; color: string | undefined; roll: number; stand?: { nx: number; ny: number } }) {
  const sc = usePlanScale()
  const mark = jointColor(color)
  return (
    <g pointerEvents="none">
      {tiles.map((t) => {
        const width = (t.roll === 'x' ? t.h : t.w) * CELL
        const cut = width < roll - 1e-9
        return (
          <g key={`${t.i},${t.j}`}>
            {cut && stand && !t.split && <Offcut t={t} roll={roll} stand={stand} />}
            <rect
              x={t.i * CELL}
              y={t.j * CELL}
              width={t.w * CELL}
              height={t.h * CELL}
              fill={color}
              fillOpacity={0.8}
              stroke={INK}
              strokeWidth={linePx(sc, 1)}
              strokeDasharray={cut ? `${sizePx(sc, 4)} ${sizePx(sc, 3)}` : undefined}
            />
            <LaneMark n={cut ? `${fmt(width)} m kappet` : `${fmt(width)} m`} x={(t.i + t.w / 2) * CELL} y={(t.j + t.h / 2) * CELL} dir={t.roll!} length={(t.roll === 'x' ? t.w : t.h) * CELL} color={mark} />
          </g>
        )
      })}
    </g>
  )
}

/** The strip cut off a lane narrower than the roll, in the plan's hatch (HATCH) as waste: over the stand edge when the
 * lane lies against it, else beside the lane. */
export function Offcut({ t, roll, stand }: { t: FloorTile; roll: number; stand: { nx: number; ny: number } }) {
  const id = `offcut${useId().replace(/:/g, '')}`
  const c = across(t)
  const rest = Math.round(roll / CELL) - c.len
  if (rest <= 0 || t.split) return null
  const n = t.roll === 'x' ? stand.ny : stand.nx
  const start = c.start + c.len >= n || c.start > 0 ? c.start + c.len : c.start - rest
  const r = t.roll === 'x' ? { x: t.i, y: start, w: t.w, h: rest } : { x: start, y: t.j, w: rest, h: t.h }
  return (
    <g pointerEvents="none">
      <HatchPattern id={id} />
      <rect x={r.x * CELL} y={r.y * CELL} width={r.w * CELL} height={r.h * CELL} fill="rgb(var(--ink) / .06)" />
      <rect x={r.x * CELL} y={r.y * CELL} width={r.w * CELL} height={r.h * CELL} fill={`url(#${id})`} />
    </g>
  )
}

/** Lane number and an arrow along the roll direction, in the middle of a lane of rolled floor, in screen pixels
 * (LANE_MARK): the number above the arrow, or beside it on a lane running down the plan. */
function LaneMark({ n, x, y, dir, length, color }: { n: number | string; x: number; y: number; dir: RollDir; length: number; color: string }) {
  const sc = usePlanScale()
  const px = (p: number) => sizePx(sc, p)
  const half = Math.min(px(LANE_MARK.arrow / 2), length / 2 - px(10))
  const head = px(LANE_MARK.head)
  const below = px(LANE_MARK.gap)
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      {half > px(6) && (
        <g transform={dir === 'y' ? 'rotate(90)' : undefined} stroke={color} strokeWidth={linePx(sc, LANE_MARK.stroke)} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1={-half} y1={below} x2={half} y2={below} />
          <polyline points={`${half - head},${below - head * 0.8} ${half},${below} ${half - head},${below + head * 0.8}`} />
        </g>
      )}
      <text
        x={dir === 'y' ? below + px(6) : 0}
        y={dir === 'y' ? px(LANE_MARK.font * 0.35) : -px(LANE_MARK.gap)}
        textAnchor={dir === 'y' ? 'start' : 'middle'}
        style={{ font: `600 ${px(LANE_MARK.font)}px var(--font-numeric)`, fill: color }}
      >
        {n}
      </text>
    </g>
  )
}
