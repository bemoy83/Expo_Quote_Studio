// The stand itself, in the order the stand chip names it: its type, its size, who pays the stand walls and the beams
// along its open sides. Shown in the stand chip's popover on the drawing surface and on the panel's Stand tab.
import type { CalcResult } from '../../calc/calc'
import { setStand } from '../../domain/edit'
import type { Payer, StandType, StandWallTerms, Variant } from '../../domain/types'
import { Dim, Segmented, Switch } from '../controls'
import { idx, rules } from '../env'
import { fmt, mm } from '../format'
import { beamSummary } from '../names'

/** Stand side, whole metres. */
const SIDE_MIN = 1
const SIDE_MAX = 40

const TYPE_TEXT: Record<StandType, string> = {
  row: 'Bare fronten er åpen. Lukkede sider får standvegg.',
  corner: 'Front og én side åpen. Lukkede sider får standvegg.',
  end: 'Tre sider åpne, standvegg bak.',
  island: 'Alle sider åpne. Ingen standvegg.',
}

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
    <Dim label={label} value={s[key]} decimals={0} step={1} min={SIDE_MIN} max={SIDE_MAX} onChange={(n) => onEdit((x) => setStand(x, { ...x.stand, [key]: n }))} />
  )
  return (
    <>
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
      <div className="stand-dims">
        {side('width', 'Bredde')}
        {side('depth', 'Dybde')}
      </div>
      {s.type !== 'island' && (
        <>
          <div className="opt">
            <span className="lbl">Standvegger betales av</span>
            <Segmented<Payer>
              inWell
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
            <div className="opt">
              <span className="lbl">Arrangørens farge</span>
              <select className="field" aria-label="Arrangørens farge" value={terms.ral} onChange={(e) => onTerms({ ral: e.target.value })}>
                {[...idx.wallByRal.values()].map(({ variant }) => (
                  <option key={variant.ral} value={variant.ral}>
                    {variant.name} · RAL {variant.ral}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="panel-note">
            {terms.payer === 'arrangør'
              ? 'Standveggene og takdragerne som følger dem er ikke på tilbudet, plukklisten eller arbeidsordren. Annen farge enn arrangørens blir platebytte for utstilleren.'
              : 'Utstilleren betaler standveggene og takdragerne som følger dem.'}
          </p>
        </>
      )}
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
