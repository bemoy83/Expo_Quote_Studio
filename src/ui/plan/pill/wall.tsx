// The pill on a wall and on a frame or decal on it (docs/pille-og-skuff.md): the wall's colour, print and a textile wall;
// the frame's motif and Fyll ledig vegg; the decal's motif. On a wall with textile walls one button steps between them.
import { Image as ImageIcon, Layers, MoveHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { updateFoil } from '../../../domain/decor'
import { paintDoors } from '../../../domain/doors'
import { eraseWalls, setWallPlate } from '../../../domain/edit'
import { faces, sideOf } from '../../../domain/faces'
import { wallLength, wallModules } from '../../../domain/grid'
import { wallRal } from '../../../domain/panels'
import { clearPrint, fillPlates, printWall } from '../../../domain/print'
import { roomName } from '../../../domain/rooms'
import { addTextile, fillTextile, textileBox, textilesOn, updateTextile } from '../../../domain/textile/inFrame'
import type { TextileWall, Variant, Wall } from '../../../domain/types'
import { isStandWall, wallLabel } from '../../../domain/walls'
import { rules } from '../../env'
import { fmt } from '../../format'
import { findMotif } from '../../motifs'
import { QBtn, Sep } from '../QuickPicks'
import type { Chosen, PlanSelection } from '../selection'
import { faceName } from '../wallDrawer/face'
import { Colours, Motifs, type Content, type PillActions, type SecondFace } from './parts'

type Of<K extends Chosen['kind']> = Extract<Chosen, { kind: K }>

const ratioOf = (p: PillActions, id?: string | null) => findMotif(p.motifs, id ?? undefined)?.ratio ?? 0

export function textilePill(p: PillActions, c: Of<'textile'>, remove: () => void): Content {
  const { v, onEdit } = p
  const T = c.textile
  const filled = fillTextile(v, rules, T.id)
  const fills = filled.textiles.find((x) => x.id === T.id)?.width === T.width
  const motif = T.fill === 'print' || T.fill === undefined ? (T.motif ?? null) : undefined
  return {
    name: 'Tekstilvegg',
    meta: `${fmt(T.width, 2)} × ${fmt(textileBox(T, rules).height, 2)} m`,
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
      </>
    ),
    more: true,
    remove,
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
  const print = (m: string) => {
    if (!fillPlates(v, rules, w, s).length) return p.onToast('Ingen plate på denne siden kan ha print')
    onEdit((x) => printWall(x, rules, w.id, s, m, ratioOf(p, m)))
  }
  return {
    name: room ? `${roomName(room)} · vegg` : stand ? `${label} · standvegg` : 'Innervegg',
    meta: `${fmt(L, L % 1 ? 1 : 0)} m`,
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
        <Colours value={ral} title={(n) => `Hele veggen ${n}`} onPick={(r) => onEdit((x) => clearPrint(paintDoors(setWallPlate(x, w.id, r), w.id, r), w.id, s))} />
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
