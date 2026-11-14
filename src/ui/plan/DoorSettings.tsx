// Door settings in the wall drawer: a door or curtain chosen in the plan, 3D or the wall drawing. Door or curtain,
// swing and hinge side. No colour or graphics here: the door is part of the wall, so the wall's paint bucket and brush
// colour and print the header and the leaf (Bjørn 3.11.2026). The wall drawer shows these in its settings column, the
// mini plan (DoorMap) in the middle to move the door, and the door in its wall in the drawing.
import type { ReactNode } from 'react'
import { ArrowLeftRight, FlipHorizontal2 } from 'lucide-react'
import { canFlipSwing, doorRal, doorSwing, flipHinge, flipSwing, openingRoom, setOpeningProduct, sideName } from '../../domain/doors'
import { wallDirection, wallLength } from '../../domain/grid'
import { roomName, roomSize } from '../../domain/rooms'
import { OUTSIDE } from '../../domain/roomKeys'
import type { Opening, Point, Variant, Wall } from '../../domain/types'
import { isPerimeterWall, isStandWall } from '../../domain/walls'
import { LAYER_COLOR } from '../colors'
import { FlatChoice, IconButton, Section } from '../controls'
import { openingProducts, plateColor, productOf, rules } from '../env'
import { fmt } from '../format'
import { DrawerHead} from './drawerParts'

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
      : `Innervegg ${fmt(wallLength(w), 2)} m`
  const swing = isPerimeterWall(v.stand, w) ? 'inn i standen' : room ? (s === OUTSIDE ? 'ut av rommet' : 'inn i rommet') : toward(n)

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
      <Section title="Type">
        <FlatChoice<string>
          label="Type"
          value={o.product}
          onChange={(a) => onEdit((x) => setOpeningProduct(x, o.id, a))}
          options={openingProducts().map((x) => ({ value: x.variants[0].artnr, label: x.opening === 'door' ? 'Dør' : 'Forheng' }))}
        />
      </Section>
      {door && (
        <Section
          title="Slag"
          aside={swing}
          tools={
            <>
              {canFlipSwing(v.stand, w) && <IconButton icon={FlipHorizontal2} label="Snu slagretning" size={15} onClick={() => onEdit((x) => flipSwing(x, o.id))} />}
              <IconButton icon={ArrowLeftRight} label="Bytt hengselside" size={15} onClick={() => onEdit((x) => flipHinge(x, o.id))} />
            </>
          }
        />
      )}
    </>
  )
}
