/** surface: floor, wall plate · object: placed and drawn · counted: only a quantity · system: build parts the calc derives */
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
  /** Price group on the quote (and OMS varegruppe later). */
  category: string;
  subgroup?: string;
  /** Panel menu the product appears under. */
  menu?: string;
  variants: ProductVariant[];
  /** For objects: size used for drawing and collision. */
  footprint?: Footprint;
  /** Short spec shown in the product row, e.g. "ø 70 · h 111". */
  dim?: string;
}

/** Roles the calc needs, mapped to art.nr so the catalog can change without touching calc. */
export interface SystemParts {
  post: string;
  topRail: string;
  bottomRail: string;
  beam: string;
  header: string;
  frame: string;
  print: string;
  foil: string;
  foilFull: string;
  floorProtection: string;
  labour: string;
}

export interface Catalog {
  products: Product[];
  system: SystemParts;
}

export interface ResolvedVariant {
  product: Product;
  variant: ProductVariant;
}
