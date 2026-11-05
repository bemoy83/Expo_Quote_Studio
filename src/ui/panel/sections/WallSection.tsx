// Panel tab Vegger: the wall plate for all walls, drawn inner beams, back rooms and openings.
import { Blinds, Box, DoorClosed, Paintbrush, Trash2, Ungroup } from 'lucide-react'
import { bounds } from '../../../domain/outline'
import { dissolveRoom, isRoomWallId, removeRoom, ROOM_LABELS, roomName, roomOpenings, roomSize, updateRoom } from '../../../domain/rooms'
import { INK, LAYER_COLOR, SUNKEN } from '../../colors'
import { IconButton } from '../../controls'
import { catalog, productOf, rules, wallPlates } from '../../env'
import { count, fmt, kr, mm } from '../../format'
import { penOn } from '../../tools'
import { ProductRow, Swatch, VariantChips } from '../ProductRow'
import type { RailProps } from '../Rail'

export function WallSection({ v, res, brush, tool, pick, onEdit, onAddRoom, onSelect, selection }: RailProps) {
  const plates = wallPlates()
  const di = Math.max(0, plates.findIndex((p) => p.ral === v.defaultPlate))
  const def = plates[di]
  const wallPen = penOn(tool, brush, 'wall')
  const beamPen = penOn(tool, brush, 'beam')
  const wallLm = res.keyFigures.wallLm
  const openingCount = (a: string) => v.openings.filter((o) => o.product === a).length
  return (
    <>
      <div className="panel-sec eyebrow">Vegger</div>
      <ProductRow
        on
        pen={wallPen}
        thumb={<Swatch color={def?.color} />}
        title={productOf(def?.artnr ?? '')?.name ?? 'Vegg'}
        meta={
          <>
            {def?.name} · <span className="num">{def?.artnr} · {kr(def?.price ?? 0)} kr/lm</span>
          </>
        }
        result={wallLm ? `${fmt(wallLm)} lm` : null}
        action={<IconButton icon={Paintbrush} label="Tegn innervegg i plan" pressed={wallPen && tool === 'brush'} onClick={() => pick({ kind: 'wall', ral: v.defaultPlate })} />}
        chips={
          <VariantChips
            chips={plates.map((p) => ({ name: `${p.name} · RAL ${p.ral}`, color: p.color }))}
            selected={di}
            onSelect={(i) => {
              onEdit((x) => ({ ...x, defaultPlate: plates[i].ral! }))
              if (wallPen) pick({ kind: 'wall', ral: plates[i].ral! })
            }}
          />
        }
      />
      <p className="panel-note">Gjelder alle vegger. Velg en vegg i planen for å gi den egen farge.</p>

      <div className="panel-sec eyebrow">Innvendig takdrager</div>
      <ProductRow
        on={beamPen || !!v.innerBeams?.length}
        pen={beamPen}
        thumb={
          <svg viewBox="-1 -1 2 2" width="28" height="28" aria-hidden>
            <path d="M-.9 0 H.9" stroke={INK} strokeWidth=".14" strokeDasharray=".3 .15" />
          </svg>
        }
        title="Takdrager tilvalg"
        meta={`${mm(rules.beam.height)} × ${mm(rules.beam.thickness)} mm, alltid utstillerens. En ende på en annen takdrager henger på krok, ellers stolpe med fotplate. Deles i hele meter (maks ${fmt(rules.beam.max)} m).`}
        result={res.keyFigures.innerBeamLm ? `${fmt(res.keyFigures.innerBeamLm)} m` : null}
        action={<IconButton icon={Paintbrush} label="Tegn innvendig takdrager i plan" pressed={beamPen && tool === 'brush'} onClick={() => pick({ kind: 'beam' })} />}
      />

      <div className="panel-sec eyebrow">Bakrom</div>
      <ProductRow
        thumb={
          <svg viewBox="-1 -1 2 2" width="28" height="28" aria-hidden>
            <rect x="-.7" y="-.7" width="1.4" height="1.4" fill={SUNKEN} />
            <path d="M-.7 .7 V-.7 H.7 V.7 H.25 M-.25 .7 H-.7" fill="none" stroke={LAYER_COLOR.openings} strokeWidth=".1" />
          </svg>
        }
        title="Bakrom"
        on={v.rooms.length > 0}
        meta="1 × 1 m med dør i et ledig hjørne, eller tegn vegger rundt et område og sett inn en dør. Bygger bare veggene som mangler. Flytt: dra gulvet i planen, veggen eller taket i 3D. Størrelse: dra en vegg i planen, toppkanten av veggen i 3D."
        result={v.rooms.length ? `${v.rooms.length} rom` : null}
        action={
          <IconButton
            icon={Box}
            label="Legg til bakrom"
            onClick={onAddRoom}
          />
        }
      />
      {v.rooms.map((r) => {
        const doors = roomOpenings(v, r).length
        const label = roomName(r)
        const at = bounds(r.outline)
        const selected = selection?.roomId === r.id || isRoomWallId(selection?.wallId ?? '', r.id)
        return (
          <ProductRow
            key={r.id}
            on={selected}
            thumb={<Box size={16} />}
            title={
              <button type="button" className="link" onClick={() => onSelect({ roomId: r.id })}>
                {label} {roomSize(r)}
              </button>
            }
            meta={`${doors ? count(doors, 'åpning', 'åpninger') : 'ingen åpning'} · plassert ${at.x} · ${at.y} m`}
            action={
              <>
                <IconButton icon={Ungroup} label="Gjør om til vanlige vegger" onClick={() => onEdit((x) => dissolveRoom(x, r.id))} />
                <IconButton icon={Trash2} label={`Fjern ${label.toLowerCase()}`} onClick={() => onEdit((x) => removeRoom(x, r.id))} />
              </>
            }
            chips={
              <VariantChips
                chips={ROOM_LABELS.map((name) => ({ name }))}
                selected={ROOM_LABELS.indexOf(label as (typeof ROOM_LABELS)[number])}
                onSelect={(i) => onEdit((x) => updateRoom(x, r.id, { label: i === 0 ? undefined : ROOM_LABELS[i] }))}
              />
            }
          />
        )
      })}

      <div className="panel-sec eyebrow">Åpninger</div>
      {catalog.products
        .filter((p) => p.opening)
        .map((p) => {
          const a = p.variants[0].artnr
          const n = openingCount(a)
          const pen = penOn(tool, brush, 'opening', a)
          return (
            <ProductRow
              key={p.id}
              on={n > 0}
              pen={pen}
              thumb={p.opening === 'door' ? <DoorClosed size={16} /> : <Blinds size={16} />}
              title={p.name}
              meta={
                <>
                  <span className="num">{a}</span> · <span className="num">{kr(p.variants[0].price)} kr</span> inkl. overstykke · klikk en vegg eller tom kant
                </>
              }
              result={n ? `${n} stk` : null}
              action={<IconButton icon={Paintbrush} label={`Tegn ${p.name.toLowerCase()} i plan`} pressed={pen && tool === 'brush'} onClick={() => pick({ kind: 'opening', product: a })} />}
            />
          )
        })}
      <p className="panel-note">Åpninger kan stå på alle vegger, flere på samme vegg. Tøm gjør en åpning til vegg igjen.</p>
    </>
  )
}
