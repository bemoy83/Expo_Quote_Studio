import { Blinds, Box, Check, Ungroup, ChevronRight, DoorClosed, Eraser, Minus, PaintBucket, Paintbrush, Plus, Search, Trash2, Upload } from 'lucide-react'
import { Fragment, useMemo, useRef, useState } from 'react'
import type { CalcResult } from '../../calc/calc'
import { mainGroupOf, PRODUCT_GROUPS, resolveGroup } from '../../catalog/groups'
import type { Product } from '../../catalog/types'
import { setCounted, setStand } from '../../domain/edit'
import { addObjectAnywhere, removeObjects } from '../../domain/objects'
import { addDefaultRoom, dissolveRoom, isRoomWallId, removeRoom, ROOM_LABELS, roomName, roomOpenings, roomSize, updateRoom } from '../../domain/rooms'
import { bounds } from '../../domain/outline'
import type { StandType, Variant } from '../../domain/types'
import { fillFloor } from '../../domain/variant'
import { textileBox } from '../../domain/decor'
import { wallLabel } from '../../calc/production'
import type { Motif } from '../../persistence/file'
import type { PlanSelection } from '../plan/PlanView'
import { findMotif, readMotif, SAMPLE_MOTIFS } from '../motifs'
import { decorSource } from '../dnd'
import { INK, LAYER_COLOR, SUNKEN } from '../colors'
import { Button, CommitInput, Counter, IconButton, Segmented, Switch } from '../controls'
import { catalog, place, productOf, rules, wallPlates } from '../env'
import { count, fmt, kr, mm } from '../format'
import { beamSummary } from '../names'
import type { Brush, Tool } from '../tools'
import { MENUS } from './menus'
import { ObjectThumb, ProductRow, Swatch, VariantChips } from './ProductRow'

export interface RailProps {
  v: Variant
  res: CalcResult
  tab: string
  setTab: (k: string) => void
  tool: Tool
  brush: Brush | null
  /** Choose what the brush draws, and switch to the brush (or eraser). */
  pick: (b: Brush, tool?: Tool) => void
  onEdit: (fn: (v: Variant) => Variant) => void
  onToast: (t: string) => void
  /** Motif library: samples and the customer's own. */
  motifs: Motif[]
  onAddMotif: (m: Motif) => void
  /** Open a textile in the wall drawer. */
  onSelect: (s: PlanSelection) => void
  selection?: PlanSelection
}


const TYPE_TEXT: Record<StandType, string> = {
  row: 'Bare fronten er åpen. Lukkede sider får standvegg.',
  corner: 'Front og én side åpen. Lukkede sider får standvegg.',
  end: 'Tre sider åpne, standvegg bak.',
  island: 'Alle sider åpne. Ingen standvegg.',
}

export function Rail(p: RailProps) {
  const { v, res, tab, setTab } = p
  const [q, setQ] = useState('')
  const menu = MENUS.find((m) => m.key === tab) ?? MENUS[0]
  const counts = useMemo(() => menuCounts(v), [v])
  const done: Record<string, boolean> = {
    stand: true,
    vegg: res.keyFigures.modules > 0 || v.stand.type === 'island',
    gulv: res.keyFigures.floorTotal > 0,
  }
  const step = MENUS.filter((m) => m.group === 'build').findIndex((m) => m.key === tab)
  const next = MENUS[MENUS.findIndex((m) => m.key === tab) + 1]

  return (
    <aside className="rail">
      <nav className="strip" aria-label="Produktgrupper">
        {(['build', 'equip'] as const).map((g) => (
          <Fragment key={g}>
            <span className="grp">{g === 'build' ? 'Bygg' : 'Utstyr'}</span>
            {MENUS.filter((m) => m.group === g).map((m) => (
              <button key={m.key} type="button" className="strip-btn" aria-current={m.key === tab} onClick={() => setTab(m.key)}>
                {done[m.key] && <Check size={11} className="check" />}
                {counts[m.key] ? <span className="count">{counts[m.key]}</span> : null}
                <m.icon size={18} />
                {m.short ?? m.name}
              </button>
            ))}
          </Fragment>
        ))}
      </nav>
      <div className="panel">
        <div className="panel-scroll">
          <label className="search">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk vare eller varenr" aria-label="Søk vare eller varenr" />
          </label>
          {q.trim() ? (
            <SearchResults {...p} q={q.trim()} />
          ) : (
            <>
              <div className="panel-head">
                <h2>{menu.name}</h2>
                {step >= 0 && (
                  <span className="step">
                    Steg {step + 1} av 3{done[menu.key] ? ' · fullført' : ''}
                  </span>
                )}
              </div>
              {tab === 'stand' && <StandSection {...p} />}
              {tab === 'vegg' && <WallSection {...p} />}
              {tab === 'gulv' && <FloorSection {...p} />}
              {tab === 'prof' && <ProfileSection {...p} />}
              {menu.group === 'equip' && <EquipSection {...p} menu={menu.key} />}
            </>
          )}
        </div>
        {next && (
          <div className="panel-foot">
            <span className="spacer">Neste: {next.short ?? next.name}</span>
            <button type="button" className="btn ghost" onClick={() => setTab(next.key)}>
              <ChevronRight size={16} />
              Neste
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

function menuCounts(v: Variant): Record<string, number> {
  const out: Record<string, number> = {}
  const add = (artnr: string, n: number) => {
    const p = productOf(artnr)
    if (p) out[mainGroupOf(p.group)] = (out[mainGroupOf(p.group)] ?? 0) + n
  }
  v.objects.forEach((o) => add(o.product, 1))
  v.counted.forEach((c) => add(c.product, c.qty))
  delete out.vegg
  delete out.gulv
  return out
}

/** Stand side, whole metres. */
const SIDE_MIN = 1
const SIDE_MAX = 40

/** Stand side in whole metres: − and + step a metre, the number can be typed in. */
function NumField({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  /** False, and nothing changes, unless `n` is a new side length in range. */
  const set = (n: number) => {
    if (!Number.isFinite(n) || n < SIDE_MIN || n > SIDE_MAX || n === value) return false
    onChange(n)
  }
  return (
    <span className="num-stepper">
      <IconButton icon={Minus} label={`${label}: 1 m mindre`} size={14} disabled={value <= SIDE_MIN} onClick={() => set(value - 1)} />
      <CommitInput
        className="field num"
        aria-label={label}
        inputMode="numeric"
        value={String(value)}
        selectOnFocus
        onCommit={(text) => set(Math.round(Number(text.replace(',', '.'))))}
      />
      <IconButton icon={Plus} label={`${label}: 1 m mer`} size={14} disabled={value >= SIDE_MAX} onClick={() => set(value + 1)} />
    </span>
  )
}

function StandSection({ v, res, onEdit }: RailProps) {
  const s = v.stand
  const k = res.keyFigures
  return (
    <>
      <div className="opt">
        <span className="lbl">Bredde</span>
        <NumField label="Bredde i meter" value={s.width} onChange={(n) => onEdit((x) => setStand(x, { ...x.stand, width: n }))} />
        <span className="num unit">m</span>
      </div>
      <div className="opt">
        <span className="lbl">Dybde</span>
        <NumField label="Dybde i meter" value={s.depth} onChange={(n) => onEdit((x) => setStand(x, { ...x.stand, depth: n }))} />
        <span className="num unit">m</span>
      </div>
      <div className="panel-sec eyebrow">Standtype</div>
      <Segmented<StandType>
        inWell
        label="Standtype"
        value={s.type}
        onChange={(type) => onEdit((x) => setStand(x, { ...x.stand, type }))}
        options={[
          { value: 'row', label: 'Rekke' },
          { value: 'corner', label: 'Hjørne' },
          { value: 'end', label: 'Ende' },
          { value: 'island', label: 'Øy' },
        ]}
      />
      {s.type === 'corner' && (
        <div className="opt flush">
          <span className="lbl">Åpen mot</span>
          <Segmented<'left' | 'right'>
            inWell
            label="Åpen side"
            value={s.cornerSide ?? 'right'}
            onChange={(cornerSide) => onEdit((x) => setStand(x, { ...x.stand, cornerSide }))}
            options={[
              { value: 'left', label: 'Venstre' },
              { value: 'right', label: 'Høyre' },
            ]}
          />
        </div>
      )}
      <p className="panel-note">{TYPE_TEXT[s.type]}</p>
      <div className="opt">
        <span className="lbl">
          Takdrager
          <small className="num">{v.noBeams ? 'Ingen · mer åpen stand' : `${fmt(k.beamLm)} m · ${beamSummary(k)}`}</small>
        </span>
        <Switch label="Takdrager" on={!v.noBeams} onChange={(on) => onEdit((x) => ({ ...x, noBeams: on ? undefined : true }))} />
      </div>
      {!v.noBeams && (
        <p className="panel-note">
          {mm(rules.beam.height)} × {mm(rules.beam.thickness)} mm langs åpne sider, i flukt med veggtopp. Lange drag deles jevnt i hele meter (maks {fmt(rules.beam.max)} m) og
          skjøtes med stolpe og tverrdrager.
        </p>
      )}
    </>
  )
}

function WallSection({ v, res, brush, tool, pick, onEdit, onToast, onSelect, selection }: RailProps) {
  const plates = wallPlates()
  const di = Math.max(0, plates.findIndex((p) => p.ral === v.defaultPlate))
  const def = plates[di]
  const wallPen = tool !== 'select' && brush?.kind === 'wall'
  const beamPen = tool !== 'select' && brush?.kind === 'beam'
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
            <path d="M-.8 0 H.8" stroke={INK} strokeWidth=".14" strokeDasharray=".3 .15" />
            <rect x="-.9" y="-.12" width=".24" height=".24" fill={INK} />
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
            onClick={() => {
              const door = catalog.products.find((p) => p.opening === 'door')!.variants[0].artnr
              const next = addDefaultRoom(v, door)
              if (next) onEdit(() => next)
              else onToast('Ingen ledige hjørner til bakrom')
            }}
          />
        }
      />
      {v.rooms.map((r) => {
        const doors = roomOpenings(v, r).length
        const label = roomName(r)
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
            meta={`${doors ? `${doors} ${doors === 1 ? 'åpning' : 'åpninger'}` : 'ingen åpning'} · plassert ${bounds(r.outline).x} · ${bounds(r.outline).y} m`}
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
          const pen = tool !== 'select' && brush?.kind === 'opening' && brush.product === a
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

function FloorSection({ v, res, brush, tool, pick, onEdit }: RailProps) {
  const [sel, setSel] = useState<Record<string, number>>({})
  const areas = res.keyFigures.floor
  const floors = catalog.products.filter((p) => mainGroupOf(p.group) === 'gulv' && p.kind === 'surface')
  const eraser = tool === 'erase' && brush?.kind === 'floor'
  const protection = productOf(catalog.system.floorProtection)
  return (
    <>
      {floors.map((p) => {
        const active = tool === 'brush' && brush?.kind === 'floor' && p.variants.some((x) => x.artnr === brush.product)
        const counts = p.variants.map((x) => areas[x.artnr] ?? 0)
        const tot = counts.reduce((a, b) => a + b, 0)
        const vi = active ? p.variants.findIndex((x) => brush?.kind === 'floor' && x.artnr === brush.product) : (sel[p.id] ?? Math.max(0, counts.findIndex((n) => n > 0)))
        const cur = p.variants[vi] ?? p.variants[0]
        const sum = p.variants.reduce((a, x, i) => a + counts[i] * x.price, 0)
        return (
          <ProductRow
            key={p.id}
            on={tot > 0 || active}
            pen={active}
            thumb={<Swatch color={cur.color} pattern={p.id === 'flis' ? 'tiles' : p.name.startsWith('Vinyl') ? 'planks' : undefined} />}
            title={p.name}
            meta={
              <>
                {p.variants.length > 1 && <>{cur.name} · </>}
                {p.dim && <>{p.dim} · </>}
                <span className="num">
                  {cur.artnr} · {kr(cur.price)} kr/m²
                </span>
              </>
            }
            result={tot ? `${fmt(tot)} m² · ${kr(sum)} kr` : null}
            chips={
              <VariantChips
                chips={p.variants.map((x, i) => ({ name: x.name, color: x.color, count: counts[i] }))}
                selected={tot > 0 || active ? vi : -1}
                onSelect={(i) => {
                  setSel({ ...sel, [p.id]: i })
                  pick({ kind: 'floor', product: p.variants[i].artnr })
                }}
              />
            }
            action={
              <>
                <IconButton icon={PaintBucket} label={`Fyll hele standen med ${cur.name.toLowerCase()}`} onClick={() => onEdit((x) => fillFloor(x, cur.artnr, p.roll))} />
                <IconButton icon={Paintbrush} label={`Tegn ${p.name.toLowerCase()} i plan`} pressed={active} onClick={() => pick({ kind: 'floor', product: cur.artnr })} />
              </>
            }
          />
        )
      })}
      <ProductRow
        pen={eraser}
        thumb={<Swatch />}
        title="Uten belegg"
        meta={`Hallgulv · ${fmt(res.keyFigures.area - res.keyFigures.floorTotal)} m² uten belegg`}
        action={
          <>
            <IconButton icon={Trash2} label="Fjern alt gulv" onClick={() => onEdit((x) => ({ ...x, floor: { ...x.floor, tiles: [] } }))} />
            <IconButton
              icon={Eraser}
              label="Visk ut gulv i plan"
              pressed={eraser}
              onClick={() => pick({ kind: 'floor', product: brush?.kind === 'floor' ? brush.product : floors[0].variants[0].artnr }, 'erase')}
            />
          </>
        }
      />
      {res.keyFigures.floorTotal > 0 && protection && (
        <div className="opt">
          <span className="lbl">
            Monteringsplast
            <small>
              <span className="num">{protection.variants[0].artnr}</span> · 0,1 mm · {fmt(res.keyFigures.floorTotal)} m² · ved snekring eller maling
            </small>
          </span>
          <Segmented<boolean>
            inWell
            label="Monteringsplast"
            value={v.floor.protection}
            onChange={(on) => onEdit((x) => ({ ...x, floor: { ...x.floor, protection: on } }))}
            options={[
              { value: false, label: 'Av' },
              { value: true, label: 'På' },
            ]}
          />
        </div>
      )}
      <p className="panel-note">Fyll legger hele standen med 1 × 1. Penselen legger fliser hvor som helst i 0,5-rutenettet: 1 × 1 som standard, Auto tar største flis som passer på ledig gulv, og under Andre ligger 1 × 0,5, 0,5 × 1 og 0,5 × 0,5. Engangsteppe legges i baner fra 2 m rull langs lengste side, siste bane kappet på langs; R snur retningen. Teppet går under bakrom og vegger. Flere gulvtyper kan stå på samme stand.</p>
    </>
  )
}

const FILL_SHORT = { print: 'trykk', white: 'hvit', reuse: 'kundens' } as const

/** Profilering: textile walls (on a system wall or free-standing, one brush) and the motif library. Counted profiling items follow below. */
function ProfileSection({ v, res, brush, tool, pick, motifs, onAddMotif, onSelect, onToast }: RailProps) {
  const file = useRef<HTMLInputElement>(null)
  const pen = tool !== 'select' && brush?.kind === 'textile'
  const textile = productOf(catalog.system.textile)?.variants[0]
  const freeFrame = productOf(catalog.system.freeTextile)?.variants[0]
  const k = res.keyFigures
  const upload = async (f: File) => {
    try {
      const m = await readMotif(f, motifs.map((x) => x.id))
      onAddMotif(m)
      onToast(`${m.name} lagt til i grafikkbiblioteket`)
    } catch (e) {
      onToast((e as Error).message)
    }
  }
  return (
    <>
      <div className="panel-sec eyebrow">Tekstilvegg</div>
      <ProductRow
        on={v.textiles.length + v.freeTextiles.length > 0}
        pen={pen}
        thumb={<i className="tex-thumb" />}
        drag={decorSource({ kind: 'textile' })}
        title="Tekstilvegg"
        meta={
          <>
            Tegnet på en systemvegg monteres den på veggen, ellers står den fritt på fotplater med tekstil på begge sider · leie av ramme{' '}
            <span className="num">{kr(textile?.price ?? 0)} kr/m²</span> på vegg, <span className="num">{kr(freeFrame?.price ?? 0)} kr/lm</span> frittstående + tekstil per m²
          </>
        }
        result={
          [
            v.textiles.length ? `${v.textiles.length} på vegg · ${fmt(k.textileM2)} m²` : '',
            res.production.free.length ? `${res.production.free.length} frittstående · ${fmt(res.production.freeLm, 2)} lm` : '',
          ]
            .filter(Boolean)
            .join(' · ') || null
        }
        action={<IconButton icon={Paintbrush} label="Tegn tekstilvegg i plan" pressed={pen && tool === 'brush'} onClick={() => pick({ kind: 'textile' })} />}
      />
      {v.textiles.map((t) => {
        const w = v.walls.find((x) => x.id === t.wallId)
        if (!w) return null
        const m = findMotif(motifs, t.motif)?.name
        return (
          <button key={t.id} type="button" className="trow" onClick={() => onSelect({ wallId: w.id, side: t.side, textileId: t.id })}>
            <span className="name">
              {wallLabel(w)}
              {t.fill === 'reuse' ? <span className="faint"> · kundens duk</span> : t.fill === 'white' ? <span className="faint"> · hvit</span> : m ? <span className="faint"> · {m}</span> : <span className="warn"> · uten motiv</span>}
            </span>
            <span className="num">
              {fmt(t.width)} × {fmt(textileBox(t, rules).height, 2)} m
            </span>
          </button>
        )
      })}
      {res.production.free.map((f) => (
        <button key={f.textileId} type="button" className="trow" onClick={() => onSelect({ freeTextileId: f.textileId, freeFace: 'a' })}>
          <span className="name">
            {f.pos} frittstående
            <span className="faint"> · {f.faces.map((x) => `${x.face.toUpperCase()} ${FILL_SHORT[x.fill]}`).join(', ')}</span>
          </span>
          <span className="num">{fmt(f.length / 1000, 2)} m</span>
        </button>
      ))}

      <div className="panel-sec eyebrow gfx-head">
        <span>Grafikk · {motifs.length}</span>
        <Button icon={Upload} onClick={() => file.current?.click()}>
          Last opp
        </Button>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void upload(f)
          e.target.value = ''
        }}
      />
      <div className="gfx-grid">
        {motifs.map((m) => {
          const on = tool !== 'select' && brush?.kind === 'motif' && brush.motif === m.id
          return (
            <button
              key={m.id}
              type="button"
              className={on ? 'gfx on' : 'gfx'}
              aria-pressed={on}
              onClick={() => pick({ kind: 'motif', motif: m.id })}
              {...decorSource({ kind: 'motif', motif: m.id })}
            >
              <span className="art">
                <img src={m.src} alt="" draggable={false} />
              </span>
              <span className="lbl">
                {m.name}
                {!SAMPLE_MOTIFS.includes(m) && <span className="faint"> · eget</span>}
              </span>
            </button>
          )
        })}
      </div>
      <p className="panel-note">
        Velg et motiv og klikk på en tekstilvegg for trykk, eller på et veggfelt for foliedekor. Du kan også dra motivet rett til veggen i plan eller 3D. Folie går aldri over en stolpe. Velg veggen for å justere størrelse og plassering.
      </p>
      {v.foils.length > 0 && (
        <p className="panel-note num">
          {count(v.foils.length, 'foliedekor', 'foliedekorer')} · {fmt(k.foilM2)} m²
        </p>
      )}
    </>
  )
}

function EquipSection(p: RailProps & { menu: string }) {
  const products = catalog.products.filter((x) => mainGroupOf(x.group) === p.menu && (x.kind === 'object' || x.kind === 'counted'))
  const subgroups = PRODUCT_GROUPS.find((g) => g.id === p.menu)?.subgroups ?? []
  const many = subgroups.length > 1
  return (
    <>
      {subgroups.map((sg) => {
        const list = products.filter((x) => resolveGroup(x.group).subgroup.id === sg.id)
        if (!list.length) return null
        return (
          <div key={sg.id}>
            {many && <div className="panel-sec eyebrow">{sg.name}</div>}
            {list.map((x) => (
              <CatalogRow key={x.id} {...p} product={x} />
            ))}
          </div>
        )
      })}
    </>
  )
}

function SearchResults(p: RailProps & { q: string }) {
  const q = p.q.toLowerCase()
  const hits = catalog.products.filter(
    (x) => (x.kind === 'object' || x.kind === 'counted') && !x.opening && (x.name.toLowerCase().includes(q) || x.variants.some((v) => v.artnr.toLowerCase().includes(q) || v.name.toLowerCase().includes(q))),
  )
  if (!hits.length) return <p className="panel-note">Ingen varer passer «{p.q}».</p>
  return (
    <>
      <div className="panel-head">
        <h2>Søk</h2>
        <span className="step">{hits.length} treff</span>
      </div>
      {hits.map((x) => (
        <CatalogRow key={x.id} {...p} product={x} showGroup />
      ))}
    </>
  )
}

/** A placed object (counter + brush) or a counted item (counter per variant). */
function CatalogRow({ v, product, brush, tool, pick, onEdit, onToast, showGroup }: RailProps & { product: Product; showGroup?: boolean }) {
  const [vi, setVi] = useState<number | null>(null)
  const isObject = product.kind === 'object'
  const counts = product.variants.map((x) =>
    isObject ? v.objects.filter((o) => o.product === x.artnr).length : (v.counted.find((c) => c.product === x.artnr)?.qty ?? 0),
  )
  const tot = counts.reduce((a, b) => a + b, 0)
  const i = vi ?? Math.max(0, counts.findIndex((n) => n > 0))
  const cur = product.variants[i]
  const sum = product.variants.reduce((a, x, k) => a + counts[k] * x.price, 0)
  const pen = isObject && tool !== 'select' && brush?.kind === 'object' && brush.product === cur.artnr
  const setCount = (n: number) => {
    if (!isObject) return onEdit((x) => setCounted(x, cur.artnr, n))
    const have = counts[i]
    if (n < have) return onEdit((x) => removeObjects(x, cur.artnr, have - n))
    let next: Variant | null = v
    for (let k = have; k < n && next; k++) next = addObjectAnywhere(next, place, cur.artnr)
    if (next) onEdit(() => next!)
    else onToast(`Ikke plass til ${product.name.toLowerCase()} på standen`)
  }
  const groupName = showGroup ? resolveGroup(product.group).subgroup.name : null
  return (
    <ProductRow
      on={tot > 0}
      pen={pen}
      thumb={<ObjectThumb product={product} color={cur.color} />}
      title={product.name}
      meta={
        <>
          {product.variants.length > 1 && <>{cur.name} · </>}
          {groupName && <>{groupName} · </>}
          <span className="num">
            {cur.artnr} · {kr(cur.price)} kr
          </span>
          {product.dim && <> · {product.dim}</>}
          {isObject ? ' · tegnes' : product.unit === 't' ? ' · timer' : ' · plasseres senere'}
        </>
      }
      result={tot ? `${product.variants.length > 1 ? `${tot} totalt · ` : ''}${kr(sum)} kr` : null}
      chips={<VariantChips chips={product.variants.map((x, k) => ({ name: x.name, color: x.color, count: counts[k] }))} selected={tot > 0 || vi !== null ? i : -1} onSelect={setVi} />}
      action={
        <>
          <Counter value={counts[i]} onChange={setCount} label={`Legg til ${product.name.toLowerCase()}`} max={isObject ? 20 : 99} />
          {isObject && <IconButton icon={Paintbrush} label={`Plasser ${product.name.toLowerCase()} i plan`} pressed={pen && tool === 'brush'} onClick={() => pick({ kind: 'object', product: cur.artnr })} />}
        </>
      }
    />
  )
}
