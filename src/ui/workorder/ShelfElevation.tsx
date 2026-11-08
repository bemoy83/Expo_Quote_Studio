// The work order's «Veggriss med hyller» (Byggeregel H8): one wall face with shelves seen straight on, as in the wall
// drawer but fixed, so the stand builder can mount them: the plates and doors, the shelves, and in each felt with
// shelves its height chain from the floor with the lysmål between boards (ElevationDims). The module chain under the
// wall counts the felts from the end the heading names.
import { wallLabel } from '../../calc/production'
import { doorRal } from '../../domain/doors'
import { felt, type FaceSide } from '../../domain/faces'
import { wallLength, wallModules } from '../../domain/grid'
import { wallRal } from '../../domain/panels'
import { shelfStacks } from '../../domain/shelves'
import type { Shelf, Variant } from '../../domain/types'
import { builtModules } from '../../domain/walls'
import { doorInset, wallHeight } from '../../rules/rules'
import { ALU, BORDER_STRONG } from '../colors'
import { plateColor, productOf, rules } from '../env'
import { Opening as OpeningView, Posts, ShelfFront } from '../plan/elevation'
import { planScale } from '../plan/planScale'
import { ElevationDims } from '../plan/wallDrawer/ElevationDims'
import { frame, shelfChains } from '../plan/wallDrawer/elevationMeasure'

/** The drawing's box on the page, px: wide as the work order's column, low enough for two on a page. */
const SIZE = { w: 680, h: 250 }

export function ShelfElevation({ v, wallId, s, shelves }: { v: Variant; wallId: string; s: FaceSide; shelves: Shelf[] }) {
  const w = v.walls.find((x) => x.id === wallId)
  if (!w) return null
  const L = wallLength(w)
  const H = wallHeight(rules)
  const u = (t: number) => (s === 1 ? t : L - t)
  const spanX = (a: number, b: number) => Math.min(u(a), u(b))
  const z = (h: number) => H - h
  const built = new Map(builtModules(v).map((m) => [m.key, m]))
  const mods = wallModules(w).map((m) => built.get(m.key))
  const fr = frame(SIZE, L, H, [])
  const sc = planScale(1 / fr.u, { doc: true })
  const inset = (rules.wall.cc - rules.shelf.board.width) / 2
  const name = w.room ? 'Romvegg' : wallLabel(w)
  return (
    <svg className="wo-elev" viewBox={fr.viewBox} role="img" aria-label={`${name}, ${shelves.length} hyller`}>
      {mods.map((m, i) => {
        const x = spanX(i, i + 1)
        if (m?.opening) {
          const o = m.opening
          const door = productOf(o.product)?.opening === 'door'
          const k = doorInset(rules)
          return (
            <OpeningView
              key={i}
              x={x}
              H={H}
              plate={{ fill: plateColor(m.plate) }}
              door={door ? { color: plateColor(doorRal(v, o)), hinge: u(o.hinge === -1 ? i + 1 - k : i + k), free: u(o.hinge === -1 ? i + k : i + 1 - k) } : undefined}
            />
          )
        }
        const f = felt(rules, i)
        return (
          <g key={i}>
            <rect x={spanX(f.a, f.b)} y={z(H)} width={f.w} height={H - rules.wall.feet} fill={plateColor(m?.plate ?? wallRal(v, w))} />
            <rect x={x} y={z(H)} width={1} height={rules.wall.profile.top} fill={ALU} />
            <rect x={x} y={z(f.y0)} width={1} height={rules.wall.profile.bottom} fill={ALU} />
          </g>
        )
      })}
      <Posts xs={Array.from({ length: L + 1 }, (_, i) => u(i))} H={H} />
      <line x1={-0.12} y1={H} x2={L + 0.12} y2={H} stroke={BORDER_STRONG} strokeWidth={0.01} />
      {shelves.map((f) => (
        <ShelfFront key={f.id} x={spanX(f.module + inset, f.module + 1 - inset)} y={f.y} H={H} u={fr.u} />
      ))}
      <ElevationDims w={w} s={s} name={name} L={L} H={H} items={[]} leaders={[]} top={fr.top} width={fr.width} right={fr.right} sc={sc} shelves={shelfChains(rules, shelfStacks({ ...v, shelves }), u)} />
    </svg>
  )
}
