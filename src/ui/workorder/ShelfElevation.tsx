// The work order's «Veggriss med hyller» (Byggeregel H8): one wall face with shelves seen straight on, as in the wall
// drawer but fixed, so the stand builder can mount them: the plates and doors, the shelves, and in each felt with
// shelves its height chain from the floor with the lysmål between boards (ElevationDims). The module chain under the
// wall counts the felts from the end the heading names. Corner shelves with their cut boards and 01 rails (H10–H12).
// A raised wall is drawn with its raise (V18) and the ceiling wires as a circle with a cross (S9), also when it has no
// shelves, so the montør sees where the wires hang.
import { doorRal } from '../../domain/doors'
import { sideOf, type FaceSide } from '../../domain/faces'
import { RECIPES } from '../../foga/recipes'
import type { BoardKind } from '../../foga/structure'
import { moduleCc, moduleStart, wallLength, wallModules } from '../../domain/grid'
import { wallRal } from '../../domain/plateDecor'
import { railsOn, type CornerLayout } from '../../domain/shelves/corners'
import { shelfStacks, shelvesOf } from '../../domain/shelves/model'
import type { Shelf, Variant } from '../../domain/types'
import { builtModules, postOffsets, splitParts, wallLabel, wallParts } from '../../domain/walls'
import { doorInset, wallHeight } from '../../rules/rules'
import { BORDER_STRONG } from '../colors'
import { plateColor, productOf, rules } from '../env'
import { FaceRails, Opening as OpeningView, Plate, Posts, Raise, ShelfFront } from '../plan/elevation'
import { raiseDrawing } from '../plan/raiseDrawing'
import { shelfFront } from '../plan/shelfFront'
import { planScale } from '../plan/planScale'
import { ElevationDims } from '../plan/wallDrawer/ElevationDims'
import { frame, shelfChains } from '../plan/wallDrawer/elevationMeasure'

/** The drawing's box on the page, px: wide as the work order's column, low enough for two on a page. */
const SIZE = { w: 680, h: 250 }

export function ShelfElevation({ v, wallId, s, shelves, layout, wired }: { v: Variant; wallId: string; s: FaceSide; shelves: Shelf[]; layout: CornerLayout; wired: ReadonlySet<string> }) {
  const w = v.walls.find((x) => x.id === wallId)
  if (!w) return null
  const L = wallLength(w)
  const H = wallHeight(rules)
  const u = (t: number) => (s === 1 ? t : L - t)
  const spanX = (a: number, b: number) => Math.min(u(a), u(b))
  const all = builtModules(v)
  const built = new Map(all.map((m) => [m.key, m]))
  const mods = wallModules(w).map((m) => built.get(m.key))
  const parts = wallParts(w, all)
  const posts = postOffsets(w, parts)
  const raise = raiseDrawing(w, mods, parts, u, wired)
  const fr = frame(SIZE, L, H, [], { above: raise.headroom })
  const sc = planScale(1 / fr.u, { doc: true })
  const name = w.room ? 'Romvegg' : wallLabel(w)
  return (
    <svg className="wo-elev" viewBox={fr.viewBox} role="img" aria-label={[name, shelves.length && `${shelves.length} hyller`, raise.wires.length && `${raise.wires.length} vaier`].filter(Boolean).join(', ')}>
      {mods.map((m, i) => {
        const cc = moduleCc(w, i)
        const at = moduleStart(w, i)
        const x = spanX(at, at + cc)
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
              door={door ? { color: plateColor(doorRal(v, o)), hinge: u(o.hinge === -1 ? at + 1 - k : at + k), free: u(o.hinge === -1 ? at + k : at + 1 - k) } : undefined}
            />
          )
        }
        // A module another wall split (V10): each part its own plate, in its own colour
        const split = !m ? splitParts(parts, i) : []
        if (split.length)
          return (
            <g key={i}>
              {split.map((q) => (
                <Plate key={q.mod.key} at={q.at} cc={q.cc} fill={plateColor(q.mod.plate)} x={spanX} H={H} />
              ))}
            </g>
          )
        return <Plate key={i} at={at} cc={cc} fill={plateColor(m?.plate ?? wallRal(v, w))} x={spanX} H={H} />
      })}
      <Posts xs={posts.map(u)} H={H} />
      {raise.felts.length > 0 && <Raise felts={raise.felts} posts={raise.posts} wires={raise.wires} x={spanX} />}
      <line x1={-0.12} y1={H} x2={L + 0.12} y2={H} stroke={BORDER_STRONG} strokeWidth={0.01} />
      <FaceRails wallId={w.id} s={s} layout={layout} x={u} H={H} u={fr.u} />
      {shelves.map((f) => (
        <ShelfFront key={f.id} {...shelfFront(v, f, layout, spanX)} y={f.y} H={H} u={fr.u} />
      ))}
      <ElevationDims w={w} s={s} name={name} L={L} H={H} posts={posts} items={[]} leaders={[]} top={fr.top} width={fr.width} right={fr.right} sc={sc} above={raise.above} shelves={shelfChains(rules, shelfStacks({ ...v, shelves }), u, (i) => moduleStart(w, i))} />
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
export function CornerNotes({ v, wallId, s, layout }: { v: Variant; wallId: string; s: FaceSide; layout: CornerLayout }) {
  const mm = (m: number) => Math.round(m * 1000)
  const co = RECIPES.shelf.corner
  type Notes = { other: string; left: boolean; rails: string[]; boards: Map<Exclude<BoardKind, 'standard'>, number[]> }
  const corners = new Map<number, Notes>()
  const w = v.walls.find((x) => x.id === wallId)
  const L = w ? wallLength(w) : 0
  const u = (t: number) => (s === 1 ? t : L - t)
  /** The corner felt on this face, by module; `left` when it lies left of its corner post as drawn. */
  const at = (felt: { module: number; end: 0 | 1; at: number }, other: string) => {
    const c: Notes = corners.get(felt.module) ?? { other, left: u(felt.at + 0.5) < u(felt.at + felt.end), rails: [], boards: new Map() }
    corners.set(felt.module, c)
    return c
  }
  for (const f of shelvesOf(v)) {
    const c = layout.shelves.get(f.id)
    if (!c || f.wallId !== wallId || sideOf(v, f) !== s || c.board === 'standard') continue
    const b = at(c.corner.felt, c.corner.other.wallId).boards
    b.set(c.board, [...(b.get(c.board) ?? []), mm(f.y)])
  }
  for (const r of railsOn(layout, wallId, s)) {
    // The wall across the corner: the one whose shelves the rail carries, or for twins the one with the corner board
    const f = shelvesOf(v).find((x) => x.id === r.carries[0])
    const c = f && layout.shelves.get(f.id)
    const other = c ? (c.corner.felt.wallId === wallId ? c.corner.other.wallId : c.corner.felt.wallId) : ''
    const n = r.carries.length
    at(r.felt, other).rails.push(
      `${co.rail}-skinne ${r.length} mm med ${co.hook}, senter ${mm(r.along - rules.wall.post / 2)} mm fra hjørnestolpen, ${r.kind === 'short' ? `${n} stk ${co.bracket} × ${co.short}` : `${n} ${n === 1 ? 'hylle' : 'hyller'} som møtes, på ${RECIPES.shelf.twin}`}`,
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
