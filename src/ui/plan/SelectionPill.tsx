// The selection pill (docs/pille-og-skuff.md): quick grips on what is selected in Velg, over the object on the plan.
// One build for all: name and size · colour or motif · rotate (where it makes sense) · Mer (the drawer) · remove.
// Shown as soon as a click selects; hidden while dragging,
// while the drawer is open, with a pen in hand and in 3D (PlanView decides). Where it stands: pillAnchor.ts.
import { ArrowDown, ArrowLeftRight, ArrowUp, Blinds, Copy, DoorClosed, FlipHorizontal2, Image as ImageIcon, Layers, MoveHorizontal, MoveVertical, PanelBottomOpen, Plus, RotateCw, Trash2 } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { CalcResult } from '../../calc/calc'
import { wallLabel } from '../../calc/production'
import { updateFoil } from '../../domain/decor'
import { canFlipSwing, doorFace, doorRal, flipHinge, flipSwing, openingRoom, setDoorRal, setOpeningProduct, paintDoors } from '../../domain/doors'
import { eraseWalls, setWallPlate } from '../../domain/edit'
import { faces, sideOf, type FaceSide } from '../../domain/faces'
import { rotateLane } from '../../domain/floor/edit'
import { CELL, wallLength, wallModules } from '../../domain/grid'
import { wallRal } from '../../domain/panels'
import { clearPrint, fillPlates, printWall } from '../../domain/print'
import { roomName, roomSize } from '../../domain/rooms'
import { addShelvesAbove, copyShelvesNear, highWarning, moveShelves, offRow, shelfRow, shelvesIn, shelvesOf, tooHigh, type ShelvesMove } from '../../domain/shelves'
import { addTextile, fillTextile, textileBox, textilesOn, updateTextile } from '../../domain/textile/inFrame'
import type { TextileWall, Variant, Wall } from '../../domain/types'
import { isStandWall } from '../../domain/walls'
import type { Motif } from '../../persistence/file'
import { setObjectProduct } from '../../domain/objects'
import { updateFace } from '../../domain/textile/free'
import { idx, openingProducts, place, productOf, rules, wallPlates } from '../env'
import { objectFamily } from '../objectFamily'
import { fmt, mm } from '../format'
import { findMotif } from '../motifs'
import { Segmented } from '../controls'
import { placePill, type PillPlace } from './pillAnchor'
import { QBtn, QName, Sep, Sw } from './QuickPicks'
import { faceName } from './wallDrawer/face'
import { chosenShelves, deleteSelection, type PlanSelection } from './selection'
import { turnFree, turnObject } from './turn'

type Edit = (fn: (v: Variant) => Variant, history?: boolean) => void

export interface PillActions {
  v: Variant
  res: CalcResult
  selection: PlanSelection
  motifs: Motif[]
  onEdit: Edit
  onSelect: (s: PlanSelection) => void
  onOpenDrawer: (s: PlanSelection) => void
  onToast: (text: string) => void
}


/** Motifs on the pill: the newest of the library (the customer's own come last), plus the chosen one. */
const MOTIFS = 5
/** Colours on the pill, as on the wall tool's quick picks. */
const COLOURS = 8

export function SelectionPill(p: PillActions & { place: PillPlace }) {
  const ref = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  /** «Grafikk» on a wall: the motif list takes the colours' place. */
  const [graphics, setGraphics] = useState(false)
  const key = JSON.stringify(p.selection)
  const [graphicsFor, setGraphicsFor] = useState(key)
  if (graphicsFor !== key) {
    setGraphicsFor(key)
    setGraphics(false)
  }
  // Its own size, to keep it inside the plan; it changes with what it shows
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setDims({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const c = content(p, graphics, setGraphics)
  if (!c) return null
  const at = placePill(p.place, dims)
  return (
    <div ref={ref} className="sel-pill" style={{ left: at.left, top: at.top, visibility: dims.w ? 'visible' : 'hidden' }} role="toolbar" aria-label={`Valgt: ${c.name}`} onPointerDown={(e) => e.stopPropagation()}>
      <QName name={c.name} meta={c.meta} />
      {c.body && (
        <>
          <Sep />
          {c.body}
        </>
      )}
      {(c.more || c.remove) && <Sep />}
      {c.more && (
        <QBtn title="Detaljer · åpne skuffen med alle innstillinger og veggrisset" label="Detaljer" onClick={() => p.onOpenDrawer(p.selection)}>
          <PanelBottomOpen size={15} />
          Detaljer
        </QBtn>
      )}
      {c.remove && (
        <QBtn title={c.removeLabel ?? 'Fjern (Delete)'} label={c.removeLabel ?? 'Fjern'} onClick={c.remove}>
          <Trash2 size={15} />
        </QBtn>
      )}
    </div>
  )
}

interface Content {
  name: string
  meta?: string
  body?: ReactNode
  more?: boolean
  remove?: () => void
  removeLabel?: string
}

/** The face a wall's grips act on: the one the selection names, else as the drawer would show it. */
function faceOf(v: Variant, w: Wall, sel: PlanSelection): FaceSide {
  const fs = faces(v, w)
  const o = sel.openingId ? v.openings.find((x) => x.id === sel.openingId) : undefined
  const want = sel.side ?? (o && doorFace(v, w, o))
  return want && fs.includes(want) ? want : fs[0]
}

function content(p: PillActions, graphics: boolean, setGraphics: (b: boolean) => void): Content | null {
  const { v, selection: sel, onEdit, onSelect, motifs } = p
  const del = () => {
    const d = deleteSelection(v, sel)
    if (!d) return
    onEdit(d.edit)
    onSelect({})
  }
  const ratioOf = (id?: string | null) => findMotif(motifs, id ?? undefined)?.ratio ?? 0

  if (sel.fill) {
    const own = v.floor.tiles.filter((t) => t.fill === sel.fill)
    if (!own.length) return null
    const m2 = own.reduce((a, t) => a + t.w * t.h * CELL * CELL, 0)
    return { name: `Engangsteppe ${variantName(own[0].product)}`, meta: `${fmt(m2, 1)} m²`, more: true, remove: del }
  }
  if (sel.lane) {
    const lane = sel.lane
    const t = v.floor.tiles.find((x) => x.i === lane.i && x.j === lane.j)
    if (!t) return null
    const len = (t.roll === 'y' ? t.h : t.w) * CELL
    return {
      name: 'Bane',
      meta: `${variantName(t.product)} · ${mm(len)}`,
      body: (
        <QBtn
          title="Snu banen (R)"
          label="Snu"
          onClick={() => {
            const r = rotateLane(v, lane)
            if (!r) return p.onToast('Banen får ikke plass snudd')
            onEdit(() => r.v)
            onSelect({ lane: { i: r.lane.i, j: r.lane.j } })
          }}
        >
          <RotateCw size={15} />
        </QBtn>
      ),
      more: true,
      remove: del,
    }
  }
  if (sel.roomId) {
    const r = v.rooms.find((x) => x.id === sel.roomId)
    return r ? { name: roomName(r), meta: roomSize(r), remove: del } : null
  }
  if (sel.beamId) {
    const b = v.innerBeams?.find((x) => x.id === sel.beamId)
    if (!b) return null
    return { name: 'Takdrager', meta: mm(Math.abs(b.to[0] - b.from[0]) + Math.abs(b.to[1] - b.from[1])), remove: del }
  }
  if (sel.objectId) {
    const o = v.objects.find((x) => x.id === sel.objectId)
    if (!o) return null
    const f = idx.byArtnr.get(o.product)
    const fp = f?.product.footprint
    const family = objectFamily(o.product)
    const name = family.find((x) => x.artnr === o.product)?.name ?? f?.product.name ?? 'Møbel'
    return {
      name,
      meta: fp ? `${fp.round ? `ø ${mm(fp.w)}` : `${mm(fp.w)} × ${mm(fp.d)}`}${o.rot ? ` · ${o.rot}°` : ''}` : undefined,
      body: (
        <>
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
      remove: del,
    }
  }
  if (sel.freeTextileId) {
    const t = v.freeTextiles.find((x) => x.id === sel.freeTextileId)
    const frame = p.res.production.free.find((x) => x.textileId === sel.freeTextileId)
    if (!t || !frame) return null
    const face = sel.freeFace ?? 'a'
    return {
      name: 'Frittstående tekstilvegg',
      meta: `${frame.pos} · ${fmt(frame.length, 0)} × ${fmt(frame.H, 0)} · side ${face.toUpperCase()}`,
      body: (
        <>
          <Motifs motifs={motifs} value={t[face]?.fill ? undefined : (t[face]?.motif ?? null)} onPick={(m) => onEdit((x) => updateFace(x, t.id, face, { motif: m }))} />
          <Sep />
          <QBtn title="Roter 90° om midten (R)" label="Roter" onClick={() => turnFree(p, t.id)}>
            <RotateCw size={15} />
          </QBtn>
        </>
      ),
      more: true,
      remove: del,
    }
  }

  // A wall, or a door, frame or decal on it: they open in the wall drawer
  const o = sel.openingId ? v.openings.find((x) => x.id === sel.openingId) : undefined
  const w = v.walls.find((x) => x.id === (o?.wallId ?? sel.wallId))
  if (!w) return null
  const s = faceOf(v, w, sel)

  if (o) {
    const product = productOf(o.product)
    const door = product?.opening === 'door'
    const room = openingRoom(v, o)
    const where = room ? roomName(room).toLowerCase() : isStandWall(w) ? 'standvegg' : 'innervegg'
    const ral = doorRal(v, o)
    return {
      name: product?.name ?? (door ? 'Dør' : 'Forheng'),
      meta: `${where} · ${door ? mm(rules.door.swing) : mm(rules.wall.cc - rules.wall.post)}`,
      body: (
        <>
          {openingProducts().map((x) => {
            const a = x.variants[0].artnr
            return (
              <QBtn key={x.id} on={o.product === a} title={x.name} label={x.opening === 'door' ? 'Dør' : 'Forheng'} onClick={() => o.product !== a && onEdit((y) => setOpeningProduct(y, o.id, a))}>
                {x.opening === 'door' ? <DoorClosed size={15} /> : <Blinds size={15} />}
                {x.opening === 'door' ? 'Dør' : 'Forheng'}
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
        </>
      ),
      more: true,
      remove: del,
      removeLabel: 'Gjør om til vegg (Delete)',
    }
  }

  const T = sel.textileId ? v.textiles.find((x) => x.id === sel.textileId) : undefined
  const sw = layerSwitch(v, w, sel, T, onSelect)
  if (T) {
    const filled = fillTextile(v, rules, T.id)
    const fills = filled.textiles.find((x) => x.id === T.id)?.width === T.width
    const motif = T.fill === 'print' || T.fill === undefined ? (T.motif ?? null) : undefined
    return {
      name: 'Tekstilvegg',
      meta: `${fmt(T.width, 2)} × ${fmt(textileBox(T, rules).height, 2)} m`,
      body: (
        <>
          {sw}
          <Motifs motifs={motifs} value={motif} onPick={(m) => onEdit((x) => updateTextile(x, rules, T.id, { motif: m, fill: 'print' }))} />
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
      remove: del,
    }
  }

  const F = sel.foilId ? v.foils.find((x) => x.id === sel.foilId) : undefined
  if (F) {
    return {
      name: F.full ? 'Print' : 'Dekal',
      meta: F.full ? 'hel plate' : `${fmt(F.width, 2)} m`,
      body: <Motifs motifs={motifs} value={F.motif ?? null} onPick={(m) => m && onEdit((x) => updateFoil(x, rules, F.id, { motif: m }, ratioOf(m)))} />,
      more: true,
      remove: del,
    }
  }

  const H = sel.shelfId ? shelvesOf(v).find((x) => x.id === sel.shelfId) : undefined
  if (H) {
    // The row moves as one; «Bare denne» takes the one shelf out of it (Bjørn 9.11.2026)
    const ids = chosenShelves(v, sel)
    const n = ids.length
    const row = shelfRow(v, H.id).length
    const stack = shelvesIn(v, H.wallId, H.module, sideOf(v, H))
    const go = (m: ShelvesMove, why: string) => {
      const next = moveShelves(v, rules, ids, m)
      if (next === v) return p.onToast(why)
      onEdit(() => next)
      const y = shelvesOf(next).find((x) => x.id === H.id)!.y
      if (tooHigh(rules, y)) p.onToast(highWarning(rules))
    }
    const step = rules.shelf.step
    const what = n > 1 ? 'Raden' : 'Hyllen'
    return {
      name: n > 1 ? 'Hyllerad' : 'Hylle',
      meta: [
        n > 1 ? `${n} hyller` : '',
        `${mm(H.y)} mm`,
        stack.length > 1 ? `${stack.indexOf(H) + 1} av ${stack.length}` : '',
        n === 1 && offRow(v, H.id) ? 'avviker fra raden' : '',
      ]
        .filter(Boolean)
        .join(' · '),
      body: graphics ? (
        <>
          <Segmented<number>
            label="Høyde fra gulvet"
            value={H.y}
            onChange={(y) => {
              go({ y }, `${what} kan ikke stå på ${mm(y)} her`)
              setGraphics(false)
            }}
            options={rules.shelf.heights.map((h) => ({ value: h, title: `${mm(h)} mm fra gulvet`, label: <span className="num">{mm(h)}</span> }))}
          />
          <Sep />
          <QBtn title="Tilbake til Ned og Opp" label="Tilbake" onClick={() => setGraphics(false)}>
            Tilbake
          </QBtn>
        </>
      ) : (
        <>
          {/* Up and down explain themselves (arrows), so they go without text to keep the pill short */}
          <QBtn title={`Senk ${mm(step)} mm`} label="Senk" onClick={() => go({ dy: -step }, `${what} kan ikke gå lavere her`)}>
            <ArrowDown size={15} />
          </QBtn>
          <QBtn title={`Hev ${mm(step)} mm`} label="Hev" onClick={() => go({ dy: step }, `${what} kan ikke gå høyere her`)}>
            <ArrowUp size={15} />
          </QBtn>
          <QBtn title="Faste høyder" label="Høyde" onClick={() => setGraphics(true)}>
            <MoveVertical size={15} />
            Høyde
          </QBtn>
          <Sep />
          <QBtn
            title={n > 1 ? 'Legg til en rad til over (eller under)' : 'Legg til en hylle til i samme felt'}
            label={n > 1 ? 'Rad til' : 'Hylle til'}
            onClick={() => {
              const r = addShelvesAbove(v, rules, ids)
              if ('error' in r) return p.onToast(r.error)
              onEdit(() => r.v)
              onSelect({ wallId: w.id, side: s, shelfId: r.ids[ids.indexOf(H.id)] ?? r.ids[0] })
            }}
          >
            <Plus size={15} />
            {n > 1 ? 'Rad til' : 'Hylle til'}
          </QBtn>
          <QBtn
            title={n > 1 ? 'Kopier raden til nærmeste ledige felt · på desktop også Alt + dra' : 'Kopier hyllen til nærmeste ledige felt · på desktop også Alt + dra'}
            label="Kopier"
            onClick={() => {
              const r = copyShelvesNear(v, rules, ids, s === 1 ? 1 : -1)
              if (!r) return p.onToast('Ingen ledige felt på denne siden')
              onEdit(() => r.v)
              onSelect({ wallId: w.id, side: s, shelfId: r.ids[ids.indexOf(H.id)], shelfOnly: sel.shelfOnly })
            }}
          >
            <Copy size={15} />
            Kopier
          </QBtn>
          {row > 1 && (
            <QBtn
              title={sel.shelfOnly ? 'Velg hele raden' : 'Velg bare denne hyllen'}
              label={sel.shelfOnly ? 'Hele raden' : 'Bare denne'}
              onClick={() => onSelect({ wallId: w.id, side: s, shelfId: H.id, shelfOnly: !sel.shelfOnly })}
            >
              <Layers size={15} />
              {sel.shelfOnly ? 'Hele raden' : 'Bare denne'}
            </QBtn>
          )}
        </>
      ),
      more: true,
      remove: del,
    }
  }

  // The wall itself
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
    onEdit((x) => printWall(x, rules, w.id, s, m, ratioOf(m)))
  }
  return {
    name: room ? `${roomName(room)} · vegg` : stand ? `${label} · standvegg` : 'Innervegg',
    meta: `${fmt(L, L % 1 ? 1 : 0)} m`,
    body: graphics ? (
      <>
        <Motifs motifs={motifs} value={undefined} onPick={(m) => m && print(m)} />
        <Sep />
        <QBtn title="Tilbake til farger" label="Farger" onClick={() => setGraphics(false)}>
          Farger
        </QBtn>
      </>
    ) : (
      <>
        {sw}
        <Colours value={ral} title={(n) => `Hele veggen ${n}`} onPick={(r) => onEdit((x) => clearPrint(paintDoors(setWallPlate(x, w.id, r), w.id, r), w.id, s))} />
        <Sep />
        {/* With textile walls on the wall the switch picks them; the button adds one on a face without */}
        {!tex.length && (
          <QBtn title="Legg til tekstilvegg på ledig flate" onClick={textile}>
            <i className="tex-thumb q-tex" />
            Tekstilvegg
          </QBtn>
        )}
        <QBtn title="Grafikk: print over hele siden" onClick={() => setGraphics(true)}>
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

const variantName = (a: string) => idx.byArtnr.get(a)?.variant.name.toLowerCase() ?? a

function Colours({ value, title, onPick }: { value: string; title: (name: string) => string; onPick: (ral: string) => void }) {
  return (
    <>
      {wallPlates()
        .slice(0, COLOURS)
        .map((x) => (
          <Sw key={x.ral} color={x.color} title={`${title(x.name.toLowerCase())} · RAL ${x.ral}`} on={value === x.ral} onClick={() => value !== x.ral && onPick(x.ral!)} />
        ))}
    </>
  )
}

/** The newest motifs of the library, and the chosen one. `value` null = none chosen; undefined = nothing to show as chosen. */
function Motifs({ motifs, value, onPick }: { motifs: Motif[]; value: string | null | undefined; onPick: (m: string | null) => void }) {
  return (
    <>
      {motifs
        .filter((m, i) => i >= motifs.length - MOTIFS || m.id === value)
        .map((m) => (
          <button key={m.id} type="button" className="q-motif" aria-pressed={m.id === value} title={`Motiv: ${m.name}`} onClick={() => m.id !== value && onPick(m.id)}>
            <img src={m.src} alt={m.name} draggable={false} />
          </button>
        ))}
    </>
  )
}
