// How each element is built from parts. Only what Bjørn has confirmed (31.10.2026, two rounds); anything still unknown is
// reported by the engine as an open question instead of guessed. Numbers refer to docs/foga-system.md.

export interface WallRecipe {
  /** Post profile for every wall post (end, straight, corner, T, cross). Cut to the wall height without feet. */
  post: string;
  /** Feet per post: threaded insert + set screw, 50 mm from the floor, adjustable. */
  feet: { code: string; qty: number }[];
  /** Rails sit between two posts: length = cc − post width. */
  topRail: string;
  bottomRail: string;
  /** Coupling at each end of a top or bottom rail, into the post channel. */
  railCoupling: { code: string; perEnd: number };
  /** Plate per walled module, ordered per RAL. Size is the order size (lysåpning 960 × 2420 + channel). */
  plate: { code: string; w: number; h: number };
}

export interface FrameRecipe {
  /** Frame profile, cut mitred to outer size (2W + 2H). */
  profile: string;
  /** Corner coupling, one per corner (4 per frame). */
  corner: string;
  /** Upright cross brace profile, length H − 2 × frame profile. */
  brace: string;
  /** Coupling at each end of a brace. */
  braceCoupling: { code: string; perEnd: number };
  /** Brackets fixing the frame to the wall post (one side in 43TX, the other in 94). Supplied with screw and 503. */
  wallFixing: { code: string; perFrame: number };
}

export interface BeamRecipe {
  /** Takdrager profile; one piece per beam length (max 6 m, see rules.beam.max), cut between the posts. */
  profile: string;
  /** Couplings at each end into the post channel. 292 is 80 high: one in the top and one in the bottom chamber. */
  coupling: { code: string; perEnd: number };
}

/** Door module: Foga door (292 frame, lock 410) picked as one unit, with a header (overstykke) above it. */
export interface DoorRecipe {
  /** Door leaf height, gap below it to the post foot end and gap above it to the header, mm. */
  leaf: number;
  floorGap: number;
  topGap: number;
}

export interface Recipes {
  wall: WallRecipe;
  frame: FrameRecipe;
  beam: BeamRecipe;
  door: DoorRecipe;
}

export const RECIPES: Recipes = {
  wall: {
    post: '94',
    feet: [
      { code: '700', qty: 1 },
      { code: 'M10x65', qty: 1 },
    ],
    topRail: '92',
    bottomRail: '91',
    railCoupling: { code: '600', perEnd: 1 },
    plate: { code: 'HDF', w: 976, h: 2440 },
  },
  frame: { profile: '43TX', corner: '613', brace: '90', braceCoupling: { code: '600', perEnd: 1 }, wallFixing: { code: '520', perFrame: 2 } },
  beam: { profile: '292', coupling: { code: '600', perEnd: 2 } },
  door: { leaf: 2000, floorGap: 20, topGap: 10 },
};

/** Still open. The engine names these where they affect the stand. */
export const QUESTIONS = {
  beamPost: { no: 1, text: 'Stolper som bare bærer takdrager: lengde og fot' },
  frameJoint: { no: 2, text: 'Kobling mellom to tekstilrammer side om side' },
  curtain: { no: 3, text: 'Overstykke over forheng: samme som over dør?' },
} as const;

export type QuestionId = keyof typeof QUESTIONS;
