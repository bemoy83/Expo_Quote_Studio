// The pill on a wall and on a frame or decal on it (docs/pille-og-skuff.md): the wall's colour, print and a textile wall;
// the frame's motif and Fyll ledig vegg; the decal's motif. On a wall with textile walls one button steps between them.
import { Image as ImageIcon, Layers, MoveHorizontal, Unlink } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { calc } from '../../../calc/calc'
import { updateFoil } from '../../../domain/decor'
import { canMoveWall, eraseWalls } from '../../../domain/edit'
import { faces, sideOf } from '../../../domain/faces'
import { wallLength, wallModules } from '../../../domain/grid'
import { wallRal } from '../../../domain/plateDecor'
import { paintWallFace } from '../../../domain/paint'
import { fillPlates, printWall } from '../../../domain/print'
import { neighbourNotes, neighbourText, noteFor } from '../../../domain/neighbour'
import { raiseFor, raiseUnder } from '../../../domain/raise'
import { roomName } from '../../../domain/rooms'
import { addTextile, fillTextile, textileBox, textilesOn, updateTextile } from '../../../domain/textile/inFrame'
import type { TextileWall, Variant, Wall } from '../../../domain/types'
import { DEFAULT_STAND_WALLS } from '../../../domain/variant'
import { isStandWall, wallLabel } from '../../../domain/walls'
import { raiseTop } from '../../../rules/rules'
import { catalog, pricing, rules } from '../../env'
import { fmt, mm, signed } from '../../format'
import { printKept } from '../../fillKeeping'
import { findMotif } from '../../motifs'
import { QBtn, Sep } from '../quick/parts'
import type { Chosen, PlanSelection } from '../selection'
import { faceName } from '../wallDrawer/face'
import { Colours, CornerButton, Motifs, MoveTools, type Content, type PillActions, type SecondFace } from './parts'
import { mountedOn, wallTextiles } from '../../../domain/textile/mounts'
import { loosenMounted, onFeetHeight } from '../../../domain/textile/mount'
import { joinCorner, letGoCorner, wallCorners } from '../../../domain/textile/cornerJoin'

type Of<K extends Chosen['kind']> = Extract<Chosen, { kind: K }>

/** Byggeregel X15: «Hev veggen til N» for a frame over its wall's top, and «Hvit duk» for one showing its textile to a
 *  neighbour (N1), each with what it does to the quote. */
function RaiseOffer({ p, textileId }: { p: PillActions; textileId: string }) {
  const { v } = p
  const offers = useMemo(() => {
    const sum = (x: Variant) => calc(x, rules, catalog, DEFAULT_STAND_WALLS, pricing).sum
    const len = raiseFor(v, rules, textileId)
    const note = noteFor(neighbourNotes(v, rules), textileId)
    const t = wallTextiles(v).find((x) => x.id === textileId)
    const white = note && !note.neutral && t?.fill !== 'white' && mountedOn(v, textileId) ? updateTextile(v, rules, textileId, { fill: 'white' }) : null
    const raised = len ? raiseUnder(v, rules, textileId) : null
    const now = raised || white ? sum(v) : 0
    return [
      ...(raised && len ? [{ key: 'raise', label: `Hev veggen til ${mm(raiseTop(len, rules) / 1000)}`, title: 'Hever veggen så den tar rammen, og skjuler baksiden mot naboen', next: raised, diff: sum(raised) - now }] : []),
      ...(white && !raised ? [{ key: 'white', label: 'Hvit duk', title: 'Hvit duk er nøytral mot naboen', next: white, diff: sum(white) - now }] : []),
    ]
  }, [v, textileId])
  if (!offers.length) return null
  return (
    <>
      <Sep />
      {offers.map((o) => (
        <QBtn key={o.key} title={`${o.title} · ${signed(o.diff)} kr på tilbudet`} label={o.label} onClick={() => p.onEdit(() => o.next)}>
          <span className="q-std">
            <b>{o.label}</b>
            <small>{signed(o.diff)} kr</small>
          </span>
        </QBtn>
      ))}
    </>
  )
}

/** Byggeregel N1: a tall thing near a neighbour says so in its pill. */
const withNeighbour = (v: Variant, id: string, meta: string) => {
  const n = noteFor(neighbourNotes(v, rules), id)
  return n ? `${meta} · ${neighbourText(n).toLowerCase()}` : meta
}

const ratioOf = (p: PillActions, id?: string | null) => findMotif(p.motifs, id ?? undefined)?.ratio ?? 0

export function textilePill(p: PillActions, c: Of<'textile'>, remove: () => void): Content {
  const { v, onEdit } = p
  const T = c.textile
  const filled = fillTextile(v, rules, T.id)
  const fills = wallTextiles(filled).find((x) => x.id === T.id)?.width === T.width
  const motif = T.fill === 'print' || T.fill === undefined ? (T.motif ?? null) : undefined
  const corners = wallCorners(v).filter((k) => k.ids.includes(T.id))
  const loosen = () => {
    const r = loosenMounted(v, rules, T.id)
    if ('error' in r) return p.onToast(r.error)
    onEdit(() => r.v)
    p.onSelect({ freeTextileId: r.id })
    if (!r.heightKept) p.onToast(onFeetHeight(rules))
  }
  return {
    name: 'Tekstilvegg',
    meta: withNeighbour(v, T.id, `${fmt(T.width, 2)} × ${fmt(textileBox(T, rules).height, 2)} m`),
    body: (
      <>
        {layerSwitch(v, c.wall, p.selection, T, p.onSelect)}
        <Motifs motifs={p.motifs} value={motif} onPick={(m) => onEdit((x) => updateTextile(x, rules, T.id, { motif: m, fill: 'print' }))} />
        {!fills && (
          <>
            <Sep />
            <QBtn title="Fyll ledig vegg" onClick={() => onEdit(() => filled)}>
              <MoveHorizontal size={15} />
              Fyll ledig vegg
            </QBtn>
          </>
        )}
        {/* Byggeregel M5: a corner it is in, joined or let go, from its pill too */}
        {corners.map((k) => (
          <span key={`${k.at[0]},${k.at[1]}`} style={{ display: 'contents' }}>
            <Sep />
            <CornerButton joined={k.joined} onClick={() => onEdit((x) => (k.joined ? letGoCorner(x, k.at) : joinCorner(x, k.at)))} />
          </span>
        ))}
        {/* Byggeregel X15: a frame over its wall's top offers to raise the wall (neutral toward a neighbour, N1), and
            one facing a neighbour white textile */}
        <RaiseOffer p={p} textileId={T.id} />
        {/* Byggeregel X13: mounted is a coupling, so «Løsne» takes it off as it takes walls apart (Bjørn 21.11.2026) */}
        <Sep />
        <QBtn title="Løsne fra veggen · står fritt på fotplater foran veggen" label="Løsne" onClick={loosen}>
          <Unlink size={15} />
          Løsne
        </QBtn>
      </>
    ),
    more: true,
    remove,
  }
}

/** Byggeregler X7, X10, M5: the pill on a corner between two frames on system walls: «Løs opp hjørnet» lets the 92LTX
 *  go (the frame on the shorter wall moves against the other's face), «Koble hjørnet» joins them again. */
export function cornerPill(p: PillActions, c: Of<'corner'>): Content {
  const { at, joined } = c.corner
  return {
    name: joined ? 'Hjørne · 92LTX' : 'Hjørne · løst opp',
    meta: joined ? 'rammene deler stolpen' : 'rammen står inntil den andre',
    body: <CornerButton joined={joined} onClick={() => p.onEdit((x) => (joined ? letGoCorner(x, at) : joinCorner(x, at)))} />,
  }
}

export function foilPill(p: PillActions, c: Of<'foil'>, remove: () => void): Content {
  const F = c.foil
  return {
    name: F.full ? 'Print' : 'Dekal',
    meta: F.full ? 'hel plate' : `${fmt(F.width, 2)} m`,
    body: <Motifs motifs={p.motifs} value={F.motif ?? null} onPick={(m) => m && p.onEdit((x) => updateFoil(x, rules, F.id, { motif: m }, ratioOf(p, m)))} />,
    more: true,
    remove,
  }
}

export function wallPill(p: PillActions, c: Of<'wall'>, graphics: SecondFace): Content {
  const { v, onEdit, onSelect } = p
  const { wall: w, side: s } = c
  const stand = isStandWall(w)
  const room = w.room && v.rooms.find((r) => r.id === w.room!.id)
  const label = wallLabel(w)
  const L = wallLength(w)
  const tex = textilesOn(v, w.id, s)
  const ral = wallRal(v, w)
  const textile = () => {
    const r = addTextile(v, rules, w.id, s, L / 2, true)
    if (!r) return p.onToast('Ingen ledig veggflate på denne siden')
    onEdit(() => r.v)
    onSelect({ wallId: w.id, side: s, textileId: r.id })
  }
  /** The whole wall in a colour, as the drawer's paint bucket: printed plates on this face stay as they are. */
  const colour = (r: string) => {
    const x = paintWallFace(v, w.id, s, r)
    if (x.v !== v) onEdit(() => x.v)
    if (x.skipped) p.onToast(printKept(x.skipped))
  }
  const print = (m: string) => {
    if (!fillPlates(v, rules, w, s).length) return p.onToast('Ingen plate på denne siden kan ha print')
    onEdit((x) => printWall(x, rules, w.id, s, m, ratioOf(p, m)))
  }
  return {
    name: room ? `${roomName(room)} · vegg` : stand ? `${label} · standvegg` : 'Innervegg',
    meta: withNeighbour(v, w.id, `${fmt(L, L % 1 ? 1 : 0)} m`),
    body: graphics.on ? (
      <>
        <Motifs motifs={p.motifs} value={undefined} onPick={(m) => m && print(m)} />
        <Sep />
        <QBtn title="Tilbake til farger" label="Farger" onClick={() => graphics.set(false)}>
          Farger
        </QBtn>
      </>
    ) : (
      <>
        {layerSwitch(v, w, p.selection, undefined, onSelect)}
        <Colours value={ral} title={(n) => `Hele veggen ${n}`} onPick={colour} />
        <Sep />
        {/* With textile walls on the wall the switch picks them; the button adds one on a face without */}
        {!tex.length && (
          <QBtn title="Legg til tekstilvegg på ledig flate" onClick={textile}>
            <i className="tex-thumb q-tex" />
            Tekstilvegg
          </QBtn>
        )}
        <QBtn title="Grafikk: print over hele siden" onClick={() => graphics.set(true)}>
          <ImageIcon size={15} />
          Grafikk
        </QBtn>
        {/* Byggeregel V7: an inner wall moves in 250 with Shift or Fin, as a free textile wall does */}
        {canMoveWall(w) && <MoveTools p={p} part={{ kind: 'wall', id: w.id }} />}
      </>
    ),
    more: true,
    remove: stand
      ? undefined
      : () => {
          onEdit((x) => eraseWalls(x, wallModules(w).map((m) => m.key)))
          onSelect({})
        },
    removeLabel: stand ? undefined : w.room ? 'Åpne siden' : 'Fjern veggen',
  }
}

/**
 * On a wall with textile walls on it: one button, its icon and where it goes («Tekstil», «Vegg»), that steps wall → the
 * textile on each face → wall (Bjørn 8.11.2026), so a click that took the wall for the textile, or the other way round,
 * is put right in one tap. The pill's name says which is chosen. Per face the textile over the selected one's middle,
 * else the face's first. Nothing on a wall without textile walls.
 */
function layerSwitch(v: Variant, w: Wall, sel: PlanSelection, T: TextileWall | undefined, onSelect: (s: PlanSelection) => void): ReactNode {
  const mid = T ? T.from + T.width / 2 : null
  const onFace = faces(v, w).flatMap((s) => {
    const on = textilesOn(v, w.id, s)
    const t = (mid !== null && on.find((x) => x.from <= mid && x.from + x.width >= mid)) || on[0]
    return t ? [{ s, t }] : []
  })
  if (!onFace.length) return null
  const side = T ? sideOf(v, T) : sel.side
  // The wall, then each face's textile, round again
  const steps: PlanSelection[] = [{ wallId: w.id, side }, ...onFace.map(({ s, t }) => ({ wallId: w.id, side: s, textileId: t.id }))]
  const at = T ? steps.findIndex((x) => x.textileId === T.id) : 0
  const next = steps[(Math.max(0, at) + 1) % steps.length]
  const title = next.textileId ? `Velg tekstilveggen ${faceName(w, next.side!).toLowerCase()}` : 'Velg veggen'
  // Names where a tap goes, with an icon and text like «Fyll ledig vegg» (Bjørn 8.11.2026)
  const text = next.textileId ? (onFace.length > 1 ? `Tekstil ${faceName(w, next.side!).toLowerCase()}` : 'Tekstil') : 'Vegg'
  return (
    <>
      <QBtn title={title} label={title} onClick={() => onSelect(next)}>
        <Layers size={15} />
        {text}
      </QBtn>
      <Sep />
    </>
  )
}
