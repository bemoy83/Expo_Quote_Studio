// What the calculation gives: the quote lines, their groups, the margin, the key figures and the rest of the result.
import type { Unit } from '../catalog/types';
import type { Payer, Point } from '../domain/types';
import type { Bom } from '../foga/engine';
import type { FogaStructure } from '../foga/structure';
import type { Strategy, Time, Transfer } from '../pricing/model';
import type { BeamLayout } from './beams';
import type { Production } from './production';
import type { WallSupport } from './wallSupports';

export interface CalcLine {
  name: string;
  meta?: string;
  qty: number;
  unit: Unit;
  /** Sales price per unit eks. mva.: from cost and target DG (sum) or the catalog price (fast). */
  price: number;
  sum: number;
  artnr: string;
  /** Example or unknown price: * on the quote. */
  placeholder: boolean;
  /** Subgroup id (catalog/groups.ts), from the product. */
  group: string;
  /** Built from Foga parts: the picking list shows the parts (foga/engine.ts) instead of this line. */
  foga?: true;
  /** Internal, never on the quote. Cost of the whole line, null when not known (no cost data). */
  cost: number | null;
  /** Dekningsgrad of the line, null when the cost is not known. */
  dg: number | null;
  /** How the price was set. `fast` also when a sum product lacks cost data. */
  strategy: Strategy;
  transfer: Transfer | 'blandet' | null;
  /** Shown to the customer when the product is part rental, part sale. */
  terms?: string;
  /** Minutes per handling step for the whole line (from the OMS price list or the product). */
  time: Time;
  /** Who the line is invoiced to. Only stand walls and the takdrager that follow them can go to the organiser. */
  payer: Payer;
  /** Lines with the same key are one line on the quote, named `name`, with the quantity and unit of the `lead` line
   *  (textile walls: frame and textile). */
  quote?: { key: string; name: string; lead: boolean; size?: string };
  /** Shown on the quote under the name, one per row (textile walls: '2 stk 3970 × 2540 mm' per size). */
  details?: string[];
  /** Carpet tiles: pieces per tile size, largest first. The picking list counts these instead of m². */
  tiles?: { size: string; qty: number }[];
  /** Rolled floor in lanes: running metres of roll (with the end allowance), waste in m², and the lanes as cut. The
   *  picking list counts the metres instead of m². */
  roll?: {
    width: number;
    lm: number;
    waste: number;
    lanes: { length: number; width: number; cut: boolean; qty: number }[];
    /** Pieces cut from the roll, alike ones counted together: length as cut, the widths it is split into. */
    pieces: { length: number; parts: number[]; endToEnd: boolean; qty: number }[];
    /** Tape, lm: the outline and the seams. Picked, never priced. */
    tape: number;
  };
}

/** One main group of the product grouping, lines in subgroup order. */
export interface CalcGroup {
  id: string;
  name: string;
  lines: CalcLine[];
  sum: number;
  /** Cost of the lines with known cost. */
  cost: number;
}

export interface KeyFigures {
  area: number;
  openSides: number;
  /** Wall modules that are wall, not opening. Shared walls count once. */
  wallLm: number;
  /** Part of wallLm in stand walls (from the stand type), whoever pays them. */
  standWallLm: number;
  /** Part of standWallLm the organiser pays: not on the exhibitor's quote, picking list or work order. */
  organiserWallLm: number;
  /** Takdrager the organiser pays (the standard ones, or none), with the posts only they need. */
  organiserBeamLm: number;
  /** Part of beamLm in innvendige takdragere the customer draws: always the exhibitor's. */
  innerBeamLm: number;
  /** Ends of drawn takdrager hung on another beam. */
  beamHooks: number;
  /** Part of wallLm in inner walls the exhibitor draws (room walls not included). */
  innerWallLm: number;
  /** Part of wallLm that rooms build themselves (sides shared with other walls not included). */
  roomWallLm: number;
  /** Metres of stand wall the organiser pays where the exhibitor swaps in a coloured plate. */
  swapLm: number;
  openings: number;
  beamLm: number;
  beamLengths: number;
  posts: number;
  /** Posts that exist only because of the beams. */
  beamPosts: number;
  /** Støtteplater under the posts of system walls that stand free, and under drawn takdrager's own posts. */
  wallSupports: number;
  /** Wall modules including those with a door or curtain (each gets top and bottom rail, in its header if an opening). */
  modules: number;
  /** m² per floor art.nr. */
  floor: Record<string, number>;
  floorTotal: number;
  textileM2: number;
  foilM2: number;
  /** Minutes per handling step for the whole stand. In the prices, not a line; the work order plans from it. */
  time: Time;
}

/** Internal margin of the whole variant. Never on the quote. */
export interface Margin {
  /** Cost of the lines with known cost. */
  cost: number;
  /** Sales sum of those lines. */
  sum: number;
  /** Dekningsbidrag and dekningsgrad over the lines with known cost. */
  db: number;
  dg: number;
  /** Lines without cost data: their price is the catalog price and they are not in the margin. */
  unknown: number;
  /** Costs once per quote (start of print, admin and picking, delivery), in `cost`: not a price, the quote's lines
   *  carry none of it (docs/kostmodell.md). */
  order: { id: string; name: string; cost: number }[];
}

export interface CalcResult {
  groups: CalcGroup[];
  sum: number;
  margin: Margin;
  keyFigures: KeyFigures;
  beams: BeamLayout;
  /** Takdrager lifted over textile walls (calc/beamLift.ts; the lengths are `lifted` in `beams`): the posts extended
   *  under them, and the hook points between a lifted beam and one that is not. Only when there are any. */
  lift?: { posts: Point[]; hooks: Point[] };
  posts: Point[];
  /** Støtteplater under free-standing system walls and drawn takdrager's own posts: always the exhibitor's, also under
   *  the organiser's stand walls. */
  wallSupports: WallSupport[];
  production: Production;
  /** What is built, in Foga terms: the quote counts from it and the picking list lists its parts. */
  foga: FogaStructure;
  /** Level 2 and 3: the Foga parts list of `foga`. The picking list and the kalkyle's articles show it. */
  bom: Bom;
  /** Billed to the organiser: the stand walls when the organiser pays them, and the takdrager that follow them. Outside the exhibitor's sum, margin, time,
   *  `foga` and `bom`, so not on the quote, picking list or work order: the organiser's walls come as their own order
   *  from the OMS, counted once for the hall (two stands back to back share one wall). */
  organiser: { lines: CalcLine[]; sum: number; cost: number };
}
