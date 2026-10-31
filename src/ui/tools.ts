// Tool state of the sketch screen. UI only, never stored in the model.

/** Velg · Pensel · Tøm */
export type Tool = 'select' | 'brush' | 'erase';

/** What the brush draws. The product chosen in the panel decides it ("produkt styrer pensel"). */
export type Brush =
  | { kind: 'wall'; ral: string }
  | { kind: 'floor'; product: string }
  | { kind: 'opening'; product: string }
  | { kind: 'object'; product: string }
  /** InFrame textile wall: click a wall face to fill its free part. */
  | { kind: 'textile' }
  /** Frittstående tekstilvegg: drag a straight run on the 0,25 m grid. */
  | { kind: 'freeTextile' }
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
