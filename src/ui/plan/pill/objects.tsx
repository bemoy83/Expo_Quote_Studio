// The pill on what stands on the floor: a room, a drawn takdrager, furniture, a counter and a frittstående tekstilvegg
// (docs/pille-og-skuff.md).
import { MoveHorizontal, MoveVertical, RotateCw } from 'lucide-react'
import { roomName, roomSize } from '../../../domain/rooms'
import { counterRal, objectFootprint, setCounterRal, setObjectProduct } from '../../../domain/objects'
import { podiumHeights } from '../../../domain/podiums'
import { updateFace } from '../../../domain/textile/free'
import { counterName, idx, place } from '../../env'
import { fmt, mm } from '../../format'
import { objectFamily } from '../../objectFamily'
import { QBtn, Sep, Sw } from '../QuickPicks'
import type { Chosen } from '../selection'
import { turnFree, turnObject } from '../turn'
import { Colours, Motifs, type Content, type PillActions } from './parts'

type Of<K extends Chosen['kind']> = Extract<Chosen, { kind: K }>

export const roomPill = (c: Of<'room'>, remove: () => void): Content => ({ name: roomName(c.room), meta: roomSize(c.room), remove })

export function beamPill(p: PillActions, c: Of<'beam'>, remove: () => void): Content {
  const b = c.beam
  // «Fin»: the next drags move it across in 50 mm steps, off the 1 m grid, as Shift + drag on desktop (Byggeregel T15).
  // Touch has no Shift; it stays on while the beam is selected
  const Across = b.from[1] === b.to[1] ? MoveVertical : MoveHorizontal
  return {
    name: 'Takdrager',
    meta: mm(Math.abs(b.to[0] - b.from[0]) + Math.abs(b.to[1] - b.from[1])),
    body: (
      <QBtn
        setting
        on={c.fine}
        title={c.fine ? 'Dra flytter i 50 mm-steg på tvers · trykk for hele meter igjen' : 'Flytt på tvers i 50 mm-steg, utenfor meterrasteret · på desktop også Shift + dra'}
        label="Fin"
        onClick={() => p.onSelect({ beamId: b.id, ...(!c.fine && { beamFine: true }) })}
      >
        <Across size={15} />
        Fin
      </QBtn>
    ),
    remove,
  }
}

export function objectPill(p: PillActions, c: Of<'object'>, remove: () => void): Content {
  const { v, onEdit } = p
  const o = c.object
  const f = idx.byArtnr.get(o.product)
  const fp = objectFootprint(place, o)
  const family = objectFamily(o.product)
  // Disker og podier: «Disk» or «Podium» by its shape, as on the quote (Byggeregel K13)
  const name = o.sections ? counterName(o.sections) : (family.find((x) => x.artnr === o.product)?.name ?? f?.product.name ?? 'Møbel')
  return {
    name,
    meta: fp ? `${fp.round ? `ø ${mm(fp.w)}` : `${mm(fp.w)} × ${mm(fp.d)}`}${o.sections ? ` · H ${podiumHeights(o).map((x) => mm(x / 1000)).join('/')}` : ''}${o.rot ? ` · ${o.rot}°` : ''}` : undefined,
    body: (
      <>
        {/* A counter's plates in the wall colours, as on a wall (Byggeregel K6, Bjørn 11.11.2026) */}
        {f?.product.counter && (
          <>
            <Colours value={counterRal(o)} title={(n) => `Disken ${n}`} onPick={(r) => onEdit((x) => setCounterRal(x, o.id, r))} />
            {!fp?.round && <Sep />}
          </>
        )}
        {family.length > 1 &&
          family.map((x) => (
            <Sw
              key={x.artnr}
              color={x.color}
              title={x.name}
              on={x.artnr === o.product}
              onClick={() => {
                if (x.artnr === o.product) return
                const next = setObjectProduct(v, place, o.id, x.artnr)
                if (!next) return p.onToast(`Ikke plass til ${x.name.toLowerCase()} her`)
                onEdit(() => next)
              }}
            />
          ))}
        {family.length > 1 && fp && !fp.round && <Sep />}
        {fp && !fp.round && (
          <QBtn title="Roter 90° (R)" label="Roter" onClick={() => turnObject(p, o.id)}>
            <RotateCw size={15} />
          </QBtn>
        )}
      </>
    ),
    // Disker og podier has a drawer: its sides, one at a time (trinn 2)
    more: !!o.sections,
    remove,
  }
}

export function freePill(p: PillActions, c: Of<'free'>, remove: () => void): Content | null {
  const { textile: t, face } = c
  const frame = p.res.production.free.find((x) => x.textileId === t.id)
  if (!frame) return null
  return {
    name: 'Frittstående tekstilvegg',
    meta: `${frame.pos} · ${fmt(frame.length, 0)} × ${fmt(frame.H, 0)} · side ${face.toUpperCase()}`,
    body: (
      <>
        <Motifs motifs={p.motifs} value={t[face]?.fill ? undefined : (t[face]?.motif ?? null)} onPick={(m) => p.onEdit((x) => updateFace(x, t.id, face, { motif: m }))} />
        <Sep />
        <QBtn title="Roter 90° om midten (R)" label="Roter" onClick={() => turnFree(p, t.id)}>
          <RotateCw size={15} />
        </QBtn>
      </>
    ),
    more: true,
    remove,
  }
}
