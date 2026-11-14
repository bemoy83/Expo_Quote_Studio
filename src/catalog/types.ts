import type { TextileFill } from '../domain/types';
import type { Strategy } from '../pricing/model';
import type { Time } from '../cost/time';

/** surface: floor, wall (drawn with a brush) · object: placed and drawn · counted: only a quantity · system: build parts the calc derives */
export type ProductKind = 'surface' | 'object' | 'counted' | 'system';

export type Unit = 'stk' | 'lm' | 'm²' | 't';

export interface ProductVariant {
  artnr: string;
  name: string;
  /** Hex colour for swatches, plan and 3D. Product data, not a design token. */
  color?: string;
  /** RAL code, for wall plates. */
  ral?: string;
  /** Price eks. mva. */
  price: number;
  /** Cost per unit from the OMS. Internal: the kalkyle shows the margin, the quote never does. */
  cost?: number;
  /** Example price, shown with * on the quote. */
  placeholder?: boolean;
}

export interface SetPiece {
  artnr: string;
  x: number;
  y: number;
  rot: number;
}

export interface Fabric {
  key: string;
  name: string;
  /** Hex colour for swatches and 3D. */
  color: string;
}

export interface Footprint {
  w: number;
  d: number;
  h: number;
  round?: boolean;
}

export interface Product {
  id: string;
  name: string;
  /** Kortnavn (Bjørn 14.11.2026): the name on buttons in the quick picks, e.g. «Dør» for «Dør med overstykke». Empty:
   *  the full name. The full name is on the name pill (hover, or hold on iPad). */
  short?: string;
  kind: ProductKind;
  unit: Unit;
  /** Subgroup id in the product grouping (groups.ts). The main group is the panel menu and the quote group. */
  group: string;
  variants: ProductVariant[];
  /** For objects: size used for drawing and collision. */
  footprint?: Footprint;
  /** A counter built of Foga profiles (Byggeregler K1–K5): outer size, mm. Drawn in 3D and costed from its recipe
   *  (foga/counter.ts); its footprint is the same size. */
  counter?: { length: number; depth: number };
  /** Disker og podier (Byggeregler K10–K13): drawn of sections and built on site, priced by the cost engine. Its
   *  `counter` and footprint are one section of 500 × 500, the size the pen starts from. */
  podium?: true;
  /** Short spec shown in the product row, e.g. "ø 70 · h 111". */
  dim?: string;
  /** Level 2: an article the montør picks, part of a level 1 product. Never a line on the quote. */
  article?: true;
  /** Sum: priced as the sum of the articles actually built (pricing/model.ts). Otherwise the variant's own price. */
  pricing?: Strategy;
  /** Minutes per unit and handling step, from the OMS. For fast products; sum products take it from their items. */
  time?: Time;
  /** Goes in a wall module. A door swings and blocks its swing area; a curtain does not. */
  opening?: 'door' | 'curtain';
  /** The colours a fabric comes in (forheng: sort, grå, blå, Bjørn 14.11.2026), the first the default. Same art.nr and
   *  price; the colour is on the line. A door leaf takes the wall colours (RAL) instead. */
  fabrics?: Fabric[];
  /** A furniture set (Møbel by use, Bjørn 14.11.2026): what the pen places together, each piece by art.nr where it
   *  stands from the set's middle (m, unturned) and its turn. Never a line itself: each piece is its own line, so its
   *  price is their sum. */
  set?: SetPiece[];
  /** Floor laid as carpet tiles: joints drawn at the tile edges, tiles counted per size for picking. */
  tiles?: true;
  /** Floor laid from a roll this wide, m, in lanes (baner): a joint between lanes, picked in running metres of roll. */
  roll?: number;
}

/** Roles the calc needs, mapped to art.nr so the catalog can change without touching calc. */
/** Level 1 products the calc derives from the drawing, by art.nr, so the catalog can change without touching calc. */
export interface SystemParts {
  /** Wall per metre, one variant per RAL. */
  wall: string;
  /** Plate swap per metre in a stand wall the organiser pays, one variant per RAL. */
  plateSwap: string;
  /** Støtteplate per piece under a post of a system wall that stands free. */
  wallSupport: string;
  /** Takdrager per metre, posts included. */
  beam: string;
  /** Lifting a takdrager over a textile wall, per extended post or hook point. */
  beamLift: string;
  /** Textile frame (rental), on a system wall or on foot plates: one product, price per m² of B × H, sold per piece. */
  textile: string;
  /** Textile per m² of visible face, by what it is: printed, white, or the customer's own (mounting only). */
  textileFill: Record<TextileFill, string>;
  foil: string;
  foilFull: string;
  /** Print on a counter of Disker og podier per m², the sizes cut on the line (Byggeregel K20). */
  foilCounter: string;
  /** Fitting one motif stretched over several plates and cutting the print file per plate, per motif. */
  printSetup: string;
  floorProtection: string;
  /** Shelf in a wall module, per piece (Byggeregel H1). */
  shelf: string;
}

export interface Catalog {
  products: Product[];
  system: SystemParts;
}

export interface ResolvedVariant {
  product: Product;
  variant: ProductVariant;
}
