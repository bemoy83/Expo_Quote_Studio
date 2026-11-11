// «Hyller og heng» in the wall drawer: what is fitted in the posts' face channels (wall fittings, domain/fittings.ts).
// For a felt (FeltFittings) and for the whole face (WallFittings) one section per kind of fitting, and the panel of a
// chosen shelf (ShelfPanel). Shelves are the first kind; heng get a section of their own beside them here, with their
// domain beside domain/shelves/ (Bjørn 9.11.2026: fastened exactly as shelves, other Foga profile and shape).
import { AlignVerticalSpaceAround, ArrowLeft, ArrowRight, Copy, Layers, Paintbrush, Plus } from 'lucide-react'
import type { FaceSide } from '../../../domain/faces'
import { wallLength } from '../../../domain/grid'
import { addShelfToFelt } from '../../../domain/shelves/edit'
import { addShelfRowToFace, addShelfToFace } from '../../../domain/shelves/fill'
import { gapNote, highWarning, offRow, shelfBlocked, shelvesIn, shelvesOn, tooHigh } from '../../../domain/shelves/model'
import type { Shelf as Board, Variant, Wall } from '../../../domain/types'
import type { BuiltModule } from '../../../domain/walls'
import { Button, Dim, FlatChoice, IconButton, Section } from '../../controls'
import { rules } from '../../env'
import { mm } from '../../format'
import { type PlanSelection } from '../selection'
import { shelfActions } from '../shelfActions'
import { FeltArrows } from './panels'

type Edit = (fn: (v: Variant) => Variant, history?: boolean) => void

/** Adding fittings chooses nothing: they go on without a break and are tapped to change (Bjørn 9.11.2026). */
const added = (onEdit: Edit, onToast: (t: string) => void) => (r: { v: Variant } | { error: string }) => {
  if ('error' in r) return onToast(r.error)
  onEdit(() => r.v)
}

const BRUSH_LABEL = 'Hyllepensel: klikk i veggen der hyllen skal stå, dra for en rad'

/** A felt's «Hyller og heng»: one section per kind of fitting. */
export function FeltFittings({ v, w, s, m, mods, onBrush, select, onEdit, onToast }: { v: Variant; w: Wall; s: FaceSide; m: number; mods: (BuiltModule | undefined)[]; /** Take the shelf brush (the felt is let go). */ onBrush: () => void; select: (x: Partial<PlanSelection>) => void; onEdit: Edit; onToast: (t: string) => void }) {
  const n = shelvesIn(v, w.id, m, s).length
  const why = shelfBlocked(v, w.id, m, s)
  return (
    <Section title={`Felt ${m + 1} · hyller`} aside={n ? `${n} i feltet` : 'ingen'} tools={
        <>
          <IconButton icon={Paintbrush} label={BRUSH_LABEL} size={15} className="ink" onClick={onBrush} />
          <FeltArrows m={m} s={s} mods={mods} select={select} />
        </>
      }
    >
      {why && <p className="set-note">{why}</p>}
      <div className="wd-actions">
        <Button variant="ghost" icon={Plus} onClick={() => added(onEdit, onToast)(addShelfToFelt(v, rules, w.id, m, s))} disabled={!!why}>
          Hylle til i feltet
        </Button>
      </div>
    </Section>
  )
}

/**
 * The whole face's «Hyller og heng»: one section per kind of fitting. «+ Hylle» and «+ Hyllerad» place themselves
 * (addShelfToFace, addShelfRowToFace), so pressing on fills the wall.
 */
export function WallFittings({ v, w, s, brush, onBrush, onEdit, onToast }: { v: Variant; w: Wall; s: FaceSide; /** The shelf brush is out. */ brush: boolean; onBrush: (on: boolean) => void; onEdit: Edit; onToast: (t: string) => void }) {
  const on = shelvesOn(v, w.id, s)
  const felts = new Set(on.map((x) => x.module)).size
  const add = added(onEdit, onToast)
  return (
    <Section
      title="Hele veggen · hyller"
      aside={on.length ? `${on.length} i ${felts} felt` : 'ingen'}
      tools={<IconButton icon={Paintbrush} label={BRUSH_LABEL} size={15} className="ink" pressed={brush} onClick={() => onBrush(!brush)} />}
    >
      <div className="wd-actions">
        <Button variant="ghost" icon={Plus} onClick={() => add(addShelfToFace(v, rules, w.id, s))}>
          Hylle
        </Button>
        <Button variant="ghost" icon={Plus} onClick={() => add(addShelfRowToFace(v, rules, w.id, s))}>
          Hyllerad
        </Button>
      </div>
    </Section>
  )
}

/**
 * A chosen shelf, or its row (Bjørn 9.11.2026): height from the floor (top of the board) with the quick picks, the felt
 * it stands in, and the shelves stacked there with the clear height between them (Byggeregler H2, H4, H5). «Hylle til»
 * adds one more (a row gets a row), «Fordel jevnt» spreads a felt's shelves.
 */
export function ShelfPanel({ v, H, w, s, sel, select, onEdit, onToast }: { v: Variant; H: Board; w: Wall; s: FaceSide; sel: PlanSelection; select: (x: Partial<PlanSelection>) => void; onEdit: Edit; onToast: (t: string) => void }) {
  const a = shelfActions(v, sel, H, onEdit, onToast, (shelfId, shelfOnly) => select({ shelfId, shelfOnly }))
  const { n, row, what, dir, move } = a
  const stack = shelvesIn(v, H.wallId, H.module, s)
  const sh = rules.shelf
  const L = Math.round(wallLength(w))
  return (
    <>
      <Section title={n > 1 ? `Hyllerad · ${n} hyller` : 'Hylle'} aside={`${mm(H.y)} mm fra gulv`}>
        <div className="wd-dims">
          <Dim big unit="mm" label="Fra gulv" value={H.y} step={sh.step} min={sh.min} max={sh.max} onChange={(y) => move({ y }, `For nær en annen hylle · ${gapNote(rules)}`)} />
        </div>
        <FlatChoice<number>
          label="Faste høyder"
          value={H.y}
          onChange={(y) => move({ y }, `${what} kan ikke stå på ${mm(y)} her`)}
          options={sh.heights.map((h) => ({ value: h, label: <span className="num">{mm(h)}</span> }))}
        />
        <p className="set-note">
          Overkant · {mm(sh.min)}–{mm(sh.max)} mm · steg {mm(sh.step)} mm
          {tooHigh(rules, H.y) && <> · {highWarning(rules)}</>}
          {n === 1 && offRow(v, H.id) && <> · avviker fra raden</>}
        </p>
        {row > 1 && (
          <div className="wd-actions">
            <Button variant="ghost" icon={Layers} onClick={() => select({ shelfId: H.id, shelfOnly: !sel.shelfOnly })}>
              {sel.shelfOnly ? `Hele raden (${row})` : 'Bare denne hyllen'}
            </Button>
          </div>
        )}
      </Section>
      <Section
        title="Felt"
        aside={`${H.module + 1} av ${L}`}
        tools={
          <>
            <IconButton icon={ArrowLeft} label={`Flytt ${what.toLowerCase()} ett felt til venstre`} size={15} onClick={() => move({ dm: -dir }, 'Feltet til venstre kan ikke ta hylle')} />
            <IconButton icon={ArrowRight} label={`Flytt ${what.toLowerCase()} ett felt til høyre`} size={15} onClick={() => move({ dm: dir }, 'Feltet til høyre kan ikke ta hylle')} />
          </>
        }
      >
        <div className="wd-actions">
          <Button
            variant="ghost"
            icon={Plus}
            onClick={a.more}
          >
            {n > 1 ? 'Rad til' : 'Hylle til i feltet'}
          </Button>
          <Button
            variant="ghost"
            icon={Copy}
            onClick={a.copy}
          >
            Kopier
          </Button>
          {stack.length > 1 && (
            <Button
              variant="ghost"
              icon={Copy}
              onClick={a.copyFelt}
            >
              Kopier feltet
            </Button>
          )}
          {stack.length > 2 && (
            <Button
              variant="ghost"
              icon={AlignVerticalSpaceAround}
              onClick={a.spread}
            >
              Fordel jevnt
            </Button>
          )}
        </div>
      </Section>
    </>
  )
}
