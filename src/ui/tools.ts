// Tool state of the sketch screen. UI only, never stored in the model.
import { GRID_STEPS, type GridStep } from '../domain/snapGrid';
import type { Rules } from '../rules/rules';

/** Velg · Pensel · Tøm */
export type Tool = 'select' | 'brush' | 'erase';

/** What the brush draws. The product chosen in the panel decides it ("produkt styrer pensel"). */
export type Brush =
  | { kind: 'wall'; ral: string }
  /** Innvendig takdrager: a straight run on the 1 m grid inside the stand (domain/innerBeams.ts). */
  | { kind: 'beam' }
  | { kind: 'floor'; product: string }
  | { kind: 'opening'; product: string }
  | { kind: 'object'; product: string }
  /** Tekstilvegg: drawn on a system wall it is mounted there (InFrame), anywhere else it stands free on foot plates.
   * Drawn on the drawing grid in cells of the chosen grid step; a click next to a wall fills its free part. */
  | { kind: 'textile' }
  /** A motif: on a textile it becomes the print, on a wall panel a foil decal. */
  | { kind: 'motif'; motif: string };

/** Floor brush size in 0,5 m cells. */
export interface FloorSize {
  w: number;
  h: number;
}

export const FLOOR_SIZES: { label: string; size: FloorSize }[] = [
  { label: '1 × 1', size: { w: 2, h: 2 } },
  { label: '1 × 0,5', size: { w: 2, h: 1 } },
  { label: '0,5 × 1', size: { w: 1, h: 2 } },
  { label: '0,5 × 0,5', size: { w: 1, h: 1 } },
];

/** Calc group hovered in the calc panel; the plan dims everything else. */
export type Highlight = 'walls' | 'beams' | 'openings' | 'textile' | 'foil' | 'floor' | 'objects' | null;

/** Grid steps each straight-run brush can draw with (domain/snapGrid). System walls follow the wall cc: only 1 m until
 * the Foga recipe has the parts for cc 25, 50 and 75. */
export function gridSteps(brush: Brush | null, rules: Rules): readonly GridStep[] {
  if (brush?.kind === 'textile') return GRID_STEPS
  if (brush?.kind === 'wall' || brush?.kind === 'beam') return GRID_STEPS.filter((s) => Math.abs(s - rules.wall.cc) < 1e-9)
  return []
}
