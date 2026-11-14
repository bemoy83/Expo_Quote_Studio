// The wall colours as a row of swatches, shared by the dock's quick picks and the selection pill.
import type { Fabric } from '../../catalog/types'
import { wallPlates } from '../env'

/** Colours on a pill, as many as fit beside the bucket. */
const MAX = 8

export interface Swatch {
  key: string
  color?: string
  title: string
  on: boolean
  onClick: () => void
}

/** The wall colours as swatches, the same row wherever walls or counters are coloured: Vegg and Disker on the dock,
 *  the wall and counter pill. `value` = the chosen RAL. */
export function ralSwatches(value: string | undefined, title: (name: string) => string, onPick: (ral: string) => void): Swatch[] {
  return wallPlates()
    .slice(0, MAX)
    .map((x) => ({ key: x.ral!, color: x.color, title: `${title(x.name.toLowerCase())} · RAL ${x.ral}`, on: value === x.ral, onClick: () => onPick(x.ral!) }))
}

/** A fabric's colours as swatches (forheng: sort, grå, blå), on the wall pill and the curtain's pill. */
export function fabricSwatches(fabrics: readonly Fabric[], value: string | undefined, title: (name: string) => string, onPick: (key: string) => void): Swatch[] {
  return fabrics.map((f) => ({ key: f.key, color: f.color, title: title(f.name.toLowerCase()), on: value === f.key, onClick: () => onPick(f.key) }))
}
