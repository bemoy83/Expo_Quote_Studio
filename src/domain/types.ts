// Stand model: the single source of truth. Plan, 3D, calc, quote and production are derived from it.
// Units are metres. The plan origin is the back-left corner; x grows to the right, y toward the front (aisle).
//
// Glossary (spec term → code):
//   Stand → Stand · Vegg → Wall · Åpning → Opening · Gulv → Floor · Objekt → PlacedObject
//   Tekstilvegg → TextileWall · Foliedekor → Foil · Tellevare → CountedItem · Variant → Variant
//   Prosjekt → Project · Produkt → Product (see catalog)

export type Point = readonly [x: number, y: number];

/** rekke · hjørne · ende · øy */
export type StandType = 'row' | 'corner' | 'end' | 'island';

export type Side = 'back' | 'front' | 'left' | 'right';

export interface Stand {
  /** Width along the aisle, whole metres. */
  width: number;
  /** Depth from the aisle, whole metres. */
  depth: number;
  type: StandType;
  /** Which side is open on a corner stand (besides the front). */
  cornerSide?: 'left' | 'right';
}

/** A straight wall run on the 1 m grid. It is built from modules at cc 1000. */
export interface Wall {
  id: string;
  from: Point;
  to: Point;
  /** RAL code of the wall plate. Falls back to the variant's default plate. */
  plate?: string;
}

/** A door or curtain in one wall module. The header panel (overstykke) is implicit. */
export interface Opening {
  id: string;
  wallId: string;
  /** Module index counted from the wall's `from` end. */
  module: number;
  /** Art.nr of the door or curtain. */
  product: string;
  /**
   * Which side a door swings to, relative to the wall direction from → to:
   * 1 = left normal (−dy, dx), −1 = the other side. Omitted: into the stand on a perimeter wall, else 1.
   */
  swing?: 1 | -1;
}

export interface Floor {
  /** 0,5 m cells keyed `i,j` (see cellKey). Value is the floor product's art.nr. */
  cells: Record<string, string>;
  /** Monteringsplast over the whole floor area. */
  protection: boolean;
}

/** Furniture, counters: drawn from above, placed and colliding. */
export interface PlacedObject {
  id: string;
  product: string;
  x: number;
  y: number;
  rot: number;
}

/** InFrame: fabric stretched in an aluminium frame, mounted against a wall (not in it). */
export interface TextileWall {
  id: string;
  wallId: string;
  /** Offset along the wall from `from`, metres. */
  from: number;
  /** Span along the wall, metres. */
  width: number;
  /** Height in metres. Omitted means full wall height (less `bottom`). */
  height?: number;
  /** Distance from the floor to the frame, metres. Omitted means on the floor. */
  bottom?: number;
  /** Wall face, as for door swing: 1 = left normal of from → to, −1 = the other. Omitted: into the stand (see decor.ts). */
  side?: 1 | -1;
  motif?: string;
}

/** Foil decor inside a single wall panel (960 × 2420), never across a post. */
export interface Foil {
  id: string;
  wallId: string;
  module: number;
  /** Wall face, as for textiles. */
  side?: 1 | -1;
  /** Covers the whole panel. Size and position then follow the panel. */
  full: boolean;
  /** Decal size, metres. */
  width: number;
  height: number;
  /** Decal centre: offset from the panel centre along the wall (from → to), and height above the floor, metres. */
  x: number;
  y: number;
  motif?: string;
}

/** Power, AV, plants: counted, not placed. */
export interface CountedItem {
  product: string;
  qty: number;
}

/** A free-text line on the quote (catering, staff …). Never drawn. */
export interface LooseLine {
  id: string;
  name: string;
  qty: number;
  price: number;
}

export type VariantName = 'A' | 'B' | 'C' | 'D';

export interface Variant {
  name: VariantName;
  stand: Stand;
  /** RAL code used by walls without their own plate. */
  defaultPlate: string;
  walls: Wall[];
  openings: Opening[];
  floor: Floor;
  objects: PlacedObject[];
  textiles: TextileWall[];
  foils: Foil[];
  counted: CountedItem[];
  loose: LooseLine[];
}

export interface ProjectField {
  id: string;
  name: string;
  value: string;
}

/** Customer name, project and stand no. are fixed fields; more can be added. */
export interface Project {
  fields: ProjectField[];
}
