// What is to be built, in Foga terms and mm. Neutral: no plan geometry, no prices, no loose goods.
// fromVariant.ts derives it from the stand sketch; the engine turns it into a parts list.

/** A post at a grid point. Every post is profile 94, whatever meets there; `beamOnly` posts carry a takdrager only. */
export interface PostSpec {
  key: string;
  beamOnly: boolean;
}

/** One wall module between two posts (cc 1000). */
export interface ModuleSpec {
  key: string;
  /** RAL of the plate, or null for an opening. */
  plate: string | null;
  /** Art.nr of the door or curtain in the module, if any. */
  opening: string | null;
}

/** One length of takdrager. */
export interface BeamSpec {
  lengthMm: number;
}

/** One textile frame (InFrame). Sizes as produced, mm. */
export interface FrameSpec {
  pos: string;
  W: number;
  H: number;
  braces: { qty: number; length: number } | null;
  /** The next frame on the same wall face starts where this one ends, so the two are joined. */
  joinedToNext: boolean;
}

export interface FogaStructure {
  posts: PostSpec[];
  modules: ModuleSpec[];
  beams: BeamSpec[];
  frames: FrameSpec[];
}
