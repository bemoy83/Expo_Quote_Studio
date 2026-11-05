// The selection pill (docs/pille-og-skuff.md): quick grips on what is selected in Velg, over the object on the plan.
// One build for all: name and size · colour or motif · rotate (where it makes sense) · Mer (the drawer) · remove.
// Shown CLICK_MS after a click that selects, so a double click goes straight to the drawer; hidden while dragging,
// while the drawer is open, with a pen in hand and in 3D (PlanView decides). Where it stands: pillAnchor.ts.
import { ArrowLeftRight, Blinds, DoorClosed, FlipHorizontal2, Image as ImageIcon, MoveHorizontal, PanelBottomOpen, RotateCw, Trash2 } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { CalcResult } from '../../calc/calc'
import { wallLabel } from '../../calc/production'
import { updateFoil } from '../../domain/decor'
import { canFlipSwing, doorFace, doorRal, flipHinge, flipSwing, openingRoom, setDoorRal, setOpeningProduct, paintDoors } from '../../domain/doors'
import { eraseWalls, setWallPlate } from '../../domain/edit'
import { faces, type FaceSide } from '../../domain/faces'
import { rotateLane } from '../../domain/floor/edit'
import { CELL, wallLength, wallModules } from '../../domain/grid'
import { wallRal } from '../../domain/panels'
import { clearPrint, fillPlates, printWall } from '../../domain/print'
import { roomName, roomSize } from '../../domain/rooms'
import { addTextile, fillTextile, textileBox, textilesOn, updateTextile } from '../../domain/textile/inFrame'
import type { Variant, Wall } from '../../domain/types'
import { isStandWall } from '../../domain/walls'
import type { Motif } from '../../persistence/file'
import { idx, openingProducts, productOf, rules, wallPlates } from '../env'
import { fmt, mm } from '../format'
import { findMotif } from '../motifs'
import { placePill, type PillPlace } from './pillAnchor'
import { QBtn, QName, Sep, Sw } from './QuickPicks'
import { deleteSelection, type PlanSelection } from './selection'

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
        <QBtn title="Mer i skuffen" label="Mer" onClick={() => p.onOpenDrawer(p.selection)}>
          <PanelBottomOpen size={15} />
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
    return { name: f?.product.name ?? 'Møbel', meta: fp ? `${mm(fp.w)} × ${mm(fp.d)}` : undefined, remove: del }
  }
  if (sel.freeTextileId) {
    const frame = p.res.production.free.find((x) => x.textileId === sel.freeTextileId)
    if (!frame) return null
    return { name: 'Frittstående tekstilvegg', meta: `${frame.pos} · ${fmt(frame.length, 0)} × ${fmt(frame.H, 0)}`, more: true, remove: del }
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
  if (T) {
    const filled = fillTextile(v, rules, T.id)
    const fills = filled.textiles.find((x) => x.id === T.id)?.width === T.width
    const motif = T.fill === 'print' || T.fill === undefined ? (T.motif ?? null) : undefined
    return {
      name: 'Tekstilvegg',
      meta: `${fmt(T.width, 2)} × ${fmt(textileBox(T, rules).height, 2)} m`,
      body: (
        <>
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

  // The wall itself
  const stand = isStandWall(w)
  const room = w.room && v.rooms.find((r) => r.id === w.room!.id)
  const label = wallLabel(w)
  const L = wallLength(w)
  const tex = textilesOn(v, w.id, s)
  const ral = wallRal(v, w)
  const textile = () => {
    if (tex.length) return onSelect({ wallId: w.id, side: s, textileId: tex[0].id })
    const r = addTextile(v, rules, w.id, s, L / 2)
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
        <Colours value={ral} title={(n) => `Hele veggen ${n}`} onPick={(r) => onEdit((x) => clearPrint(paintDoors(setWallPlate(x, w.id, r), w.id, r), w.id, s))} />
        <Sep />
        <QBtn title={tex.length ? 'Velg veggens tekstilvegg' : 'Legg til tekstilvegg på ledig flate'} onClick={textile}>
          <i className="tex-thumb q-tex" />
          Tekstilvegg
        </QBtn>
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
