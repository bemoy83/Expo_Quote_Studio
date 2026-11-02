// The stand itself, in the order the stand chip names it: its type, its size, who pays the stand walls and the beams
// along its open sides. Flat choices without tracks, like the dock. Shown in the stand chip's popover on the drawing
// surface and on the panel's Stand tab.
import type { CalcResult } from '../../calc/calc'
import { setStand } from '../../domain/edit'
import type { Payer, StandType, StandWallTerms, Variant } from '../../domain/types'
import { Dim, FlatChoice } from '../controls'
import { rules, wallPlates } from '../env'
import { fmt, mm } from '../format'
import { beamSummary } from '../names'
import { Sw } from '../plan/QuickPicks'

/** Stand side, whole metres. */
const SIDE_MIN = 1
const SIDE_MAX = 40

const TYPE_TEXT: Record<StandType, string> = {
  row: 'Bare fronten er åpen. Lukkede sider får standvegg.',
  corner: 'Front og én side åpen. Lukkede sider får standvegg.',
  end: 'Tre sider åpne, standvegg bak.',
  island: 'Alle sider åpne. Ingen standvegg.',
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
    <Dim big label={label} value={s[key]} decimals={0} step={1} min={SIDE_MIN} max={SIDE_MAX} onChange={(n) => onEdit((x) => setStand(x, { ...x.stand, [key]: n }))} />
  )
  return (
    <div className="stand-set">
      <div className="panel-sec eyebrow">Standtype</div>
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
      {s.type === 'corner' && (
        <div className="set-row">
          <span className="lbl">Åpen mot</span>
          <FlatChoice<'left' | 'right'>
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

      <div className="panel-sec eyebrow">Mål</div>
      <div className="stand-dims">
        {side('width', 'Bredde')}
        <span className="times" aria-hidden>
          ×
        </span>
        {side('depth', 'Dybde')}
      </div>

      {s.type !== 'island' && (
        <>
          <div className="set-row">
            <span className="lbl">Standvegger betales av</span>
            <FlatChoice<Payer>
              label="Standvegger betales av"
              value={terms.payer}
              onChange={(payer) => onTerms({ payer })}
              options={[
                { value: 'arrangør', label: 'Arrangør' },
                { value: 'utstiller', label: 'Utstiller' },
              ]}
            />
          </div>
          {terms.payer === 'arrangør' && (
            <div className="set-row stacked">
              <span className="lbl">Arrangørens farge</span>
              <div className="stand-swatches">
                {wallPlates().map((x) => (
                  <Sw key={x.ral} color={x.color} title={`${x.name} · RAL ${x.ral}`} on={terms.ral === x.ral} onClick={() => onTerms({ ral: x.ral! })} />
                ))}
              </div>
            </div>
          )}
          <p className="panel-note">
            {terms.payer === 'arrangør'
              ? 'Standveggene og takdragerne som følger dem er ikke på tilbudet, plukklisten eller arbeidsordren. Annen farge enn arrangørens blir platebytte for utstilleren.'
              : 'Utstilleren betaler standveggene og takdragerne som følger dem.'}
          </p>
        </>
      )}

      <div className="set-row">
        <span className="lbl">
          Takdrager
          <small className="num">{v.noBeams ? 'Ingen · mer åpen stand' : `${fmt(k.beamLm)} m · ${beamSummary(k)}`}</small>
        </span>
        <FlatChoice<boolean>
          label="Takdrager"
          value={!v.noBeams}
          onChange={(on) => onEdit((x) => ({ ...x, noBeams: on ? undefined : true }))}
          options={[
            { value: false, label: 'Av' },
            { value: true, label: 'På' },
          ]}
        />
      </div>
      {!v.noBeams && (
        <p className="panel-note">
          {mm(rules.beam.height)} × {mm(rules.beam.thickness)} mm langs åpne sider, i flukt med veggtopp. Lange drag deles jevnt i hele meter (maks {fmt(rules.beam.max)} m) og
          skjøtes med stolpe og tverrdrager.
        </p>
      )}
    </div>
  )
}
