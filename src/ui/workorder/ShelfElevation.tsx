// The work order's «Veggriss med hyller» (Byggeregel H8): one wall face with shelves seen straight on, as in the wall
// drawer but fixed, so the stand builder can mount them: the plates and doors, the shelves, and in each felt with
// shelves its height chain from the floor with the lysmål between boards (ElevationDims). The module chain under the
// wall counts the felts from the end the heading names. Corner shelves with their cut boards and 01 rails (H10–H12).
import { wallLabel } from '../../calc/production'
import { doorRal } from '../../domain/doors'
import { felt, sideOf, type FaceSide } from '../../domain/faces'
import { RECIPES } from '../../foga/recipes'
import type { BoardKind } from '../../foga/structure'
import { wallLength, wallModules } from '../../domain/grid'
import { wallRal } from '../../domain/panels'
import { cornerLayout } from '../../domain/shelves/corners'
import { shelfStacks, shelvesOf } from '../../domain/shelves/model'
import type { Shelf, Variant } from '../../domain/types'
import { builtModules } from '../../domain/walls'
import { doorInset, wallHeight } from '../../rules/rules'
import { ALU, BORDER_STRONG } from '../colors'
import { plateColor, productOf, rules } from '../env'
import { FaceRails, Opening as OpeningView, Posts, ShelfFront } from '../plan/elevation'
import { shelfFront } from '../plan/shelfFront'
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
  const layout = cornerLayout(v, rules)
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
      <FaceRails v={v} wallId={w.id} s={s} layout={layout} x={u} H={H} u={fr.u} />
      {shelves.map((f) => (
        <ShelfFront key={f.id} {...shelfFront(v, f, layout, spanX)} y={f.y} H={H} u={fr.u} />
      ))}
      <ElevationDims w={w} s={s} name={name} L={L} H={H} items={[]} leaders={[]} top={fr.top} width={fr.width} right={fr.right} sc={sc} shelves={shelfChains(rules, shelfStacks({ ...v, shelves }), u)} />
    </svg>
  )
}

const BOARD_NAME = (k: Exclude<BoardKind, 'standard'>) => {
  const b = RECIPES.shelf.corner.boards[k]
  return `${b.name} ${b.w} × ${b.d}`
}

/**
 * Under a face's drawing, what the montør needs for its corners (Byggeregler H10–H12), one line per corner, named by the
 * wall it meets: each 01 rail hung on the face, its length and where its centre is from the corner post's face, and
 * which shelves get a cut board, by height.
 */
export function CornerNotes({ v, wallId, s }: { v: Variant; wallId: string; s: FaceSide }) {
  const layout = cornerLayout(v, rules)
  const mm = (m: number) => Math.round(m * 1000)
  const co = RECIPES.shelf.corner
  type Notes = { other: string; left: boolean; rails: string[]; boards: Map<Exclude<BoardKind, 'standard'>, number[]> }
  const corners = new Map<number, Notes>()
  const w = v.walls.find((x) => x.id === wallId)
  const L = w ? wallLength(w) : 0
  const u = (t: number) => (s === 1 ? t : L - t)
  /** The corner felt on this face, by module; `left` when it lies left of its corner post as drawn. */
  const at = (felt: { module: number; end: 0 | 1 }, other: string) => {
    const c: Notes = corners.get(felt.module) ?? { other, left: u(felt.module + 0.5) < u(felt.module + felt.end), rails: [], boards: new Map() }
    corners.set(felt.module, c)
    return c
  }
  for (const f of shelvesOf(v)) {
    const c = layout.shelves.get(f.id)
    if (!c || f.wallId !== wallId || sideOf(v, f) !== s || c.board === 'standard') continue
    const b = at(c.corner.felt, c.corner.other.wallId).boards
    b.set(c.board, [...(b.get(c.board) ?? []), mm(f.y)])
  }
  for (const r of layout.rails.filter((x) => x.felt.wallId === wallId && x.felt.s === s)) {
    // The wall across the corner: the one whose shelves the rail carries, or for twins the one with the corner board
    const f = shelvesOf(v).find((x) => x.id === r.carries[0])
    const c = f && layout.shelves.get(f.id)
    const other = c ? (c.corner.felt.wallId === wallId ? c.corner.other.wallId : c.corner.felt.wallId) : ''
    const n = r.carries.length
    at(r.felt, other).rails.push(
      `${co.rail}-skinne ${r.length} mm med ${co.hook}, senter ${mm(r.along - rules.wall.post / 2)} mm fra hjørnestolpen, ${n} ${n === 1 ? 'hylle' : 'hyller'} ${r.kind === 'single' ? `alene på ${co.bracket} × ${co.short}` : `som møtes, på ${RECIPES.shelf.twin}`}`,
    )
  }
  if (!corners.size) return null
  const name = (id: string) => {
    const w = v.walls.find((x) => x.id === id)
    return w ? (w.room ? 'romvegg' : wallLabel(w).toLowerCase()) : 'vegg'
  }
  return (
    <div className="wo-corner">
      {[...corners].map(([k, c]) => (
        <p key={k}>
          <b>Hjørnet mot {name(c.other)}, feltet til {c.left ? 'venstre' : 'høyre'}:</b> {[...c.rails, ...[...c.boards].map(([b, ys]) => `${BOARD_NAME(b)} på ${ys.sort((x, y) => x - y).join(', ')}`)].join(' · ')}
        </p>
      ))}
    </div>
  )
}
