// Read-only plan: the sketch on Tilbud and Arbeidsordre and the 3D view's mini map.
import type { CalcResult } from '../../calc/calc'
import type { FloorBrushSize } from '../../domain/floor/brush'
import { TILE_FULL } from '../../domain/floor/tiles'
import type { Variant } from '../../domain/types'
import { PlanView } from './PlanView'
import type { PlanSelection } from './selection'

/** Read-only plan: the quote's sketch and the 3D view's mini map. Outside the mini map it is a document (wider lines). */
export function PlanPreview(p: { v: Variant; res: CalcResult; mini?: boolean; groups?: ReadonlySet<string>; floorFull?: boolean; positions?: boolean; textileLabels?: boolean }) {
  const { v, res, mini, groups, floorFull } = p
  return (
    <PlanView
      mini={mini}
      doc={!mini}
      floorFull={floorFull}
      positions={p.positions}
      textileLabels={p.textileLabels}
      groups={groups}
      v={v}
      res={res}
      tool="select"
      brush={null}
      floorSize={PREVIEW_FLOOR_SIZE}
      highlight={null}
      selection={NO_SELECTION}
      onSelect={noop}
      onEdit={noop}
      onCheckpoint={noop}
      onToast={noop}
    />
  )
}
const PREVIEW_FLOOR_SIZE: FloorBrushSize = TILE_FULL
const NO_SELECTION: PlanSelection = {}
const noop = () => {}
