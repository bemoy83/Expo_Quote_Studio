// Drawer for a counter of Disker og podier (trinn 2, mockup «Standskisse v10»): one side at a time, seen from outside.
// Laid out like the wall drawer: settings on the left with two pages, «Sider og hyller» (what each part or light opening
// of the side is, K16, K17; the shelves and height of the sections behind, K18, K19) and «Farge og profilering»
// (PodiumDecor.tsx: the counter's colour, K6, print and decals, K20), in the order the counter is built, in three groups parted
// by a line (the side · the sections behind · the whole counter), and nothing in it that changes length, so the column stands still; the side's drawing on the right, every side in the counter's
// scale, with the map that picks a side in its top left corner (detail only); the hint across the bottom. Without a part chosen the settings act on the
// whole side; a click in the drawing chooses the light opening under it (the part when it has no shelves), a click on
// it again the whole side.
import { LibraryBig, Palette } from 'lucide-react'
import { useState } from 'react'
import { counterRal, removeObject } from '../../../domain/objects'
import { podiumDecals, takesDecor, updatePodiumDecal } from '../../../domain/podiumDecor'
import { NO_DOOR, setPodiumLight, takesDoor } from '../../../domain/podiumFaces'
import { heightName, HEIGHTS, outerHeight, podiumSize, setSectionHeight } from '../../../domain/podiums'
import { SHELF_HEIGHTS, lowered, movePodiumShelf, setPodiumShelf } from '../../../domain/podiumShelves'
import type { CounterLight, Motif, PlacedObject, Variant } from '../../../domain/types'
import { Button, FlatChoice, FlatToggles, Section } from '../../controls'
import { counterName, footPlatesOf, place, plateColor } from '../../env'
import { overPlate, setCounterInserts } from '../../../domain/counters'
import { count, mm } from '../../format'
import { findMotif } from '../../motifs'
import { DrawerHead, PrevNext, PRINT } from '../drawerParts'
import { hintLine } from '../drawerText'
import type { PlanSelection } from '../selection'
import { PodiumDecor } from './PodiumDecor'
import { usePaintTools } from '../paintTools'
import { counterPaintAt } from './paint'
import { PodiumElevation } from './PodiumElevation'
import { PodiumMap } from './PodiumMap'
import { chosenSide, coloursShown, counterFrame, drawerSides, printShown, sideDecor, sideElevation, type ElevationPart } from './podiumView'

interface Props {
  v: Variant
  o: PlacedObject
  selection: PlanSelection
  motifs: Motif[]
  onUpload: (f: File) => void
  onSelect: (s: PlanSelection) => void
  onEdit: (fn: (v: Variant) => Variant, history?: boolean) => void
  onCheckpoint: () => void
  onToast: (text: string) => void
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
  const ks = [...new Set(ps.flatMap((p) => (light === undefined ? p.lights : [p.lights[light] ?? null]).map((k): Kind => k ?? 'plate')))]
  return ks.length === 1 ? ks[0] : null
}

export function PodiumDrawer({ v, o, selection: sel, motifs, onUpload, onSelect, onEdit, onCheckpoint, onToast, onClose }: Props) {
  const [page, setPage] = useState<Page>('sides')
  // Colouring as in the wall drawer: the tool out, what it lays on and the motif «Print» uses (paint.ts)
  const tools = usePaintTools()
  const { tool, setTool, paintSel, motifSel } = tools
  // K18: how many shelves the last lower height took away, for the hint
  const [gone, setGone] = useState(0)
  const sides = drawerSides(o)
  if (!sides.length) return null
  const si = chosenSide(sides, sel.podiumSide)
  const S = sides[si]
  const el = sideElevation(o, S.side)
  const pi = sel.podiumPart !== undefined && sel.podiumPart < el.parts.length ? sel.podiumPart : undefined
  const parts = pi === undefined ? el.parts : [el.parts[pi]]
  const li = pi !== undefined && sel.podiumLight !== undefined && sel.podiumLight < parts[0].lights.length ? sel.podiumLight : undefined
  const kind = shared(parts, li)
  const ral = counterRal(o)
  const over = overPlate(place, o, footPlatesOf(v))
  const raised = over || !!o.inserts
  const name = counterName(o)
  const size = podiumSize(o)
  const select = (x: Partial<PlanSelection>) => onSelect({ objectId: o.id, podiumSide: S.key, ...x })
  const showSide = (i: number) => onSelect({ objectId: o.id, podiumSide: sides[(i + sides.length) % sides.length].key })
  const pickPart = (i: number | undefined, light?: number) => (setGone(0), select({ podiumPart: i, podiumLight: light }))
  // Every change but a lower height clears the hint of shelves it took away
  const edit = (fn: (v: Variant) => Variant) => (setGone(0), onEdit(fn))
  const decor = sideDecor(o, S.side, (id) => findMotif(motifs, id)?.ratio ?? 0)
  const decals = podiumDecals(o.sections ?? [])
  // K20: nothing chosen takes print or a decal (open all over)
  const decorOpen = !parts.some((p) => takesDecor(o.sections!, p.part))
  const chosenDecal = decals.find((d) => d.decal.id === sel.podiumDecal)
  // A tool is out on «Farge og profilering» with nothing chosen: the drawing paints instead of choosing
  const painting = page === 'decor' && tool !== null && pi === undefined && !chosenDecal
  const scopePrint = printShown(o, el.parts)
  const sideColours = coloursShown(el.parts, ral)
  const pen = paintSel ?? (scopePrint ? PRINT : sideColours.length === 1 ? sideColours[0] : ral)
  const pm = findMotif(motifs, motifSel ?? scopePrint ?? undefined) ?? motifs[0]
  const paintAt = counterPaintAt({ v, o, side: el.parts, tool, paint: pen, pm, onEdit, onCheckpoint, onToast })

  // K17: no sliding door on a part of 250; with the whole side chosen, on the parts that take one
  const doorable = parts.filter((p) => takesDoor(p.part))
  const options = KINDS.map((k) => (k.value === 'door' && !doorable.length ? { ...k, disabled: true, title: NO_DOOR } : k))
  const setKind = (k: Kind) => {
    const keys = (k === 'door' ? doorable : parts).map((p) => p.key)
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
  const foot = (
    <FlatToggles<'insert'> label="Hele disken på innsats" value={raised ? ['insert'] : []} onToggle={(_, on) => edit((x) => setCounterInserts(x, o.id, on))} options={[{ value: 'insert', label: 'Innsats 700', disabled: over, title: over ? 'Står over en fotplate: alltid på innsats 700, 7 mm opp' : 'Hele disken på innsats 700: 7 mm opp, like høy som en disk over fotplate' }]} />
  )
  const partNav =
    el.parts.length > 1 ? (
      <PrevNext what="del" onPrev={() => pickPart(pi === undefined ? el.parts.length - 1 : pi === 0 ? undefined : pi - 1)} onNext={() => pickPart(pi === undefined ? 0 : pi === el.parts.length - 1 ? undefined : pi + 1)} />
    ) : undefined
  const hint =
    page === 'sides'
      ? hintLine(
          gone > 0 && `Lavere høyde tok bort ${count(gone, 'hylle', 'hyller')}`,
          !doorable.length && NO_DOOR,
          pi === undefined ? 'Klikk en del eller en åpning i risset for bare den' : 'Klikk den igjen for hele siden',
          'dra toppen av en seksjon for høyden, en hylle for hyllehøyden · ‹ › bytter del · åpen: ingen plate · skyvedør: to plater i sporet · velg side i kartet eller ved å klikke disken i planen',
        )
      : painting
        ? hintLine(
            tool === 'bucket' ? 'Klikk siden for å fylle den, deler med print står som før' : 'Klikk eller dra over platene, samme farge igjen gir diskens farge',
            'velg verktøyet igjen for å legge det bort',
          )
        : hintLine(
          decorOpen && 'Åpen: ingen print eller dekal',
          pi === undefined ? 'Farge og print gjelder hele siden, plater med print står som før' : li === undefined ? 'Farge og print gjelder delen, print som ett bilde' : 'Farge og print gjelder åpningen, også skyvedøren der',
          pi === undefined && 'Velg en farge, så malerspann eller malerkost, og klikk risset',
          chosenDecal ? 'dra dekalen for å flytte, håndtakene for å skalere' : 'klikk en dekal i risset for å flytte og skalere den',
          'aldri på åpen del',
        )

  return (
    <section className="wall-drawer drawer2" aria-label={`${name} sett utenfra`}>
      <div className="wd-insp">
        <DrawerHead dot={plateColor(ral)} title={`${name} · ${S.name.replace(/^mot /, '')}`} remove={{ label: `Fjern ${/\d/.test(name) ? name : `${name.toLowerCase()}en`} (Delete)`, onClick: () => (onEdit((x) => removeObject(x, o.id)), onClose()) }} onClose={onClose}>
          {sides.length > 1 && <PrevNext what="side" onPrev={() => showSide(si - 1)} onNext={() => showSide(si + 1)} />}
        </DrawerHead>
        <p className="wd-meta num">
          {`${mm(size.length / 1000)} × ${mm(size.depth / 1000)} mm`} · {count(o.sections?.length ?? 0, 'seksjon', 'seksjoner')}
        </p>

        {page === 'sides' ? (
          <>
          <Section title={scope} aside={kind ? KIND_NAME[kind] : 'blandet'} tools={partNav}>
            <FlatChoice<Kind> label="Hva delen er" value={kind ?? ('' as Kind)} onChange={setKind} options={options} />
          </Section>
          <hr className="set-rule" />
          {/* The sections behind: K18 their height first, then K19 the shelves that must stand lower, at CC 250, 500 and
              750, named by their step as the heights (K12) */}
          <Section title={several ? `Seksjonene bak · ${secs.length} · høyde` : 'Seksjonen bak · høyde'} aside={`${heights.map((h) => mm(outerHeight(h) / 1000)).join('/')} mm`}>
            <FlatChoice<number> label="Høyde" value={heights.length === 1 ? heights[0] : 0} onChange={(h) => heightOf(secs, h)} options={HEIGHTS.map((h) => ({ value: h, label: heightName(h), title: `${outerHeight(h)} mm utvendig` }))} />
          </Section>
          <Section title="Hyller" aside={shelfCount ? count(shelfCount, 'hylle', 'hyller') : 'ingen'}>
            <FlatToggles<number> label="Hyller" value={shelvesNow} onToggle={toggleShelf} options={SHELF_HEIGHTS.map((y) => ({ value: y, label: heightName(y), disabled: y >= Math.max(...secs.map((i) => o.sections![i].h)), title: y >= lowest ? 'Hyllen må stå lavere enn seksjonen' : `Hylle ${heightName(y)} · ${outerHeight(y)} mm over gulvet, topp skinne` }))} />
          </Section>
          <hr className="set-rule" />
          {/* K23: the whole counter on inserts 700; always on over a foot plate, and the title says why */}
          <Section title="Hele disken" aside={over ? 'over fotplate' : raised ? 'på innsats' : 'på gulvet'}>
            {foot}
          </Section>
          </>
        ) : (
          <PodiumDecor
            v={v}
            o={o}
            parts={parts}
            part={pi}
            light={li}
            scope={scope}
            partNav={partNav}
            decal={chosenDecal}
            motifs={motifs}
            tools={tools}
            pen={pen}
            onUpload={onUpload}
            select={select}
            onEdit={onEdit}
          />
        )}

        <div className="wd-foot">
          <div className="wd-actions">
            <Button variant="ghost" icon={page === 'sides' ? Palette : LibraryBig} onClick={() => (setTool(null), setPage(page === 'sides' ? 'decor' : 'sides'))}>
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
        fit={counterFrame(o)}
        map={sides.length > 1 ? <PodiumMap o={o} sides={sides} chosen={si} onPick={showSide} /> : undefined}
        fill={plateColor(ral)}
        chosen={pi === undefined ? undefined : { part: pi, light: li }}
        onPick={(p) => pickPart(p?.part, p?.light)}
        paint={painting && tool ? { tool, at: paintAt } : undefined}
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
