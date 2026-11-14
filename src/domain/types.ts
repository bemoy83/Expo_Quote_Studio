// Stand model: the single source of truth. Plan, 3D, calc, quote and production are derived from it.
// Units are metres. The plan origin is the back-left corner; x grows to the right, y toward the front (aisle).
//
// Glossary (spec term → code):
//   Stand → Stand · Vegg → Wall · Åpning → Opening · Gulv → Floor · Objekt → PlacedObject
//   Tekstilvegg → TextileWall · Frittstående tekstilvegg → FreeTextile · Foliedekor → Foil · Tellevare → CountedItem · Variant → Variant
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
  /** Set on the walls a room generates (see rooms.ts). They are rewritten whenever the room changes. */
  room?: { id: string; side: number };
}

/** An optional takdrager drawn inside the stand: a straight run on the 1 m grid (calc/beams/innerBeams.ts). */
export interface InnerBeam {
  id: string;
  from: Point;
  to: Point;
}

/**
 * Bakrom, møterom, lager, frihåndsrom: a right-angled outline on the 1 m grid that owns its walls (see outline.ts).
 * Its sides are generated as walls (`<id>.<side>`) after the stored walls, so a side that already has a stand wall
 * or a drawn wall shares it and is built once. Calc only ever sees the walls.
 */
export interface Room {
  id: string;
  /**
   * Corners in whole metres, canonical: from the back-most, then left-most corner, clockwise in the plan.
   * Four for a rectangle, six for an L. Side i runs from corner i to corner i + 1.
   */
  outline: Point[];
  /** Shown in the plan and on the quote: Bakrom, Lager, Møterom … */
  label?: string;
  /** RAL of the room's own walls. Falls back to the variant's default plate. */
  plate?: string;
  /** Modules taken out with the eraser: open, no wall and no product. */
  gaps?: { side: number; module: number }[];
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
  /**
   * Which end of the module the door hangs on: 1 = the end toward the wall's `from`, −1 = the other. Omitted: 1.
   * Kept on the same world end when the wall is rewritten (as swing).
   */
  hinge?: 1 | -1;
  /** RAL of the door leaf. Omitted: the variant's default plate, so the door follows the stand's colour. */
  ral?: string;
  /** A curtain's colour: the key of one of its product's fabrics. Omitted: the first, the default. */
  fabric?: string;
}

/** A floor tile in 0,5 m cells: starts at cell (i, j), w × h cells (domain/floor/). */
export interface FloorTile {
  i: number;
  j: number;
  w: number;
  h: number;
  /** Floor product's art.nr. */
  product: string;
  /** Set on a lane of rolled floor (engangsteppe): the direction the roll runs, along its length. A lane is at most
   * one roll wide across it; a narrower lane is cut lengthwise from a whole roll. */
  roll?: 'x' | 'y';
  /** Lane laid by Fyll (domain/floor/rollFill.ts): the lanes of one fill share this id, so the fill can be laid another way. */
  fill?: string;
  /** Lanes cut from one piece of roll: two narrow lanes side by side, or one narrow lane split in two halves laid end
   * to end. The piece is as long as the longest of them. */
  split?: string;
}

export interface Floor {
  /** Laid tiles, never overlapping. Their edges are the joints. */
  tiles: FloorTile[];
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
  /** A counter's plates (Byggeregel K6): a wall colour, RAL. Omitted = the counter as in stock, white 9010. */
  ral?: string;
  /** A counter Disker drew (Byggeregler K7, K8) before Disker og podier took it over: its straight pieces, in its own
   *  coordinates around (x, y), mm, front toward +y unturned. Only in old sketches: made sections when one opens
   *  (domain/podiumStock.ts asSections, K22). */
  pieces?: CounterPiece[];
  /** A counter or podium from Disker og podier (Byggeregler K10–K13, domain/podiums.ts): its sections in its own
   *  coordinates around (x, y), mm c/c between nodes on the 250 grid, front toward +y unturned. */
  sections?: CounterSection[];
  /** A furniture set it was placed with (Møte, Lounge, Mingle; Bjørn 14.11.2026): the objects sharing this id move,
   *  turn and settle as one, and stay apart from each other's collisions (a chair may tuck under its table). Loosened
   *  from the set, it is a piece on its own. */
  set?: string;
}

/** One section of Disker og podier (K10, K12): x and z from node to node, mm, and its height `h`, CC 250, 500, 750 or
 *  1000 (the underside of its top rail). `sides`: what its outer sides are (K16), by the way each faces. */
export interface CounterSection {
  x: [number, number];
  z: [number, number];
  h: number;
  sides?: Partial<Record<SectionSideKey, SectionSide>>;
  /** Its shelves (K19), the CC heights 250, 500 or 750 below `h`, low to high; each splits its sides into one more
   *  light opening (K16). */
  shelves?: number[];
}

/** A side of a section by the way it faces: across x at x[0] (`x-`) or x[1] (`x+`), across z at z[0] or z[1]. */
export type SectionSideKey = 'x-' | 'x+' | 'z-' | 'z+';

/** What a light opening of a counter's side is (Byggeregel K16), when not a plate: open, or a sliding door (K17). The
 *  light openings of a side are counted from the floor, one under each shelf (K19) and one over the highest. */
export type CounterLight = 'open' | 'door';

/** One side of a section (K16): each light opening from the floor up, a plate where missing or null. Only where the side
 *  is outside the counter; a side that becomes inner loses it (domain/podiumFaces.ts). */
export interface SectionSide {
  lights?: (CounterLight | null)[];
  /** Print over the whole of its parts (Byggeregel K20): the motif, as a decal over every plate and door. */
  print?: string;
  /** Decals on it (K20). */
  decals?: PodiumDecal[];
}

/** A decal on a side of a counter of Disker og podier (K20), mm: its size, its centre from the middle of the section's
 *  side as seen from outside (left to right), and its centre's height above the floor. */
export interface PodiumDecal {
  id: string;
  motif: string;
  w: number;
  h: number;
  x: number;
  y: number;
}

/** One straight piece of a counter Disker drew (old sketches only, K22): its centre line from `a` to `b` (whole metres from `a`, a half last, K7),
 *  and the side it is open toward, where the staff stand. mm, in the counter's own coordinates. */
export interface CounterPiece {
  a: Point;
  b: Point;
  back: Point;
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
  /** Wall face, as for door swing: 1 = left normal of from → to, −1 = the other. Omitted: into the stand (see faces.ts). */
  side?: 1 | -1;
  motif?: string;
  /** Fills the free span it sits in and grows or shrinks with it ("Fyll veggen"). */
  fit?: boolean;
  /** What the textile is. Omitted: printed. */
  fill?: TextileFill;
}

/** trykt · hvit uten grafikk · kundens egen duk i samme størrelse (bare montering) */
export type TextileFill = 'print' | 'white' | 'reuse';

/** One face of a free-standing textile wall. Textile is always on both faces. */
export interface TextileFace {
  /** Omitted: printed. */
  fill?: TextileFill;
  /** Motif shown in plan and 3D for a printed face. */
  motif?: string;
}

/**
 * Frittstående tekstilvegg: a 43TX frame standing on foot plates, textile on both faces, not part of the Foga wall
 * system (no rooms or doors). A straight run on the 0,25 m grid, axis-aligned. A run longer than the max rail length
 * stays one frame with spliced top and bottom rails. Two runs whose ends meet at a right angle share a 92LTX corner
 * post (see textile/free.ts).
 */
export interface FreeTextile {
  id: string;
  from: Point;
  to: Point;
  /** Face A: left normal of from → to (as door swing, side 1). Face B: the other (side −1). */
  a?: TextileFace;
  b?: TextileFace;
}

/** Foil decor inside a single wall panel (960 × 2420), never across a post. A print covering the panel may sit on a door. */
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
  /**
   * Print stretched over several plates (the paint bucket with «Print», domain/print.ts): the id shared by its plates.
   * Omitted: a decal, or a whole motif on this one plate.
   */
  run?: string;
  /** Part of the motif on this plate, as fractions of the image seen from the face: [left, top, right, bottom]. */
  crop?: [number, number, number, number];
}

/**
 * A shelf (hylle 6311): one board in one wall module, on brackets in the posts' face channels (byggeregler H1–H6,
 * domain/shelves/, domain/fittings.ts). Shelves side by side at the same height are a row and share the bracket between them.
 */
export interface Shelf {
  id: string;
  wallId: string;
  module: number;
  /** Wall face, as for textiles and foils. */
  side?: 1 | -1;
  /** Top of the board above the floor, metres. */
  y: number;
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
  /** Stored walls first, then the walls generated by `rooms`. */
  walls: Wall[];
  /**
   * Plates coloured one by one: RAL by module key (the plate's edge in the plan), over the colour of the wall it is on.
   * Keyed by the edge, so a plate keeps its colour when walls are split, merged or share it (see panels.ts).
   */
  panels?: Record<string, string>;
  rooms: Room[];
  openings: Opening[];
  floor: Floor;
  objects: PlacedObject[];
  textiles: TextileWall[];
  /** Frittstående tekstilvegger. */
  freeTextiles: FreeTextile[];
  foils: Foil[];
  counted: CountedItem[];
  loose: LooseLine[];
  /** Standard takdrager turned off (true) or on (false); omitted = the stand type's default: they follow the stand
   *  walls, so on, except on an island, which has none (Bjørn 3.11.2026, {@link standardBeamsOn}). */
  noBeams?: boolean;
  /** Innvendige takdragere the customer draws, always the exhibitor's (calc/beams/innerBeams.ts). Omitted = none. */
  innerBeams?: InnerBeam[];
  /** Shelves on wall faces (domain/shelves/). Omitted = none. */
  shelves?: Shelf[];
}

export interface ProjectField {
  id: string;
  name: string;
  value: string;
}

/** When the stand is built, opens and is taken down. ISO dates (YYYY-MM-DD). Placeholder: later from the OMS project. */
export interface Delivery {
  montering?: string;
  apning?: string;
  demontering?: string;
}

/** Who an invoice line goes to. Stand walls can be billed to the fair organiser (docs/vegger.md). */
export type Payer = 'utstiller' | 'arrangør';

/** Who pays the stand walls of the stand type, and the colour the organiser delivers them in. Set per project (the
 *  fair): later from the OMS project, with the purchased area. Any other colour on a stand wall the organiser pays is a
 *  plate swap the exhibitor pays. */
export interface StandWallTerms {
  payer: Payer;
  ral: string;
}

/** Customer name, project and stand no. are fixed fields; more can be added. */
export interface Project {
  fields: ProjectField[];
  delivery?: Delivery;
  /** Missing: DEFAULT_STAND_WALLS (domain/variant.ts). */
  standWalls?: StandWallTerms;
  /** The kostgrunnlag the quote was last saved with, so it shows what its cost was calculated with. */
  costBasis?: CostBasisRef;
}

/** A customer motif uploaded by the user (image as data URL). */
export interface Motif {
  id: string;
  name: string;
  ratio: number;
  src: string;
}

/** What a quote remembers about the basis it was calculated with. */
export interface CostBasisRef {
  version: string;
  date: string;
  example: boolean;
  /** Fingerprint of everything the calc ran on (`PricingData.code`, src/pricing/data.ts). Missing in older files. */
  code?: string;
}
