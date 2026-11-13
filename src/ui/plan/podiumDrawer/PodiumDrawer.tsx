// Drawer for a counter of Disker og podier (trinn 2, mockup «Standskisse v10»): one side at a time, seen from outside.
// Laid out like the wall drawer: settings on the left with two pages, «Sider og hyller» (what each part or light opening
// of the side is, K16, K17; the shelves and height of the sections behind, K18, K19) and «Farge og profilering»
// (PodiumDecor.tsx: the counter's colour, K6, print and decals, K20); the mini plan or the motif library in the detail
// height, the side's drawing on the right and the hint across the bottom. Without a part chosen the settings act on the
// whole side; a click in the drawing chooses the light opening under it (the part when it has no shelves), a click on
// it again the whole side.
import { LibraryBig, Palette } from 'lucide-react'
import { useState } from 'react'
import { counterRal, removeObject } from '../../../domain/objects'
import { podiumDecals, updatePodiumDecal } from '../../../domain/podiumDecor'
import { NO_DOOR, setPodiumLight, takesDoor } from '../../../domain/podiumFaces'
import { partLocks } from '../../../domain/podiumLocks'
import { HEIGHTS, podiumName, podiumSize, setSectionHeight } from '../../../domain/podiums'
import { SHELF_HEIGHTS, lowered, movePodiumShelf, setPodiumShelf } from '../../../domain/podiumShelves'
import type { CounterLight, Motif, PlacedObject, Variant } from '../../../domain/types'
import { Button, FlatChoice, FlatToggles, Section } from '../../controls'
import { place, plateColor } from '../../env'
import { count, mm } from '../../format'
import { findMotif } from '../../motifs'
import { DrawerHead, PrevNext } from '../drawerParts'
import type { PlanSelection } from '../selection'
import { PodiumDecor } from './PodiumDecor'
import { PodiumElevation } from './PodiumElevation'
import { PodiumMap } from './PodiumMap'
import { chosenSide, drawerSides, sideDecor, sideElevation, type ElevationPart } from './podiumView'

interface Props {
  v: Variant
  o: PlacedObject
  selection: PlanSelection
  motifs: Motif[]
  onUpload: (f: File) => void
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

/** What the parts are, as one (in light opening `light`, or in all): the kind they share, or null when they differ. */
const shared = (ps: ElevationPart[], light?: number): Kind | null => {
  const ks = [...new Set(ps.flatMap((p) => (light === undefined ? p.lights : [p.lights[light] ?? null]).map((k): Kind => (p.locked ? 'plate' : (k ?? 'plate')))))]
  return ks.length === 1 ? ks[0] : null
}

export function PodiumDrawer({ v, o, selection: sel, motifs, onUpload, onSelect, onEdit, onClose }: Props) {
  const [page, setPage] = useState<Page>('sides')
  // K18: how many shelves the last lower height took away, for the hint
  const [gone, setGone] = useState(0)
  const sides = drawerSides(o)
  if (!sides.length) return null
  const si = chosenSide(sides, sel.podiumSide)
  const S = sides[si]
  const locks = partLocks(v, place, o)
  const el = sideElevation(o, S.side, new Set(locks.keys()))
  const pi = sel.podiumPart !== undefined && sel.podiumPart < el.parts.length ? sel.podiumPart : undefined
  const parts = pi === undefined ? el.parts : [el.parts[pi]]
  const li = pi !== undefined && sel.podiumLight !== undefined && sel.podiumLight < parts[0].lights.length ? sel.podiumLight : undefined
  const kind = shared(parts, li)
  const ral = counterRal(o)
  const name = podiumName(o.sections ?? [])
  const size = podiumSize(o)
  const select = (x: Partial<PlanSelection>) => onSelect({ objectId: o.id, podiumSide: S.key, ...x })
  const showSide = (i: number) => onSelect({ objectId: o.id, podiumSide: sides[(i + sides.length) % sides.length].key })
  const pickPart = (i: number | undefined, light?: number) => (setGone(0), select({ podiumPart: i, podiumLight: light }))
  // Every change but a lower height clears the hint of shelves it took away
  const edit = (fn: (v: Variant) => Variant) => (setGone(0), onEdit(fn))
  const decor = sideDecor(o, S.side, new Set(locks.keys()), (id) => findMotif(motifs, id)?.ratio ?? 0)
  const decals = podiumDecals(o.sections ?? [])
  const chosenDecal = decals.find((d) => d.decal.id === sel.podiumDecal)

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
    edit((x) => setPodiumLight(x, o.id, keys, k === 'plate' ? null : k, li))
  }

  const secs = [...new Set(parts.map((p) => p.part.section))]
  const heights = [...new Set(secs.map((i) => o.sections![i].h))].sort((a, b) => a - b)
  const heightOf = (which: number[], h: number) => {
    setGone(which.reduce((n, i) => n + lowered(o.sections![i], h).gone, 0))
    onEdit((x) => setSectionHeight(x, o.id, which, h))
  }
  // K19: a shelf is on when every section along has it; one that is not lower than a section's height is greyed out
  const shelvesNow = SHELF_HEIGHTS.filter((y) => secs.every((i) => o.sections![i].shelves?.includes(y)))
  const lowest = Math.min(...secs.map((i) => o.sections![i].h))
  const shelfCount = secs.reduce((n, i) => n + (o.sections![i].shelves?.length ?? 0), 0)
  const toggleShelf = (y: number, on: boolean) => edit((x) => setPodiumShelf(x, o.id, secs, y, on))
  const several = pi === undefined && secs.length > 1
  const scope = pi === undefined ? 'Hele siden' : li === undefined ? `Del ${pi + 1} av ${el.parts.length}` : `Del ${pi + 1} · åpning ${li + 1}/${parts[0].lights.length}`
  const partNav =
    el.parts.length > 1 ? (
      <PrevNext what="del" onPrev={() => pickPart(pi === undefined ? el.parts.length - 1 : pi === 0 ? undefined : pi - 1)} onNext={() => pickPart(pi === undefined ? 0 : pi === el.parts.length - 1 ? undefined : pi + 1)} />
    ) : undefined
  const hint =
    page === 'sides'
      ? `${gone ? `Lavere høyde tok bort ${count(gone, 'hylle', 'hyller')} · ` : ''}${pi === undefined ? 'Klikk en del eller en åpning i risset for bare den' : 'Klikk den igjen for hele siden'} · dra toppen av en seksjon for høyden, en hylle for hyllehøyden · ‹ › bytter del · åpen: ingen plate · skyvedør: to plater i sporet · velg side i miniplanen eller ved å klikke disken i planen`
      : `Fargen gjelder hele disken, også dørene · Print og motiv gjelder ${pi === undefined ? 'hele siden' : 'delen'} · ${chosenDecal ? 'dra dekalen for å flytte, håndtakene for å skalere' : 'klikk en dekal i risset for å flytte og skalere den'} · aldri på åpen del eller del mot vegg`

  return (
    <section className="wall-drawer drawer2" aria-label={`${name} sett utenfra`}>
      <div className="wd-insp">
        <DrawerHead dot={plateColor(ral)} title={`${name} · ${S.name.replace(/^mot /, '')}`} remove={{ label: `Fjern ${name.toLowerCase()}en (Delete)`, onClick: () => (onEdit((x) => removeObject(x, o.id)), onClose()) }} onClose={onClose}>
          {sides.length > 1 && <PrevNext what="side" onPrev={() => showSide(si - 1)} onNext={() => showSide(si + 1)} />}
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
          {/* K19: shelves at CC 250, 500 and 750, below the section's height */}
          <Section title={several ? 'Seksjonene · hyller' : 'Seksjonen · hyller'} aside={shelfCount ? count(shelfCount, 'hylle', 'hyller') : 'ingen'}>
            <FlatToggles<number> label="Hyller, CC" value={shelvesNow} onToggle={toggleShelf} options={SHELF_HEIGHTS.map((y) => ({ value: y, label: mm(y / 1000), disabled: y >= Math.max(...secs.map((i) => o.sections![i].h)), title: y >= lowest ? 'Hyllen må stå lavere enn seksjonen' : undefined }))} />
          </Section>
          {/* K18: the height of the section behind the part, or of every section along the side */}
          <Section title={several ? 'Seksjonene · høyde' : 'Seksjonen · høyde'} aside={`CC ${heights.map((h) => mm(h / 1000)).join('/')}`}>
            <FlatChoice<number> label="Høyde CC" value={heights.length === 1 ? heights[0] : 0} onChange={(h) => heightOf(secs, h)} options={HEIGHTS.map((h) => ({ value: h, label: mm(h / 1000) }))} />
          </Section>
          </>
        ) : (
          <PodiumDecor v={v} o={o} parts={parts} part={pi} scope={scope} partNav={partNav} decal={chosenDecal} motifs={motifs} onUpload={onUpload} select={select} onEdit={onEdit} />
        )}

        {/* The mini plan on «Sider og hyller», the motif library on «Farge og profilering»: one under the settings, as in the wall drawer */}
        {page === 'sides' && sides.length > 1 && (
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

      <PodiumElevation
        parts={el.parts}
        length={el.length}
        h={el.h}
        title={`${S.name[0].toUpperCase()}${S.name.slice(1)} · sett utenfra`}
        fill={plateColor(ral)}
        chosen={pi === undefined ? undefined : { part: pi, light: li }}
        onPick={(p) => pickPart(p?.part, p?.light)}
        onHeight={(sec, h) => heightOf([sec], h)}
        onShelf={(sec, from, to) => edit((x) => movePodiumShelf(x, o.id, sec, from, to))}
        prints={decor.prints}
        decals={decor.decals}
        motifs={motifs}
        decal={sel.podiumDecal}
        onDecal={(id) => select({ podiumPart: pi, podiumLight: li, podiumDecal: id })}
        onDecalBox={(id, b) => {
          const d = decals.find((x) => x.decal.id === id)
          if (d) onEdit((x) => updatePodiumDecal(x, o.id, id, { w: b.w, h: b.h, x: d.decal.x + b.dx, y: b.y }))
        }}
      />
      <div className="wd-hint">{hint}</div>
    </section>
  )
}
