// Tool state of the sketch screen. UI only, never stored in the model.
import { GRID_STEPS, type GridStep } from '../domain/snapGrid';
import { TILE_FULL, type TileSize } from '../domain/floor/tiles';
import { type FloorBrushSize } from '../domain/floor/brush';
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
  /** Disker og podier (Byggeregler K10–K13): sections on the 250 grid, all sides closed, its plates in a wall colour.
   *  `fine`: «Fin» on, as Shift held for touch (250 steps, a press by an edge takes it). */
  /** `h`: the height everything drawn gets, CC mm (K12); a påbygg takes its neighbour's. `stock`: the standard counter a
   *  click places (K22, its art.nr), none for «Fri» (a section 500 × 500); a drag always draws free. */
  | { kind: 'podium'; product: string; ral: string; fine?: boolean; h?: number; stock?: string }
  /** Tekstilvegg: drawn on a system wall it is mounted there (InFrame), anywhere else it stands free on foot plates.
   * Drawn on the drawing grid in cells of the chosen grid step; a click next to a wall fills its free part. */
  | { kind: 'textile' }
  /** A motif: on a textile it becomes the print, on a wall panel a foil decal. */
  | { kind: 'motif'; motif: string }
  /** Hylle 6311: one board in a wall module, on the face clicked; a drag along the wall lays a row (domain/shelves.ts). */
  | { kind: 'shelf' };

/** The drawing tools in the dock. Each one remembers its own brush (pen); the product chosen decides which tool draws it.
 * Openings and inner beams belong to Vegg, motifs to Profilering. Shelves have their own tool, Hyller (Bjørn 9.11.2026:
 * not under Møbel), where later wall fittings (heng) join them. Counters and podiums have theirs, Disker og podier,
 * after Hyller (Bjørn 13.11.2026; it took over Disker, the standard counters are its presets, K22). */
export type PenTool = 'wall' | 'floor' | 'profile' | 'fitting' | 'podium' | 'object'
export type DockTool = 'select' | PenTool | 'erase'

export function penToolOf(b: Brush): PenTool {
  switch (b.kind) {
    case 'wall':
    case 'opening':
    case 'beam':
      return 'wall'
    case 'floor':
      return 'floor'
    case 'textile':
    case 'motif':
      return 'profile'
    case 'shelf':
      return 'fitting'
    case 'podium':
      return 'podium'
    case 'object':
      return 'object'
  }
}

/** What a pen that places a piece of furniture on the floor puts there. */
export function placedBy(b: Brush | null): { product: string } | null {
  return b?.kind === 'object' ? { product: b.product } : null
}

/** The pen is out (not Velg) and draws this kind; with `id`, this product or motif too. */
export function penOn(tool: Tool, brush: Brush | null, kind: Brush['kind'], id?: string): boolean {
  if (tool === 'select' || brush?.kind !== kind) return false
  if (id === undefined) return true
  return ('product' in brush ? brush.product : 'motif' in brush ? brush.motif : undefined) === id
}

/** The tool shown as active in the dock. */
export const dockToolOf = (tool: Tool, brush: Brush | null): DockTool => (tool === 'brush' && brush ? penToolOf(brush) : tool === 'brush' ? 'select' : tool)

/** Floor brush sizes on the floor tool's quick picks. 1 × 1 and Auto first; the smaller tiles under «Andre». */
export const FLOOR_MAIN: { label: string; size: FloorBrushSize; title: string }[] = [
  { label: '1 × 1', size: TILE_FULL, title: 'Flis 100 × 100' },
  { label: 'Auto', size: 'auto', title: 'Auto · 1 × 1 der det er plass, ellers største flis som passer på ledig gulv' },
];
export const FLOOR_OTHER: { label: string; size: TileSize }[] = [
  { label: '1 × 0,5', size: { w: 2, h: 1 } },
  { label: '0,5 × 1', size: { w: 1, h: 2 } },
  { label: '0,5 × 0,5', size: { w: 1, h: 1 } },
];

export const floorSizeLabel = (s: FloorBrushSize) =>
  s === 'auto' ? 'Auto' : ([...FLOOR_MAIN, ...FLOOR_OTHER].find((x) => x.size !== 'auto' && x.size.w === s.w && x.size.h === s.h)?.label ?? '1 × 1');

/** Calc group hovered in the calc panel; the plan dims everything else. */
export type Highlight = 'walls' | 'beams' | 'openings' | 'textile' | 'foil' | 'floor' | 'objects' | null;

/** Grid steps each straight-run brush can draw with (domain/snapGrid). System walls follow the wall cc: only 1 m until
 * the Foga recipe has the parts for cc 25, 50 and 75. */
export function gridSteps(brush: Brush | null, rules: Rules): readonly GridStep[] {
  if (brush?.kind === 'textile') return GRID_STEPS
  if (brush?.kind === 'wall' || brush?.kind === 'beam') return GRID_STEPS.filter((s) => Math.abs(s - rules.wall.cc) < 1e-9)
  return []
}

/** A plan layer: the calc groups the plan can dim. */
export type Layer = Exclude<Highlight, null>

/** Layers that stay at full strength while a pen draws or erases; the rest are toned down so what the pen works on
 * stands out. Vegg keeps everything on the walls, Profilering and Hyller keep the walls they hang on (and what is on
 * them), Disker og podier and Møbel keep the walls they must clear. */
const PEN_LAYERS: Record<PenTool, readonly Layer[]> = {
  wall: ['walls', 'openings', 'beams', 'textile', 'foil'],
  floor: ['floor'],
  profile: ['walls', 'openings', 'textile', 'foil'],
  fitting: ['walls', 'openings', 'textile', 'foil'],
  podium: ['walls', 'openings', 'objects'],
  object: ['walls', 'openings', 'objects'],
}

/** Layers kept at full strength for the tool in hand, or null when nothing is toned down (Velg and Tøm). */
export const penLayers = (tool: Tool, brush: Brush | null): ReadonlySet<Layer> | null =>
  tool !== 'brush' || !brush ? null : new Set(PEN_LAYERS[penToolOf(brush)])
