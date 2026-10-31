// How each element is built from parts. Only what Bjørn has confirmed (31.10.2026); anything still unknown is
// reported by the engine as an open question instead of guessed. Numbers refer to docs/foga-system.md.

export interface WallRecipe {
  /** Post profile for every wall post (end, straight, corner, T, cross). Cut to the wall height without feet. */
  post: string;
  /** Feet per post: threaded insert + set screw, 50 mm from the floor, adjustable. */
  feet: { code: string; qty: number }[];
  /** Rails sit between two posts: length = cc − post width. */
  topRail: string;
  bottomRail: string;
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
}

export interface BeamRecipe {
  /** Takdrager profile; one piece per beam length (max 6 m, see rules.beam.max). */
  profile: string;
}

export interface Recipes {
  wall: WallRecipe;
  frame: FrameRecipe;
  beam: BeamRecipe;
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
    plate: { code: 'HDF', w: 976, h: 2440 },
  },
  frame: { profile: '43TX', corner: '613', brace: '90' },
  beam: { profile: '292' },
};

/** Still open. The engine names these where they affect the stand. */
export const QUESTIONS = {
  railCoupling: { no: 1, text: 'Kobling mellom skinne (92/91) og stolpe 94, antall per ende' },
  beamMount: { no: 2, text: 'Feste av takdrager 292 til stolpe 94, og lengde på stolper som bare bærer takdrager' },
  braceCoupling: { no: 3, text: 'Kobling i hver ende av tverrstaget (profil 90)' },
  frameFixing: { no: 4, text: 'Antall 520-braketter per tekstilramme' },
  frameJoint: { no: 5, text: 'Kobling mellom to tekstilrammer side om side' },
  header: { no: 6, text: 'Overstykke: platemål, og om forheng har samme overstykke' },
} as const;

export type QuestionId = keyof typeof QUESTIONS;
