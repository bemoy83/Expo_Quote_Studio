// Door drawer (dørskuff): a door or curtain chosen in the plan or 3D. Door or curtain, swing, hinge side, leaf colour,
// back to wall, and a mini plan to move it (DoorMap, from design_handoff_bakrom_dor).
// Laid out like the wall drawer; no outlines, chosen = ink, setting = muted fill.
import { ArrowLeftRight, FlipHorizontal2, PanelTop, Trash2, X } from 'lucide-react'
import { sideName, doorRal, flipHinge, openingById, openingRoom, removeOpening, setDoorRal, setOpeningProduct } from '../../domain/doors'
import { canFlipSwing, doorSwing, flipSwing, isPerimeterWall } from '../../domain/edit'
import { pointAlong, wallDirection, wallLength } from '../../domain/grid'
import { OUTSIDE, roomName, roomSize } from '../../domain/rooms'
import type { Point, Variant } from '../../domain/types'
import { isStandWall } from '../../domain/walls'
import { doorInset, wallHeight } from '../../rules/rules'
import { ALU, ALU_POST, BORDER_STRONG, FEET, INK_FAINT, LAYER_COLOR } from '../colors'
import { Button, IconButton, Segmented } from '../controls'
import { openingProducts, plateColor, plateName, productOf, rules, wallPlates } from '../env'
import { fmt } from '../format'
import { VariantChips } from '../panel/ProductRow'
import { TXT } from './drawerText'
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
  const plates = wallPlates()

  const where = room
    ? `${roomName(room)} ${roomSize(room)} · ${sideName(out).toLowerCase()}`
    : isStandWall(w)
      ? 'Standvegg'
      : `Innervegg ${fmt(wallLength(w), 0)} m`
  const swingText = isPerimeterWall(v.stand, w) ? 'Slår inn i standen' : room ? (s === OUTSIDE ? 'Slår ut av rommet' : 'Slår inn i rommet') : `Slår ${toward(n)}`

  return (
    <section className="wall-drawer" aria-label={door ? 'Dør' : 'Forheng'}>
      <div className="wd-insp">
        <div className="wd-head">
          <i className="dot" style={{ background: door ? plateColor(ral) : LAYER_COLOR.walls }} />
          <h3>{product?.name ?? (door ? 'Dør' : 'Forheng')}</h3>
          <IconButton
            icon={Trash2}
            label="Gjør om til vegg (Delete)"
            size={14}
            onClick={() => {
              onEdit((x) => removeOpening(x, o.id))
              onClose()
            }}
          />
          <IconButton icon={X} label="Lukk" size={14} onClick={onClose} />
        </div>
        <p className="wd-meta num">
          {where} · {door ? `blad ${fmt(rules.door.swing * 100, 0)} × ${fmt(rules.door.height * 100, 0)} cm` : `åpning ${fmt((rules.wall.cc - rules.wall.post) * 1000, 0)} mm`}
        </p>
        <DoorMap v={v} openingId={o.id} onEdit={onEdit} />
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
            <VariantChips
              chips={plates.map((x) => ({ name: `${x.name} · RAL ${x.ral}`, color: x.color }))}
              selected={plates.findIndex((x) => x.ral === ral)}
              onSelect={(i) => onEdit((x) => setDoorRal(x, o.id, plates[i].ral!))}
            />
            <div className="eyebrow">{swingText}</div>
            <div className="wd-actions">
              {canFlipSwing(v.stand, w) && (
                <Button variant="ghost" icon={FlipHorizontal2} onClick={() => onEdit((x) => flipSwing(x, o.id))}>
                  Snu slagretning
                </Button>
              )}
              <Button variant="ghost" icon={ArrowLeftRight} onClick={() => onEdit((x) => flipHinge(x, o.id))}>
                Bytt hengselside
              </Button>
            </div>
            <p className="panel-note">Lås og nøkler følger med døren. Overstykket har veggens farge.</p>
          </>
        )}
        <div className="wd-actions">
          <Button variant="ghost" icon={PanelTop} onClick={() => onSelect({ wallId: w.id })}>
            Vis veggen
          </Button>
        </div>
      </div>
      <div className="wd-view">
        <DoorView v={v} openingId={o.id} />
        <div className="wd-hint">Klikk ruten utenfor en vegg i miniplanen for å flytte døren · Delete gjør den om til vegg · Esc lukker</div>
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
  const plate = plateColor(v.walls.find((x) => x.id === o.wallId)?.plate ?? v.defaultPlate)
  const post = rules.wall.post
  const PAD = 0.12
  return (
    <svg className="wd-svg" viewBox={`${-0.5 - PAD} ${-PAD} ${2 + 2 * PAD} ${H + PAD + 0.32}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Døren sett forfra">
      {/* Half a wall panel each side, faint */}
      {[-0.5, 1].map((x0) => (
        <rect key={x0} x={x0 + (x0 < 0 ? 0 : post / 2)} y={z(H)} width={0.5 - post / 2} height={H - rules.wall.feet} fill={plate} opacity={0.45} />
      ))}
      {/* Header over the opening */}
      <rect x={post / 2} y={z(H)} width={1 - post} height={H - dh} fill={plate} />
      <rect x={-0.5} y={z(H)} width={2} height={rules.wall.profile.top} fill={ALU} />
      {door ? (
        <>
          <rect x={Math.min(hx, fx)} y={z(dh)} width={rules.door.swing} height={dh} fill={plateColor(doorRal(v, o))} stroke={BORDER_STRONG} strokeWidth={0.008} />
          {/* Swing mark: the point of the triangle is the hinge side */}
          <path d={`M${fx} ${z(dh)} L${hx} ${z(dh / 2)} L${fx} ${z(0)}`} fill="none" stroke={INK_FAINT} strokeWidth={0.01} strokeDasharray=".04 .03" />
          <rect x={fx + (fx > hx ? -0.13 : 0.03)} y={z(1.06)} width={0.1} height={0.02} rx={0.01} fill={INK_FAINT} />
        </>
      ) : (
        <rect x={0.04} y={z(dh)} width={0.92} height={dh} fill="none" stroke={BORDER_STRONG} strokeWidth={0.012} strokeDasharray=".05 .04" />
      )}
      {[0, 1].map((x) => (
        <g key={x}>
          <rect x={x - post / 2} y={z(H)} width={post} height={H - rules.wall.feet} fill={ALU_POST} />
          <rect x={x - 0.012} y={z(rules.wall.feet)} width={0.024} height={rules.wall.feet} fill={FEET} />
        </g>
      ))}
      <line x1={-0.5} y1={H} x2={1.5} y2={H} stroke={BORDER_STRONG} strokeWidth={0.008} />
      <text x={0.5} y={H + 0.2} textAnchor="middle" style={TXT}>
        {door ? `${fmt(rules.door.swing * 100, 0)} × ${fmt(dh * 100, 0)} cm` : 'forheng'}
      </text>
    </svg>
  )
}
