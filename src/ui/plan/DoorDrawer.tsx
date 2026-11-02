// Door drawer (dørskuff): a door or curtain chosen in the plan or 3D. Door or curtain, swing, hinge side, leaf colour,
// back to wall, and a mini plan to move it (DoorMap, from design_handoff_bakrom_dor).
// Three parts like the wall drawer: settings · mini plan · front view; no outlines, chosen = ink, setting = muted fill.
import { ArrowLeftRight, FlipHorizontal2, PanelTop } from 'lucide-react'
import { sideName, doorRal, flipHinge, openingById, openingRoom, removeOpening, setDoorRal, setOpeningProduct } from '../../domain/doors'
import { canFlipSwing, doorSwing, flipSwing, isPerimeterWall } from '../../domain/edit'
import { pointAlong, wallDirection, wallLength, wallModules } from '../../domain/grid'
import { OUTSIDE, roomName, roomSize } from '../../domain/rooms'
import type { Point, Variant } from '../../domain/types'
import { builtModules, isStandWall } from '../../domain/walls'
import { wallRal } from '../../domain/panels'
import { doorInset, wallHeight } from '../../rules/rules'
import { ALU, BORDER_STRONG, INK_FAINT, LAYER_COLOR } from '../colors'
import { IconButton, Segmented } from '../controls'
import { openingProducts, plateColor, plateName, productOf, rules } from '../env'
import { fmt } from '../format'
import { TXT } from './drawerText'
import { DrawerHead, DrawerRow, PlatePalette } from './drawerParts'
import { Opening, Posts } from './elevation'
import { DoorMap } from './DoorMap'
import type { PlanSelection } from './PlanView'

interface Props {
  v: Variant
  selection: PlanSelection
  onSelect: (s: PlanSelection) => void
  onEdit: (fn: (v: Variant) => Variant) => void
  onClose: () => void
}

/** Where a direction in the plan points, as people say it. */
function toward([x, y]: Point): string {
  if (y < -0.5) return 'bakover'
  if (y > 0.5) return 'mot fronten'
  return x < 0 ? 'mot venstre' : 'mot høyre'
}

export function DoorDrawer({ v, selection, onSelect, onEdit, onClose }: Props) {
  const o = openingById(v, selection.openingId)
  const w = o && v.walls.find((x) => x.id === o.wallId)
  if (!o || !w) return null
  const product = productOf(o.product)
  const door = product?.opening === 'door'
  const room = openingRoom(v, o)
  const [dx, dy] = wallDirection(w)
  const s = doorSwing(v.stand, w, o)
  const n: Point = [-dy * s, dx * s]
  const out: Point = [-dy * OUTSIDE, dx * OUTSIDE]
  const ral = doorRal(v, o)

  const where = room
    ? `${roomName(room)} ${roomSize(room)} · ${sideName(out).toLowerCase()}`
    : isStandWall(w)
      ? 'Standvegg'
      : `Innervegg ${fmt(wallLength(w), 0)} m`
  const swingText = isPerimeterWall(v.stand, w) ? 'Slår inn i standen' : room ? (s === OUTSIDE ? 'Slår ut av rommet' : 'Slår inn i rommet') : `Slår ${toward(n)}`

  return (
    <section className="wall-drawer drawer3" aria-label={door ? 'Dør' : 'Forheng'}>
      <div className="wd-insp">
        <DrawerHead
          dot={door ? plateColor(ral) : LAYER_COLOR.walls}
          title={door ? 'Dør' : 'Forheng'}
          remove={{
            label: 'Gjør om til vegg (Delete)',
            onClick: () => {
              onEdit((x) => removeOpening(x, o.id))
              onClose()
            },
          }}
          onClose={onClose}
        >
          <IconButton icon={PanelTop} label="Vis veggen" size={14} onClick={() => onSelect({ wallId: w.id })} />
        </DrawerHead>
        <p className="wd-meta num">
          {where} · {door ? `blad ${fmt(rules.door.swing * 100, 0)} × ${fmt(rules.door.height * 100, 0)} cm` : `åpning ${fmt((rules.wall.cc - rules.wall.post) * 1000, 0)} mm`}
        </p>
        <Segmented<string>
          inWell
          label="Type"
          value={o.product}
          onChange={(a) => onEdit((x) => setOpeningProduct(x, o.id, a))}
          options={openingProducts().map((x) => ({ value: x.variants[0].artnr, label: x.opening === 'door' ? 'Dør' : 'Forheng' }))}
        />
        {door && (
          <>
            <div className="eyebrow">
              Dørblad · {plateName(ral)} · RAL {ral}
              {o.ral ? '' : ' · som standen'}
            </div>
            <PlatePalette value={ral} onPick={(r) => onEdit((x) => setDoorRal(x, o.id, r))} />
            <DrawerRow label={swingText}>
              {canFlipSwing(v.stand, w) && <IconButton icon={FlipHorizontal2} label="Snu slagretning" size={15} onClick={() => onEdit((x) => flipSwing(x, o.id))} />}
              <IconButton icon={ArrowLeftRight} label="Bytt hengselside" size={15} onClick={() => onEdit((x) => flipHinge(x, o.id))} />
            </DrawerRow>
          </>
        )}
      </div>
      {/* Middle: where it stands, to move it */}
      <div className="wd-mid">
        <DoorMap v={v} openingId={o.id} onEdit={onEdit} />
      </div>
      <div className="wd-view">
        <DoorView v={v} openingId={o.id} />
      </div>
      <div className="wd-hint">
        Klikk ruten utenfor en vegg i miniplanen for å flytte døren{door ? ' · lås og nøkler følger med, overstykket har veggens farge' : ''} · Delete gjør den om til vegg · Esc lukker
      </div>
    </section>
  )
}

/** The module seen from the side the door opens to (or from the stand, for a curtain), with half a module each side. */
function DoorView({ v, openingId }: { v: Variant; openingId: string }) {
  const o = openingById(v, openingId)!
  const w = v.walls.find((x) => x.id === o.wallId)!
  const door = productOf(o.product)?.opening === 'door'
  const H = wallHeight(rules)
  const dh = rules.door.height
  const [dx, dy] = wallDirection(w)
  const s = door ? doorSwing(v.stand, w, o) : 1
  const n: Point = [-dy * s, dx * s]
  // Standing on the n side looking at the wall: right is (n.y, −n.x)
  const right: Point = [n[1], -n[0]]
  const a = pointAlong(w, o.module)
  const b = pointAlong(w, o.module + 1)
  const flip = (b[0] - a[0]) * right[0] + (b[1] - a[1]) * right[1] < 0
  /** Position along the module (0 at its `from` end) to x in the drawing. */
  const X = (t: number) => (flip ? 1 - t : t)
  const z = (h: number) => H - h
  const k = doorInset(rules)
  const hingeT = o.hinge === -1 ? 1 - k : k
  const freeT = 1 - hingeT
  const hx = X(hingeT)
  const fx = X(freeT)
  // The header has the module's own colour when that plate is coloured on its own
  const key = wallModules(w)[o.module]?.key
  const plate = plateColor(builtModules(v).find((m) => m.key === key)?.plate ?? wallRal(v, w))
  const post = rules.wall.post
  const PAD = 0.12
  return (
    <svg className="wd-svg" viewBox={`${-0.5 - PAD} ${-PAD} ${2 + 2 * PAD} ${H + PAD + 0.32}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Døren sett forfra">
      {/* Half a wall panel each side, faint */}
      {[-0.5, 1].map((x0) => (
        <rect key={x0} x={x0 + (x0 < 0 ? 0 : post / 2)} y={z(H)} width={0.5 - post / 2} height={H - rules.wall.feet} fill={plate} opacity={0.45} />
      ))}
      <rect x={-0.5} y={z(H)} width={2} height={rules.wall.profile.top} fill={ALU} />
      <Opening x={0} H={H} plate={{ fill: plate }} door={door ? { color: plateColor(doorRal(v, o)), hinge: hx, free: fx } : undefined} />
      {/* Swing mark: the point of the triangle is the hinge side */}
      {door && <path d={`M${fx} ${z(dh)} L${hx} ${z(dh / 2)} L${fx} ${z(0)}`} fill="none" stroke={INK_FAINT} strokeWidth={0.01} strokeDasharray=".04 .03" />}
      <Posts xs={[0, 1]} H={H} />
      <line x1={-0.5} y1={H} x2={1.5} y2={H} stroke={BORDER_STRONG} strokeWidth={0.008} />
      <text x={0.5} y={H + 0.2} textAnchor="middle" style={TXT}>
        {door ? `${fmt(rules.door.swing * 100, 0)} × ${fmt(dh * 100, 0)} cm` : 'forheng'}
      </text>
    </svg>
  )
}
