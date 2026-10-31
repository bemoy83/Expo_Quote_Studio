import type { Strategy } from '../pricing/model';

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

export interface Footprint {
  w: number;
  d: number;
  h: number;
  round?: boolean;
}

export interface Product {
  id: string;
  name: string;
  kind: ProductKind;
  unit: Unit;
  /** Subgroup id in the product grouping (groups.ts). The main group is the panel menu and the quote group. */
  group: string;
  variants: ProductVariant[];
  /** For objects: size used for drawing and collision. */
  footprint?: Footprint;
  /** Short spec shown in the product row, e.g. "ø 70 · h 111". */
  dim?: string;
  /** Level 2: an article the montør picks, part of a level 1 product. Never a line on the quote. */
  article?: true;
  /** Sum: priced as the sum of the articles actually built (pricing/model.ts). Otherwise the variant's own price. */
  pricing?: Strategy;
  /** Goes in a wall module. A door swings and blocks its swing area; a curtain does not. */
  opening?: 'door' | 'curtain';
}

/** Roles the calc needs, mapped to art.nr so the catalog can change without touching calc. */
/** Level 1 products the calc derives from the drawing, by art.nr, so the catalog can change without touching calc. */
export interface SystemParts {
  /** Wall per metre, one variant per RAL. */
  wall: string;
  /** Takdrager per metre, posts included. */
  beam: string;
  /** Textile wall (frame rental + print), price per m² of B × H, sold per piece. */
  textile: string;
  foil: string;
  foilFull: string;
  floorProtection: string;
}

export interface Catalog {
  products: Product[];
  system: SystemParts;
}

export interface ResolvedVariant {
  product: Product;
  variant: ProductVariant;
}
