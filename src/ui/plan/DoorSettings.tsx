// Door settings (dørskuff, now part of the wall drawer): a door or curtain chosen in the plan, 3D or the wall drawing.
// Door or curtain, leaf colour, swing and hinge side. The wall drawer shows these in its settings column, the mini plan
// (DoorMap) in the middle to move the door, and the door in its wall in the drawing (Bjørn 3.11.2026).
import type { ReactNode } from 'react'
import { ArrowLeftRight, FlipHorizontal2 } from 'lucide-react'
import { sideName, doorRal, flipHinge, openingRoom, setDoorRal, setOpeningProduct } from '../../domain/doors'
import { canFlipSwing, doorSwing, flipSwing, isPerimeterWall } from '../../domain/edit'
import { wallDirection, wallLength } from '../../domain/grid'
import { OUTSIDE, roomName, roomSize } from '../../domain/rooms'
import type { Opening, Point, Variant, Wall } from '../../domain/types'
import { isStandWall } from '../../domain/walls'
import { LAYER_COLOR } from '../colors'
import { IconButton, Segmented } from '../controls'
import { openingProducts, plateColor, plateName, productOf, rules } from '../env'
import { fmt } from '../format'
import { DrawerHead, DrawerRow, PlatePalette } from './drawerParts'

interface Props {
  v: Variant
  o: Opening
  w: Wall
  onEdit: (fn: (v: Variant) => Variant) => void
  /** Turn the door back into a wall plate. */
  onRemove: () => void
  onClose: () => void
  /** Header buttons beside delete and close (the wall drawer's face switch). */
  children?: ReactNode
}

/** Where a direction in the plan points, as people say it. */
function toward([x, y]: Point): string {
  if (y < -0.5) return 'bakover'
  if (y > 0.5) return 'mot fronten'
  return x < 0 ? 'mot venstre' : 'mot høyre'
}

export function DoorSettings({ v, o, w, onEdit, onRemove, onClose, children }: Props) {
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
    <>
        <DrawerHead
          dot={door ? plateColor(ral) : LAYER_COLOR.walls}
          title={door ? 'Dør' : 'Forheng'}
          remove={{
            label: 'Gjør om til vegg (Delete)',
            onClick: onRemove,
          }}
          onClose={onClose}
        >
          {children}
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
    </>
  )
}
