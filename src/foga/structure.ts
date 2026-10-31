// What is to be built, in Foga terms and mm. Neutral: no plan geometry, no prices, no loose goods.
// fromVariant.ts derives it from the stand sketch; the engine turns it into a parts list.

/** One wall module between two posts (cc 1000). */
export interface ModuleSpec {
  /** RAL of the plate (the header plate above an opening). */
  plate: string;
  /** A door or curtain: the module gets a header instead of a full wall. */
  opening: boolean;
}

/** One length of takdrager, post centre to post centre. */
export interface BeamSpec {
  lengthMm: number;
}

/** One textile frame (InFrame). Sizes as produced, mm. */
export interface FrameSpec {
  /** Production position, T1, T2 … */
  pos: string;
  W: number;
  H: number;
  braces: { qty: number; length: number } | null;
}

export interface FogaStructure {
  /** Posts: every wall point and every point a takdrager needs. All are the same post (94 with foot). */
  posts: number;
  modules: ModuleSpec[];
  beams: BeamSpec[];
  frames: FrameSpec[];
  /** Plates (RAL) picked to swap into a stand wall the organiser builds: plate only, the wall is not in `modules`. */
  swaps?: string[];
}
