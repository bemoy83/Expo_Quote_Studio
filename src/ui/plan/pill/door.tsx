// The pill on a door or curtain: door or curtain, swing and hinge, the leaf's colour or the curtain's; remove makes it
// wall again
// (docs/pille-og-skuff.md).
import { ArrowLeftRight, Blinds, DoorClosed, FlipHorizontal2 } from 'lucide-react'
import { fabricOf, shortName } from '../../../catalog/lookup'
import { canFlipSwing, doorRal, flipHinge, flipSwing, openingRoom, setCurtainFabric, setDoorRal, setOpeningProduct } from '../../../domain/doors'
import { roomName } from '../../../domain/rooms'
import { isStandWall } from '../../../domain/walls'
import { openingProducts, productOf, rules } from '../../env'
import { mm } from '../../format'
import { QBtn, Sep, Sw } from '../quick/parts'
import { fabricSwatches } from '../swatches'
import type { Chosen } from '../selection'
import { Colours, type Content, type PillActions } from './parts'

export function doorPill(p: PillActions, c: Extract<Chosen, { kind: 'opening' }>, remove: () => void): Content {
  const { v, onEdit } = p
  const { opening: o, wall: w } = c
  const product = productOf(o.product)
  const door = product?.opening === 'door'
  const room = openingRoom(v, o)
  const where = room ? roomName(room).toLowerCase() : isStandWall(w) ? 'standvegg' : 'innervegg'
  const ral = doorRal(v, o)
  const fabric = fabricOf(product, o.fabric)
  return {
    name: product?.name ?? (door ? 'Dør' : 'Forheng'),
    meta: `${where} · ${door ? mm(rules.door.swing) : mm(rules.wall.cc - rules.wall.post)}`,
    body: (
      <>
        {openingProducts().map((x) => {
          const a = x.variants[0].artnr
          return (
            <QBtn key={x.id} setting on={o.product === a} title={x.name} label={shortName(x)} onClick={() => o.product !== a && onEdit((y) => setOpeningProduct(y, o.id, a))}>
              {x.opening === 'door' ? <DoorClosed size={15} /> : <Blinds size={15} />}
              {shortName(x)}
            </QBtn>
          )
        })}
        {door && (
          <>
            <Sep />
            {canFlipSwing(v.stand, w) && (
              <QBtn title="Snu slagretning" label="Snu slag" onClick={() => onEdit((y) => flipSwing(y, o.id))}>
                <FlipHorizontal2 size={15} />
              </QBtn>
            )}
            <QBtn title="Bytt hengselside" label="Snu hengsel" onClick={() => onEdit((y) => flipHinge(y, o.id))}>
              <ArrowLeftRight size={15} />
            </QBtn>
            <Sep />
            <Colours value={ral} title={(n) => `Dørblad ${n}`} onPick={(r) => onEdit((y) => setDoorRal(y, o.id, r))} />
          </>
        )}
        {!door && product?.fabrics && fabric && (
          <>
            <Sep />
            {fabricSwatches(product.fabrics, fabric.key, (n) => `Forheng ${n}`, (f) => f !== fabric.key && onEdit((y) => setCurtainFabric(y, o.id, f))).map(({ key, ...x }) => (
              <Sw key={key} {...x} />
            ))}
          </>
        )}
      </>
    ),
    more: true,
    remove,
    removeLabel: 'Gjør om til vegg (Delete)',
  }
}
