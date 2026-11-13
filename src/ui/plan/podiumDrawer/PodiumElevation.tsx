// A side of a counter of Disker og podier seen from outside (trinn 2): its posts, rails and parts, each split by the
// shelves of its section into light openings (Byggeregler K16, K19), each a plate in the counter's colour, open to the
// inside or a sliding door (K17), what is chosen toned; under it the parts' outer lengths and the whole, to the left the
// shelves and the height from the floor (CC) and the outer height. A click on a part chooses the light opening under
// the pointer (the part when it has no shelves), a click on what is chosen goes back to the whole side. On top of each
// section a grip «CC 750» sets its height (K18), on each shelf rail a grip «Hylle 500» moves the shelf (K19): both
// snap to the 250 grid, show live and are set on release. Print (K20) shows its share of the motif in each window of
// plate and door; a decal is chosen by a click and moved or scaled by its handles, set on release.
import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import type { Motif } from '../../../domain/types'
import { HEIGHTS } from '../../../domain/podiums'
import { shelfStop } from '../../../domain/podiumShelves'
import { RECIPES } from '../../../foga/recipes'
import { ALU, ALU_POST, BORDER_STRONG, INK, INK_MUTED, SUNKEN, SURFACE } from '../../colors'
import { useElementSize } from '../../useElementSize'
import { Chain } from '../DimChain'
import { DIM_NEAR as NEAR, DIM_TOTAL as TOTAL } from '../dims'
import { planScale, sizePx } from '../planScale'
import { frame } from '../wallDrawer/elevationMeasure'
import { findMotif } from '../../motifs'
import { Handles, Print, type Edge } from '../drawerParts'
import { lightBands, type ElevationDecal, type ElevationPart, type ElevationPrint } from './podiumView'

const R = RECIPES.counter
const RAIL = R.railHeight / 1000
const POST = R.postSize / 1000
/** How far a door leaf goes past the middle, m (K17). */
const DOOR = R.door.overlap / 1000

/** What is chosen on the side: a part (left to right) and in it a light opening (from the floor), or the whole part. */
export interface ElevationPick {
  part: number
  light?: number
}

interface Props {
  parts: ElevationPart[]
  /** Outer length and the highest CC, mm. */
  length: number
  h: number
  title: string
  fill: string
  /** None: the whole side. */
  chosen?: ElevationPick
  onPick: (p: ElevationPick | undefined) => void
  /** The section `section` (index in the counter) dragged to CC `h`. */
  onHeight?: (section: number, h: number) => void
  /** The shelf at CC `from` in section `section` dragged to `to`. */
  onShelf?: (section: number, from: number, to: number) => void
  /** Print and decals on the side (K20), and the motifs they show. */
  prints?: ElevationPrint[]
  decals?: ElevationDecal[]
  motifs?: Motif[]
  /** The decal chosen; a click on a decal chooses it. */
  decal?: string
  onDecal?: (id: string | undefined) => void
  /** Decal `id` moved or scaled: its new size and centre height (mm) and how far its centre went right. */
  onDecalBox?: (id: string, box: { w: number; h: number; dx: number; y: number }) => void
}

/** A decal being moved (`move`) or scaled by an edge, from where the pointer went down (m in the drawing). */
interface DecalDrag {
  id: string
  edge: Edge | 'move'
  sx: number
  sy: number
  from: { x0: number; x1: number; y0: number; y1: number }
  box: { x0: number; x1: number; y0: number; y1: number }
}

type Drag = { section: number; y0: number } & ({ kind: 'top'; h0: number; h: number } | { kind: 'shelf'; from: number; to: number; h: number; shelves: number[] })

/** The nearest height on the grid (K18). */
const snap = (mm: number) => HEIGHTS.reduce((a, b) => (Math.abs(b - mm) < Math.abs(a - mm) ? b : a))

export function PodiumElevation({ parts: given, length, h: hTop, title, fill, chosen, onPick, onHeight, onShelf, prints = [], decals = [], motifs = [], decal, onDecal, onDecalBox }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const size = useElementSize(box, true)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [dd, setDd] = useState<DecalDrag | null>(null)
  // While a top or a shelf is dragged its section is drawn as it would be, in a frame as high as the highest (no rescaling)
  const parts = drag
    ? given.map((p) => {
        if (p.part.section !== drag.section) return p
        if (drag.kind === 'top') return { ...p, h: drag.h }
        return { ...p, shelves: p.shelves.map((y) => (y === drag.from ? drag.to : y)) }
      })
    : given
  const h = drag ? Math.max(...parts.map((p) => p.h)) : hTop
  const L = length / 1000
  const H = ((drag ? HEIGHTS[HEIGHTS.length - 1] : h) + R.railHeight) / 1000
  const view = frame(size, L, H, [], { chainOver: true })
  const sc = planScale(1 / view.u, {})
  const px = (n: number) => sizePx(sc, n)
  const x = (mm: number) => mm / 1000
  /** The drawing's y (floor at H, down) of CC `mm`: the underside of a rail standing there. */
  const yAt = (mm: number) => H - mm / 1000
  const nodes = [...new Set(parts.flatMap((p) => [p.n0, p.n1]))].sort((a, b) => a - b)
  const post = (n: number) => {
    const c = x(n)
    const x0 = Math.min(Math.max(c - POST / 2, 0), L - POST)
    // As high as the highest part it holds
    const hi = Math.max(...parts.filter((p) => Math.abs(p.n0 - n) < 1e-6 || Math.abs(p.n1 - n) < 1e-6).map((p) => p.h))
    return <rect key={`n${n}`} x={x0} y={yAt(hi + R.railHeight)} width={POST} height={(hi + R.railHeight) / 1000} fill={ALU_POST} />
  }
  const chainTs = [0, ...nodes.slice(1, -1).map(x), L]
  // The shelves from the floor, then the top (K19): one chain to the left
  const shelfYs = [...new Set(parts.flatMap((p) => p.shelves))].filter((y) => y < h).sort((a, b) => b - a)
  const svgPt = (e: PointerEvent) => {
    const m = svg.current?.getScreenCTM()
    return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : { x: 0, y: 0 }
  }
  const svgY = (e: PointerEvent) => svgPt(e).y
  // K20: a decal moved by its body or scaled by an edge, in mm (y up), no smaller than 50
  const decalDown = (e: PointerEvent, d: ElevationDecal, edge: Edge | 'move') => {
    e.stopPropagation()
    ;(svg.current as Element | null)?.setPointerCapture(e.pointerId)
    const q = svgPt(e)
    const box = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 }
    setDd({ id: d.id, edge, sx: q.x, sy: q.y, from: box, box })
    onDecal?.(d.id)
  }
  const decalMove = (e: PointerEvent) => {
    if (!dd) return
    const q = svgPt(e)
    const dx = (q.x - dd.sx) * 1000
    const dy = -(q.y - dd.sy) * 1000
    const f = dd.from
    const MIN = 50
    const b = { ...f }
    if (dd.edge === 'move') Object.assign(b, { x0: f.x0 + dx, x1: f.x1 + dx, y0: f.y0 + dy, y1: f.y1 + dy })
    else {
      if (dd.edge.includes('l')) b.x0 = Math.min(f.x0 + dx, f.x1 - MIN)
      if (dd.edge.includes('r')) b.x1 = Math.max(f.x1 + dx, f.x0 + MIN)
      if (dd.edge.includes('t')) b.y1 = Math.max(f.y1 + dy, f.y0 + MIN)
      if (dd.edge.includes('b')) b.y0 = Math.min(f.y0 + dy, f.y1 - MIN)
    }
    setDd({ ...dd, box: b })
  }
  const decalUp = () => {
    if (!dd) return
    const { from: f, box: b } = dd
    if (JSON.stringify(f) !== JSON.stringify(b)) onDecalBox?.(dd.id, { w: Math.round(b.x1 - b.x0), h: Math.round(b.y1 - b.y0), dx: Math.round((b.x0 + b.x1 - f.x0 - f.x1) / 2), y: Math.round((b.y0 + b.y1) / 2) })
    setDd(null)
  }
  const sections = [...new Set(parts.map((p) => p.part.section))].map((section) => {
    const ps = parts.filter((p) => p.part.section === section)
    return { section, h: ps[0].h, shelves: ps[0].shelves, x: x((Math.min(...ps.map((p) => p.x0)) + Math.max(...ps.map((p) => p.x1))) / 2) }
  })
  // The chosen part or light opening, drawn over the print
  const tints: ReactNode[] = []
  const pick = (i: number, light: number | undefined) => onPick(chosen?.part === i && chosen.light === light ? undefined : { part: i, light })

  /** A grip at (cx, cy) labelled `label`, dragged up and down. */
  const grip = (key: string, cx: number, cy: number, label: string, live: boolean, start: (y0: number) => Drag, move: (d: Drag, mm: number) => Drag, done: (d: Drag) => void) => {
    const w = px(label.length * 6 + 12)
    const gh = px(16)
    return (
      <g
        key={key}
        style={{ cursor: 'ns-resize', touchAction: 'none' }}
        aria-label={`Dra: ${label}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation()
          ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
          setDrag(start(svgY(e)))
        }}
        onPointerMove={(e) => {
          if (!drag) return
          const next = move(drag, (drag.y0 - svgY(e)) * 1000)
          if (JSON.stringify(next) !== JSON.stringify(drag)) setDrag(next)
        }}
        onPointerUp={() => {
          if (drag) done(drag)
          setDrag(null)
        }}
        onPointerCancel={() => setDrag(null)}
      >
        <rect x={cx - w / 2} y={cy - gh / 2} width={w} height={gh} rx={gh / 2} style={{ fill: live ? INK : SURFACE, filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.25))' }} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="num" style={{ font: `500 ${px(9.5)}px var(--font-ui)`, fill: live ? SURFACE : INK }} pointerEvents="none">
          {label}
        </text>
      </g>
    )
  }
  const topGrip = (t: (typeof sections)[number]) =>
    grip(
      `t${t.section}`,
      t.x,
      yAt(t.h + R.railHeight / 2),
      `CC ${t.h}`,
      drag?.kind === 'top' && drag.section === t.section,
      (y0) => ({ kind: 'top', section: t.section, y0, h0: t.h, h: t.h }),
      (d, mm) => (d.kind === 'top' ? { ...d, h: snap(d.h0 + mm) } : d),
      (d) => {
        if (d.kind === 'top' && d.h !== d.h0) onHeight?.(d.section, d.h)
      },
    )
  // A shelf's grip keeps its key while it is dragged (by where it started), so the pointer stays captured
  const shelfGrips = (t: (typeof sections)[number]) =>
    t.shelves.map((y) => {
      const live = drag?.kind === 'shelf' && drag.section === t.section && drag.to === y
      const from = live ? drag.from : y
      return grip(
        `s${t.section}:${from}`,
        t.x,
        yAt(y + R.railHeight / 2),
        `Hylle ${y}`,
        live,
        (y0) => ({ kind: 'shelf', section: t.section, y0, from: y, to: y, h: t.h, shelves: [...t.shelves] }),
        (d, mm) => (d.kind === 'shelf' ? { ...d, to: shelfStop({ h: d.h, shelves: d.shelves }, d.from, d.from + mm) } : d),
        (d) => {
          if (d.kind === 'shelf' && d.to !== d.from) onShelf?.(d.section, d.from, d.to)
        },
      )
    })

  return (
    <div className="wd-view">
      <div ref={box} className="wd-fit">
        <svg ref={svg} className="wd-svg" viewBox={view.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${title}, ${length} mm`} onPointerMove={decalMove} onPointerUp={decalUp} onPointerCancel={() => setDd(null)}>
          {parts.map((p, i) => {
            const w = x(p.x1 - p.x0)
            const x0 = x(p.x0)
            const kinds = p.locked ? p.lights.map(() => null) : p.lights
            const bands = lightBands(p)
            const lowOpen = kinds[0] === 'open'
            return (
              <g key={p.key}>
                {bands.map(([c0, c1], li) => {
                  const kind = kinds[li] ?? null
                  // From the underside of the rail over it down to the top of the rail under it (the floor when open there)
                  const y0 = yAt(c1)
                  const y1 = li === 0 ? (lowOpen ? H : H - RAIL) : yAt(c0 + R.railHeight)
                  const open = kind === 'open'
                  return (
                    <g key={li} style={{ cursor: 'pointer' }} onClick={() => pick(i, bands.length > 1 ? li : undefined)}>
                      {/* The plate, or the inside seen through an open light opening (no plates between the sections, K16) */}
                      <rect x={x0} y={y0} width={w} height={y1 - y0} fill={open ? SUNKEN : fill} />
                      {open && <rect x={x0} y={y0} width={w} height={y1 - y0} fill={INK} fillOpacity={0.06} />}
                      {/* K17: two leaves in the channel, overlapping in the middle */}
                      {kind === 'door' && (
                        <g fill="none" stroke={INK_MUTED} strokeWidth={px(0.75)}>
                          <rect x={x0 + px(3)} y={y0 + px(3)} width={w / 2 + DOOR - px(3)} height={y1 - y0 - px(6)} />
                          <rect x={x0 + w / 2 - DOOR} y={y0 + px(6)} width={w / 2 + DOOR - px(3)} height={y1 - y0 - px(12)} />
                        </g>
                      )}
                      {chosen?.part === i && chosen.light === li && tints.push(<rect key="tint" x={x0} y={y0} width={w} height={y1 - y0} />) && null}
                      {open && y1 - y0 > px(14) && (
                        <text x={x0 + w / 2} y={(y0 + y1) / 2} textAnchor="middle" dominantBaseline="middle" style={{ font: `500 ${px(10)}px var(--font-ui)`, fill: INK_MUTED }} pointerEvents="none">
                          åpen
                        </text>
                      )}
                    </g>
                  )
                })}
                {/* Top rail, the shelves' rails (K19), and the bottom rail where it is not open from the floor */}
                <g pointerEvents="none" fill={ALU}>
                  <rect x={x0} y={yAt(p.h + R.railHeight)} width={w} height={RAIL} />
                  {p.shelves.map((y) => (
                    <rect key={y} x={x0} y={yAt(y + R.railHeight)} width={w} height={RAIL} />
                  ))}
                  {!lowOpen && <rect x={x0} y={H - RAIL} width={w} height={RAIL} />}
                </g>
                {chosen?.part === i && chosen.light === undefined && tints.push(<rect key="tint" x={x0} y={yAt(p.h + R.railHeight)} width={w} height={(p.h + R.railHeight) / 1000} />) && null}
              </g>
            )
          })}
          {/* K20: print in every window of plate and door, its share of the motif; decals over it */}
          <g pointerEvents="none">
            {!drag &&
              prints.map((w, i) => {
                const m = findMotif(motifs, w.motif)
                return m && <Print key={i} m={m} x={x(w.x0)} y={yAt(w.y1)} width={x(w.x1 - w.x0)} height={(w.y1 - w.y0) / 1000} crop={w.crop} />
              })}
          </g>
          {!drag &&
            decals.map((d) => {
              const m = findMotif(motifs, d.motif)
              const b = dd?.id === d.id ? dd.box : d
              return (
                <g key={d.id} style={{ cursor: 'move' }} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => decalDown(e, d, 'move')}>
                  {m ? <Print m={m} x={x(b.x0)} y={yAt(b.y1)} width={x(b.x1 - b.x0)} height={(b.y1 - b.y0) / 1000} /> : <rect x={x(b.x0)} y={yAt(b.y1)} width={x(b.x1 - b.x0)} height={(b.y1 - b.y0) / 1000} fill={SUNKEN} />}
                </g>
              )
            })}
          {nodes.map(post)}
          {/* What is chosen, toned over the print */}
          <g fill={INK} fillOpacity={0.12} pointerEvents="none">
            {tints}
          </g>
          {!drag &&
            decals
              .filter((d) => d.id === decal)
              .map((d) => {
                const b = dd?.id === d.id ? dd.box : d
                return <Handles key={d.id} k={0.45} x={x(b.x0)} y={yAt(b.y1)} w={x(b.x1 - b.x0)} h={(b.y1 - b.y0) / 1000} onDown={(e, edge) => decalDown(e, d, edge)} />
              })}
          {onShelf && sections.flatMap(shelfGrips)}
          {onHeight && sections.map(topGrip)}
          <line x1={-px(12)} y1={H} x2={L + px(12)} y2={H} stroke={BORDER_STRONG} strokeWidth={px(1)} />
          <g pointerEvents="none">
            <text x={L / 2} y={view.top + px(14)} textAnchor="middle" style={{ font: `500 ${px(11.5)}px var(--font-ui)`, fill: INK_MUTED }}>
              {title}
            </text>
            {chainTs.length > 2 && <Chain sc={sc} axis="x" at={H + px(NEAR)} ts={chainTs} dir={1} />}
            <Chain sc={sc} axis="x" at={H + px(chainTs.length > 2 ? TOTAL : NEAR)} ts={[0, L]} dir={1} />
            <Chain sc={sc} axis="y" at={-px(NEAR)} ts={[yAt(h), ...shelfYs.map(yAt), H]} dir={-1} suffix="CC" />
            <Chain sc={sc} axis="y" at={-px(TOTAL)} ts={[yAt(h + R.railHeight), H]} dir={-1} suffix="utv." />
          </g>
        </svg>
      </div>
    </div>
  )
}
