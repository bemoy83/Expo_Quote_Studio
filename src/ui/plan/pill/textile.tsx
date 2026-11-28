// The pill on a textile wall, one for every textile wall whatever it stands on (Byggeregel X18, Bjørn 28.11.2026): its
// position and visible size, the motif on the face seen, the standard lengths of a cut frame (X9). Only what the
// mounting needs is added: on a wall the switch to the wall, Fyll ledig vegg, its corners, Hev veggen and Løsne from
// the wall; on foot plates turning it and Løsne from its group.
import { MoveHorizontal, Unlink } from 'lucide-react'
import { useMemo } from 'react'
import { beamGone } from '../../../calc/beams/beamLift'
import { calc } from '../../../calc/calc'
import { builtFrame, type BuiltFrame } from '../../../calc/textile/production'
import { lengthKind, standardChoices } from '../../../calc/textile/standard'
import { joinCorner, letGoCorner, wallCorners } from '../../../domain/textile/cornerJoin'
import { resizeTextile, seenFaces, updateFace } from '../../../domain/textile/edit'
import { stretchFreeTextile } from '../../../domain/textile/free'
import { fillTextile } from '../../../domain/textile/inFrame'
import { loosenMounted, onFeetHeight } from '../../../domain/textile/mount'
import { wallTextiles } from '../../../domain/textile/mounts'
import type { Variant } from '../../../domain/types'
import { DEFAULT_STAND_WALLS } from '../../../domain/variant'
import { catalog, pricing, rules } from '../../env'
import { fmt, mm, signed } from '../../format'
import { QBtn, Sep } from '../quick/parts'
import type { Chosen } from '../selection'
import { CornerButton, Motifs, MoveTools, type Content, type PillActions } from './parts'
import { RaiseOffer } from './RaiseOffer'
import { layerSwitch } from './wall'
import { withNeighbour } from './notes'

type Of<K extends Chosen['kind']> = Extract<Chosen, { kind: K }>

/** Byggeregel T19: a tall textile that takes the takdrager over it away says so in its pill (the reason is in the drawer). */
const withBeams = (v: Variant, id: string, meta: string) => (beamGone(v, rules, id) ? `${meta} · uten takdrager` : meta)

export function textilePill(p: PillActions, c: Of<'textile'> | Of<'free'>, remove: () => void): Content | null {
  const { v, onEdit } = p
  const id = c.textile.id
  const f = builtFrame(p.res.production, id)
  const t = v.textiles.find((x) => x.id === id)
  if (!f || !t) return null
  const onWall = c.kind === 'textile'
  // The face seen: out from the wall when mounted, the one chosen on foot plates (X18)
  const face = onWall ? seenFaces(v, id)[0] : c.face
  const W = onWall ? f.faces[0].W : f.faces[face === 'a' ? 0 : 1].W
  const motif = t[face]?.fill ? undefined : (t[face]?.motif ?? null)
  const meta = [f.pos, `${fmt(W, 0)} × ${fmt(f.H, 0)}`, lengthKind(f) === 'kapp' ? 'kapp' : '', onWall ? '' : `side ${face.toUpperCase()}`].filter(Boolean).join(' · ')
  return {
    name: 'Tekstilvegg',
    meta: withBeams(v, id, withNeighbour(v, id, meta)),
    body: (
      <>
        {c.kind === 'textile' && layerSwitch(v, c.wall, p.selection, c.textile, p.onSelect)}
        <Motifs motifs={p.motifs} value={motif} onPick={(m) => onEdit((x) => updateFace(x, id, face, { motif: m }))} />
        {c.kind === 'textile' ? <OnWall p={p} id={id} /> : <MoveTools p={p} part={{ kind: 'textile', id }} />}
        <StandardLengths p={p} frame={f} />
        {c.kind === 'textile' && <OffWall p={p} id={id} />}
      </>
    ),
    more: true,
    remove,
  }
}

/** What a frame on a wall has because it hangs there: Fyll ledig vegg and the 92LTX corners it is in (M5). */
function OnWall({ p, id }: { p: PillActions; id: string }) {
  const { v, onEdit } = p
  const view = wallTextiles(v).find((x) => x.id === id)
  const filled = fillTextile(v, rules, id)
  const fills = wallTextiles(filled).find((x) => x.id === id)?.width === view?.width
  const corners = wallCorners(v).filter((k) => k.ids.includes(id))
  return (
    <>
      {!fills && (
        <>
          <Sep />
          <QBtn title="Fyll ledig vegg" onClick={() => onEdit(() => filled)}>
            <MoveHorizontal size={15} />
            Fyll ledig vegg
          </QBtn>
        </>
      )}
      {corners.map((k) => (
        <span key={`${k.at[0]},${k.at[1]}`} style={{ display: 'contents' }}>
          <Sep />
          <CornerButton joined={k.joined} onClick={() => onEdit((x) => (k.joined ? letGoCorner(x, k.at) : joinCorner(x, k.at)))} />
        </span>
      ))}
    </>
  )
}

/** Byggeregler X13, X15: a frame over its wall's top offers to raise the wall, and «Løsne» takes it off the wall as it
 *  takes walls apart (Bjørn 21.11.2026). */
function OffWall({ p, id }: { p: PillActions; id: string }) {
  const loosen = () => {
    const r = loosenMounted(p.v, rules, id)
    if ('error' in r) return p.onToast(r.error)
    p.onEdit(() => r.v)
    p.onSelect({ textileId: r.id })
    if (!r.heightKept) p.onToast(onFeetHeight(rules))
  }
  return (
    <>
      <RaiseOffer p={p} textileId={id} />
      <Sep />
      <QBtn title="Løsne fra veggen · står fritt på fotplater foran veggen" label="Løsne" onClick={loosen}>
        <Unlink size={15} />
        Løsne
      </QBtn>
    </>
  )
}

/**
 * Byggeregel X9: a cut frame that could be a standard length gets the nearest standard length on each side, with what
 * it does to the quote, on a wall as on foot plates (Bjørn 28.11.2026: for now; 92LTX may give new standard lengths).
 * Only the lengths it can take: on a wall those that fit in its span (X4). On foot plates one tap moves the free end
 * (the one not stopped against a frame on a wall, X11); the other stays. Bjørn 27.11.2026: so a drawn frame is not cut
 * without the seller knowing our lengths.
 */
function StandardLengths({ p, frame }: { p: PillActions; frame: BuiltFrame }) {
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

/** The frame `L` mm long. On foot plates the free end moves, the end that stops at a frame on a wall (X11) stays. */
function toLength(v: Variant, frame: BuiltFrame, L: number): Variant | null {
  if (frame.mount === 'vegg') {
    const next = resizeTextile(v, rules, frame.textileId, L / 1000)
    return next && Math.round((builtLength(next, frame.textileId) ?? 0)) === L ? next : null
  }
  const d = (L - frame.length) / 1000
  const ends = frame.start ? (['to'] as const) : (['to', 'from'] as const)
  for (const end of ends) {
    const r = stretchFreeTextile(v, rules, frame.textileId, end, d)
    if ('v' in r) return r.v
  }
  return null
}

/** The frame length of textile wall `id` in `v`, mm. */
function builtLength(v: Variant, id: string): number | undefined {
  const t = v.textiles.find((x) => x.id === id)
  return t ? Math.hypot(t.to[0] - t.from[0], t.to[1] - t.from[1]) * 1000 : undefined
}
