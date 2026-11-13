// Drawer for a counter of Disker og podier (trinn 2, mockup «Standskisse v10»): one side at a time, seen from outside.
// Laid out like the wall drawer: settings on the left with two pages, «Sider og hyller» (what each part of the side is,
// K16) and «Farge og profilering» (the counter's colour, K6), the mini plan to choose a side in the detail height, the
// side's drawing on the right and the hint across the bottom. Without a part chosen the settings act on the whole side;
// a click on a part in the drawing chooses it, a click on it again the whole side.
import { ChevronLeft, ChevronRight, LibraryBig, Palette } from 'lucide-react'
import { useState } from 'react'
import { counterRal, removeObject, setCounterRal } from '../../../domain/objects'
import { NO_DOOR, setPodiumLight, takesDoor } from '../../../domain/podiumFaces'
import { partLocks } from '../../../domain/podiumLocks'
import { HEIGHTS, podiumName, podiumSize, setSectionHeight } from '../../../domain/podiums'
import type { CounterLight, PlacedObject, Variant } from '../../../domain/types'
import { Button, FlatChoice, IconButton, Section } from '../../controls'
import { place, plateColor, plateName } from '../../env'
import { count, mm } from '../../format'
import { DrawerHead, PlatePalette } from '../drawerParts'
import type { PlanSelection } from '../selection'
import { PodiumElevation } from './PodiumElevation'
import { PodiumMap } from './PodiumMap'
import { chosenSide, drawerSides, sideElevation, type ElevationPart } from './podiumView'

interface Props {
  v: Variant
  o: PlacedObject
  selection: PlanSelection
  onSelect: (s: PlanSelection) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onClose: () => void
}

type Page = 'sides' | 'decor'
type Kind = CounterLight | 'plate'

const KINDS: { value: Kind; label: string }[] = [
  { value: 'plate', label: 'Plate' },
  { value: 'open', label: 'Åpen' },
  { value: 'door', label: 'Skyvedør' },
]
const KIND_NAME: Record<Kind, string> = { plate: 'plate', open: 'åpen', door: 'skyvedør' }

/** What the parts are, as one: the kind they share, or null when they differ. */
const shared = (ps: ElevationPart[]): Kind | null => {
  const ks = [...new Set(ps.map((p) => (p.locked ? 'plate' : (p.light ?? 'plate'))))]
  return ks.length === 1 ? ks[0] : null
}

export function PodiumDrawer({ v, o, selection: sel, onSelect, onEdit, onClose }: Props) {
  const [page, setPage] = useState<Page>('sides')
  const sides = drawerSides(o)
  if (!sides.length) return null
  const si = chosenSide(sides, sel.podiumSide)
  const S = sides[si]
  const locks = partLocks(v, place, o)
  const el = sideElevation(o, S.side, new Set(locks.keys()))
  const pi = sel.podiumPart !== undefined && sel.podiumPart < el.parts.length ? sel.podiumPart : undefined
  const parts = pi === undefined ? el.parts : [el.parts[pi]]
  const kind = shared(parts)
  const ral = counterRal(o)
  const name = podiumName(o.sections ?? [])
  const size = podiumSize(o)
  const select = (x: Partial<PlanSelection>) => onSelect({ objectId: o.id, podiumSide: S.key, ...x })
  const showSide = (i: number) => onSelect({ objectId: o.id, podiumSide: sides[(i + sides.length) % sides.length].key })
  const pickPart = (i: number | undefined) => select({ podiumPart: i })

  // A part against a wall or another counter stays a plate (K16): its choice is greyed out, with why
  const lockedHere = parts.filter((p) => p.locked)
  const lockWhy = (() => {
    if (!lockedHere.length) return null
    const kinds = new Set(lockedHere.map((p) => locks.get(p.key)))
    const what = kinds.size > 1 ? 'en vegg eller en annen disk' : kinds.has('wall') ? 'en vegg' : 'en annen disk'
    if (lockedHere.length === parts.length) return pi === undefined && parts.length > 1 ? `Siden står mot ${what}` : `Delen står mot ${what}`
    return `${count(lockedHere.length, 'del', 'deler')} står mot ${what} og blir plate`
  })()
  const allLocked = lockedHere.length === parts.length
  // K17: no sliding door on a part of 250; with the whole side chosen, on the parts that take one
  const doorable = parts.filter((p) => !p.locked && takesDoor(p.part))
  const options = KINDS.map((k) => (k.value === 'door' && !doorable.length ? { ...k, disabled: true, title: NO_DOOR } : k))
  const setKind = (k: Kind) => {
    const keys = (k === 'door' ? doorable : parts.filter((p) => !p.locked)).map((p) => p.key)
    onEdit((x) => setPodiumLight(x, o.id, keys, k === 'plate' ? null : k))
  }

  const secs = [...new Set(parts.map((p) => p.part.section))]
  const heights = [...new Set(secs.map((i) => o.sections![i].h))].sort((a, b) => a - b)
  const setHeight = (h: number) => onEdit((x) => setSectionHeight(x, o.id, secs, h))
  const scope = pi === undefined ? 'Hele siden' : `Del ${pi + 1} av ${el.parts.length}`
  const partNav =
    el.parts.length > 1 ? (
      <>
        <IconButton icon={ChevronLeft} label="Forrige del" size={15} onClick={() => pickPart(pi === undefined ? el.parts.length - 1 : pi === 0 ? undefined : pi - 1)} />
        <IconButton icon={ChevronRight} label="Neste del" size={15} onClick={() => pickPart(pi === undefined ? 0 : pi === el.parts.length - 1 ? undefined : pi + 1)} />
      </>
    ) : undefined
  const hint =
    page === 'sides'
      ? `${pi === undefined ? 'Klikk en del i risset for bare den' : 'Klikk delen igjen for hele siden'} · dra toppen av en seksjon for høyden · ‹ › bytter del · åpen: ingen plate og ingen bunnskinne · skyvedør: to plater i sporet · velg side i miniplanen eller ved å klikke disken i planen`
      : 'Fargen gjelder hele disken, også dørene · «Sider og hyller» for åpne sider og dører'

  return (
    <section className="wall-drawer drawer2" aria-label={`${name} sett utenfra`}>
      <div className="wd-insp">
        <DrawerHead dot={plateColor(ral)} title={`${name} · ${S.name.replace(/^mot /, '')}`} remove={{ label: `Fjern ${name.toLowerCase()}en (Delete)`, onClick: () => (onEdit((x) => removeObject(x, o.id)), onClose()) }} onClose={onClose}>
          {sides.length > 1 && (
            <>
              <IconButton icon={ChevronLeft} label="Forrige side" size={15} onClick={() => showSide(si - 1)} />
              <IconButton icon={ChevronRight} label="Neste side" size={15} onClick={() => showSide(si + 1)} />
            </>
          )}
        </DrawerHead>
        <p className="wd-meta num">
          {`${mm(size.length / 1000)} × ${mm(size.depth / 1000)} mm`} · {count(o.sections?.length ?? 0, 'seksjon', 'seksjoner')}
        </p>

        {page === 'sides' ? (
          <>
          <Section title={scope} aside={kind ? KIND_NAME[kind] : 'blandet'} tools={partNav}>
            <FlatChoice<Kind> label="Hva delen er" value={kind ?? ('' as Kind)} onChange={setKind} options={options} disabled={allLocked} />
            {lockWhy && <p className="set-note">{lockWhy}</p>}
            {!allLocked && !doorable.length && <p className="set-note">{NO_DOOR}</p>}
          </Section>
          {/* K18: the height of the section behind the part, or of every section along the side */}
          <Section title={pi === undefined && secs.length > 1 ? 'Seksjonene · høyde' : 'Seksjonen · høyde'} aside={`CC ${heights.map((h) => mm(h / 1000)).join('/')}`}>
            <FlatChoice<number> label="Høyde CC" value={heights.length === 1 ? heights[0] : 0} onChange={setHeight} options={HEIGHTS.map((h) => ({ value: h, label: mm(h / 1000) }))} />
          </Section>
          </>
        ) : (
          <Section title="Hele disken" aside={`${plateName(ral)} ${ral}`}>
            <PlatePalette value={ral} onPick={(r) => onEdit((x) => setCounterRal(x, o.id, r))} />
            <p className="set-note">Fargen gjelder hele disken.</p>
          </Section>
        )}

        {sides.length > 1 && (
          <Section title="Velg side" aside={`${S.name} · ${si + 1} av ${sides.length}`} className="wd-sec">
            <PodiumMap o={o} sides={sides} chosen={si} onPick={showSide} />
          </Section>
        )}

        <div className="wd-foot">
          <div className="wd-actions">
            <Button variant="ghost" icon={page === 'sides' ? Palette : LibraryBig} onClick={() => setPage(page === 'sides' ? 'decor' : 'sides')}>
              {page === 'sides' ? 'Farge og profilering' : 'Sider og hyller'}
            </Button>
          </div>
        </div>
      </div>

      <PodiumElevation parts={el.parts} length={el.length} h={el.h} title={`${S.name[0].toUpperCase()}${S.name.slice(1)} · sett utenfra`} fill={plateColor(ral)} chosen={pi} onPick={pickPart} onHeight={(sec, h) => onEdit((x) => setSectionHeight(x, o.id, [sec], h))} />
      <div className="wd-hint">{hint}</div>
    </section>
  )
}
