// The pill on what stands on the floor: a room, a drawn takdrager, furniture, a counter and a frittstående tekstilvegg
// (docs/pille-og-skuff.md).
import { Move, MoveHorizontal, MoveVertical, RotateCw, Unlink } from 'lucide-react'
import { roomName, roomSize } from '../../../domain/rooms'
import { counterRal, loosenObject, objectFootprint, setMembers, setObjectProduct } from '../../../domain/objects'
import { paintCounter } from '../../../domain/paint'
import { podiumHeights } from '../../../domain/podiums'
import { useMemo } from 'react'
import { calc } from '../../../calc/calc'
import { lengthKind, standardChoices } from '../../../calc/textile/standard'
import type { FreeFrame } from '../../../calc/textile/free'
import { stretchFreeTextile, updateFace } from '../../../domain/textile/free'
import type { Variant } from '../../../domain/types'
import { DEFAULT_STAND_WALLS } from '../../../domain/variant'
import { catalog, counterName, idx, place, pricing, rules } from '../../env'
import { fmt, mm, signed } from '../../format'
import { objectFamily } from '../../objectFamily'
import { FinBtn, QBtn, Sep, Sw } from '../quick/parts'
import type { Chosen } from '../selection'
import { turnObject } from '../turn'
import { Colours, Motifs, MoveTools, type Content, type PillActions } from './parts'

type Of<K extends Chosen['kind']> = Extract<Chosen, { kind: K }>

/** A room: «Fin» (ui/fine.tsx) makes its drags move and stretch it in 250, as Shift + drag on desktop (Byggeregel R5). */
export function roomPill(_p: PillActions, c: Of<'room'>, remove: () => void): Content {
  const r = c.room
  return {
    name: roomName(r),
    meta: roomSize(r),
    body: (
      <FinBtn title={{ on: 'Dra flytter og strekker rommet i 250 · trykk for hele meter igjen', off: 'Flytt og strekk rommet i 250, utenfor meterrasteret · på desktop også Shift + dra' }}>
        <Move size={15} />
      </FinBtn>
    ),
    remove,
  }
}

export function beamPill(_p: PillActions, c: Of<'beam'>, remove: () => void): Content {
  const b = c.beam
  // «Fin» (ui/fine.tsx): drags move it across in 50 mm steps, off the 1 m grid, as Shift + drag on desktop (Byggeregel T15)
  const Across = b.from[1] === b.to[1] ? MoveVertical : MoveHorizontal
  return {
    name: 'Takdrager',
    meta: mm(Math.abs(b.to[0] - b.from[0]) + Math.abs(b.to[1] - b.from[1])),
    body: (
      <FinBtn title={{ on: 'Dra flytter i 50 mm-steg på tvers · trykk for hele meter igjen', off: 'Flytt på tvers i 50 mm-steg, utenfor meterrasteret · på desktop også Shift + dra' }}>
        <Across size={15} />
      </FinBtn>
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
  // Disker og podier: «Disk» or «Podie» by its shape, as on the quote (Byggeregel K13)
  const name = o.sections ? counterName(o) : (family.find((x) => x.artnr === o.product)?.name ?? f?.product.name ?? 'Møbel')
  // A piece of a furniture set moves and turns with its set until it is loosened (Bjørn 14.11.2026)
  const set = o.set ? setMembers(v, o).length : 0
  const turns = (fp && !fp.round) || set > 1
  return {
    name,
    meta: set > 1 ? `i sett med ${set - 1} til` : fp ? `${fp.round ? `ø ${mm(fp.w)}` : `${mm(fp.w)} × ${mm(fp.d)}`}${o.sections ? ` · H ${podiumHeights(o).map((x) => mm(x / 1000)).join('/')}` : ''}${o.rot ? ` · ${o.rot}°` : ''}` : undefined,
    body: (
      <>
        {/* A counter's plates in the wall colours, as on a wall (Byggeregel K6): the whole counter, a printed plate stays as it is */}
        {f?.product.counter && (
          <>
            <Colours value={counterRal(o)} title={(n) => `Disken ${n}`} onPick={(r) => onEdit((x) => paintCounter(x, o.id, r).v)} />
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
        {family.length > 1 && turns && <Sep />}
        {turns && (
          <QBtn title={set > 1 ? 'Roter settet 90° om midten (R)' : 'Roter 90° (R)'} label="Roter" onClick={() => turnObject(p, o.id)}>
            <RotateCw size={15} />
          </QBtn>
        )}
        {set > 1 && (
          <QBtn title="Løsne fra settet · flyttes og roteres for seg" label="Løsne" onClick={() => onEdit((x) => loosenObject(x, o.id))}>
            <Unlink size={15} />
            Løsne
          </QBtn>
        )}
      </>
    ),
    // Disker og podier has a drawer: its sides, one at a time (trinn 2)
    more: !!o.sections,
    remove,
    ...(set > 1 && { removeLabel: 'Slett settet (Delete)' }),
  }
}

export function freePill(p: PillActions, c: Of<'free'>, remove: () => void): Content | null {
  const { textile: t, face } = c
  const frame = p.res.production.free.find((x) => x.textileId === t.id)
  if (!frame) return null
  return {
    name: 'Frittstående tekstilvegg',
    meta: `${frame.pos} · ${fmt(frame.length, 0)} × ${fmt(frame.H, 0)}${lengthKind(frame) === 'kapp' ? ' · kapp' : ''} · side ${face.toUpperCase()}`,
    body: (
      <>
        <Motifs motifs={p.motifs} value={t[face]?.fill ? undefined : (t[face]?.motif ?? null)} onPick={(m) => p.onEdit((x) => updateFace(x, t.id, face, { motif: m }))} />
        <MoveTools p={p} part={{ kind: 'textile', id: t.id }} />
        <StandardLengths p={p} frame={frame} />
      </>
    ),
    more: true,
    remove,
  }
}

/**
 * Byggeregel X9: a cut frame that could be a standard length gets the nearest standard length on each side, with what
 * it does to the quote. One tap moves the frame's free end (the one not stopped against a frame on a wall, X11); the
 * other stays. Bjørn 27.11.2026: so a drawn frame is not cut without the seller knowing our lengths.
 */
function StandardLengths({ p, frame }: { p: PillActions; frame: FreeFrame }) {
  const { v } = p
  const choices = useMemo(() => {
    const min = rules.textile.minLength * 1000
    const sum = (x: Variant) => calc(x, rules, catalog, DEFAULT_STAND_WALLS, pricing).sum
    const now = standardChoices(frame, min).length ? sum(v) : 0
    return standardChoices(frame, min).flatMap((L) => {
      const next = toLength(v, frame, L)
      return next ? [{ L, next, diff: sum(next) - now }] : []
    })
  }, [v, frame])
  if (!choices.length) return null
  return (
    <>
      <Sep />
      {choices.map((c) => (
        <QBtn key={c.L} title={`Standardlengde ${mm(c.L / 1000)} mm, ikke kapp · ${signed(c.diff)} kr på tilbudet`} label={`Standardlengde ${mm(c.L / 1000)}`} onClick={() => p.onEdit(() => c.next)}>
          <span className="q-std">
            <b>{mm(c.L / 1000)}</b>
            <small>{signed(c.diff)} kr</small>
          </span>
        </QBtn>
      ))}
    </>
  )
}

/** The run with its frame `L` mm long: the free end moves, the end that stops at a frame on a wall (X11) stays. */
function toLength(v: Variant, frame: FreeFrame, L: number): Variant | null {
  const d = (L - frame.length) / 1000
  const ends = frame.start ? (['to'] as const) : (['to', 'from'] as const)
  for (const end of ends) {
    const r = stretchFreeTextile(v, rules, frame.textileId, end, d)
    if ('v' in r) return r.v
  }
  return null
}
