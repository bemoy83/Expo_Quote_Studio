// What is to be built, in Foga terms and mm. Neutral: no plan geometry, no prices, no loose goods.
// fromVariant.ts derives it from the stand sketch; the engine turns it into a parts list.

/** One wall module between two posts (cc 1000). */
export interface ModuleSpec {
  /** RAL of the plate (the header plate above an opening). */
  plate: string;
  /** A door or curtain: the module gets a header instead of a full wall. */
  opening: boolean;
  /** The opening is a curtain: its header has 92 at the bottom for the glider (Byggeregel D2). */
  curtain?: boolean;
}

/** One length of takdrager, post centre to post centre. */
export interface BeamSpec {
  lengthMm: number;
}

/**
 * What one textile frame is built of, counted once (calc/textile/common.ts): the picking list (engine.ts) and the
 * kalkyle (calc/textile/lines.ts) both read it. A corner post shared by two free-standing frames is not here
 * (calc/production.ts counts them).
 */
export interface FrameParts {
  /** Frame profile pieces by cut length: top and bottom rails, the sides or the uprights at free ends, mm. */
  cuts: readonly (readonly [length: number, qty: number])[];
  /** The pieces among `cuts` with a butt end, at a rail splice or a 92LTX corner post; the rest are mitred (Bjørn 8.11.2026):
   *  length, butt ends per piece (1 or 2), qty. */
  butt?: readonly (readonly [length: number, ends: number, qty: number])[];
  /** Upright braces, each stored with its couplings. */
  braces: { qty: number; length: number };
  /** Loose parts by Foga code: corner and splice connectors, wall brackets, foot plates. */
  loose: readonly (readonly [code: string, qty: number])[];
  /** Couplings to put together and take apart on site: the corner and splice connectors and both ends of every brace. */
  couplings: number;
}

/** One textile frame, on a system wall or on foot plates (one product, Bjørn 7.11.2026). Sizes as built, mm. */
export interface FrameSpec {
  /** Production position: T1, T2 … on a wall, F1, F2 … on foot plates. */
  pos: string;
  parts: FrameParts;
}

export interface FogaStructure {
  /** Posts: every wall point and every point a takdrager needs. All are the same post (94 with foot). */
  posts: number;
  modules: ModuleSpec[];
  beams: BeamSpec[];
  /** Hooks in Flex 01 a takdrager hangs on another beam or a wall's top rail 92 with (calc/beamHooks.ts): one leg
   *  (enveis) or two (toveis). */
  beamHooks?: { oneWay: number; twoWay: number };
  /** Takdrager lifted over a textile wall (calc/beamLift.ts): posts extended under them, hook points between a lifted
   *  beam and one that is not, and ends on a wall between its posts (T15). */
  beamLift?: { posts: number; hooks: number; walls?: number };
  /** Textile frames, on walls and on foot plates. */
  frames: FrameSpec[];
  /** 92LTX corner posts shared by two free-standing runs, each `H` long. */
  cornerPosts?: { qty: number; H: number };
  /** Støtteplater under the posts of system walls that stand free (calc/wallSupports.ts), and of drawn takdrager. */
  wallFeet?: number;
  /** Of `posts`, those standing on a støtteplate: picked without the adjustable foot (Bjørn 1.11.2026). */
  barePosts?: number;
  /** Plates (RAL) picked to swap into a stand wall the organiser builds: plate only, the wall is not in `modules`. */
  swaps?: string[];
  /** Shelves: boards, and brackets at a row's ends (91F) and between two boards (91FF), Byggeregel H2; in corners short
   *  91 and 01 rails (Byggeregler H10–H12). */
  shelves?: ShelfSpec;
}

/** A shelf board: standard 976 × 300, corner 960 × 300, narrow corner 960 × 290, 2/3 655 × 300 (Byggeregler H10–H12). */
export type BoardKind = 'standard' | 'corner' | 'narrow' | 'twoThirds';

export interface ShelfSpec {
  /** All boards, and by kind when any is not standard. */
  boards: number;
  kinds?: Partial<Record<BoardKind, number>>;
  end: number;
  twin: number;
  /** Short 91 under a lone corner shelf, in its rail. */
  short?: number;
  /** 01 rails by standard length, mm. */
  rails?: Record<number, number>;
}
