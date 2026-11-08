// The stand itself, in the order the stand chip names it: its type, its size, who pays the stand walls and the beams
// along its open sides. Sections as in the drawers (controls.tsx Section, Bjørn 8.11.2026): a title in muted capitals
// over each choice, with what it is set to when the choice does not show it, flat choices without tracks. Shown in the
// stand chip's popover on the drawing surface.
import type { CalcResult } from '../../calc/calc'
import { setStand } from '../../domain/edit'
import type { Payer, StandType, StandWallTerms, Variant } from '../../domain/types'
import { standardBeamsOn, withStandardBeams } from '../../domain/walls'
import { ArrowLeftRight } from 'lucide-react'
import { Dim, FlatChoice, IconButton, Section } from '../controls'
import { wallPlates } from '../env'
import { fmt } from '../format'
import { beamSummary } from '../names'
import { Sw } from '../plan/QuickPicks'

/** Stand side, whole metres. */
const SIDE_MIN = 1
const SIDE_MAX = 40

const TYPE_TEXT: Record<StandType, string> = {
  row: 'Bare fronten er åpen.',
  corner: 'Front og én side åpen.',
  end: 'Tre sider åpne.',
  island: 'Alle sider åpne.',
}

/** Sides of the stand outline seen from above, front at the bottom: true = stand wall. Corner as open to the right. */
const TYPE_WALLS: Record<StandType, { back: boolean; left: boolean; right: boolean }> = {
  row: { back: true, left: true, right: true },
  corner: { back: true, left: true, right: false },
  end: { back: true, left: false, right: false },
  island: { back: false, left: false, right: false },
}

/** The stand type as a small plan: stand walls drawn solid, open sides dashed. */
function TypeIcon({ type }: { type: StandType }) {
  const w = TYPE_WALLS[type]
  const side = (on: boolean, x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={on ? 2.5 : 1} strokeDasharray={on ? undefined : '2 2'} />
  )
  return (
    <svg className="type-icon" viewBox="0 0 28 20" width={28} height={20} aria-hidden stroke="currentColor" fill="none">
      {side(false, 2, 18, 26, 18)}
      {side(w.left, 2, 2, 2, 18)}
      {side(w.right, 26, 2, 26, 18)}
      {side(w.back, 2, 2, 26, 2)}
    </svg>
  )
}

const TYPES: { value: StandType; label: string }[] = [
  { value: 'row', label: 'Rekke' },
  { value: 'corner', label: 'Hjørne' },
  { value: 'end', label: 'Ende' },
  { value: 'island', label: 'Øy' },
]

export interface StandSettingsProps {
  v: Variant
  res: CalcResult
  onEdit: (fn: (v: Variant) => Variant) => void
  /** Who pays the stand walls, and the organiser's colour (from the project). */
  terms: StandWallTerms
  onTerms: (patch: Partial<StandWallTerms>) => void
}

export function StandSettings({ v, res, onEdit, terms, onTerms }: StandSettingsProps) {
  const s = v.stand
  const k = res.keyFigures
  const side = (key: 'width' | 'depth', label: string) => (
    <Dim
      big
      label={label}
      value={s[key]}
      decimals={0}
      step={1}
      min={SIDE_MIN}
      max={SIDE_MAX}
      onChange={(n) => onEdit((x) => setStand(x, { ...x.stand, [key]: n }))}
    />
  )
  const beams = standardBeamsOn(v)
  const open = s.cornerSide ?? 'right'
  const plate = wallPlates().find((x) => x.ral === terms.ral)
  return (
    <div className="stand-set">
      {/* A corner stand's open side is a mirror, like a door's swing: named in the title, flipped with one icon */}
      <Section
        title="Standtype"
        aside={s.type === 'corner' ? `åpen mot ${open === 'left' ? 'venstre' : 'høyre'}` : undefined}
        tools={
          s.type === 'corner' && (
            <IconButton
              icon={ArrowLeftRight}
              label="Speil hjørnet"
              title={`Speil hjørnet · åpen mot ${open === 'left' ? 'høyre' : 'venstre'}`}
              size={15}
              onClick={() => onEdit((x) => setStand(x, { ...x.stand, cornerSide: open === 'left' ? 'right' : 'left' }))}
            />
          )
        }
      >
        <FlatChoice<StandType>
          tiles
          label="Standtype"
          value={s.type}
          onChange={(type) => onEdit((x) => setStand(x, { ...x.stand, type }))}
          options={TYPES.map((t) => ({
            value: t.value,
            label: (
              <>
                <TypeIcon type={t.value} />
                {t.label}
              </>
            ),
          }))}
        />
        <p className="set-note">{TYPE_TEXT[s.type]}</p>
      </Section>

      <Section title="Mål">
        <div className="stand-dims">
          {side('width', 'Bredde')}
          <span className="times" aria-hidden>
            ×
          </span>
          {side('depth', 'Dybde')}
        </div>
      </Section>

      {s.type !== 'island' && (
        <Section title="Standvegger betales av">
          <FlatChoice<Payer>
            label="Standvegger betales av"
            value={terms.payer}
            onChange={(payer) => onTerms({ payer })}
            options={[
              { value: 'arrangør', label: 'Arrangør' },
              { value: 'utstiller', label: 'Utstiller' },
            ]}
          />
        </Section>
      )}

      {s.type !== 'island' && terms.payer === 'arrangør' && (
        <Section title="Arrangørens farge" aside={plate ? `${plate.name} ${plate.ral}` : undefined}>
          <div className="stand-swatches">
            {wallPlates().map((x) => (
              <Sw key={x.ral} color={x.color} title={`${x.name} · RAL ${x.ral}`} on={terms.ral === x.ral} onClick={() => onTerms({ ral: x.ral! })} />
            ))}
          </div>
          <p className="set-note">Annen farge belastes utstiller.</p>
        </Section>
      )}

      <Section title="Takdrager langs åpne sider">
        <FlatChoice<boolean>
          label="Takdrager"
          value={beams}
          onChange={(on) => onEdit((x) => ({ ...x, noBeams: withStandardBeams(x, on) }))}
          options={[
            { value: false, label: 'Av' },
            { value: true, label: 'På' },
          ]}
        />
        {/* Lengths stay out of the title: capitals would turn m into M */}
        <p className="set-note">
          {!beams ? (s.type === 'island' ? 'Øy uten standvegger: tilvalg for utstiller.' : 'Ingen takdrager: mer åpen stand.') : `${fmt(k.beamLm)} m · ${beamSummary(k)}`}
        </p>
      </Section>
    </div>
  )
}
