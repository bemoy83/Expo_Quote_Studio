// How each element is built from parts, as confirmed by Bjørn 31.10.2026. Background and sources: docs/foga-system.md.

export interface WallRecipe {
  /** Post profile for every wall post (end, straight, corner, T, cross). Cut to the wall height without feet. */
  post: string;
  /** Feet per post: threaded insert + set screw, 50 mm from the floor, adjustable. Stored mounted: the post with feet is picked as one piece. */
  feet: { code: string; qty: number }[];
  /** Rails sit between two posts: length = cc − post width. */
  topRail: string;
  bottomRail: string;
  /** Coupling at each end of a top or bottom rail, into the post channel. Stored mounted: rail + couplings is one piece. */
  railCoupling: { code: string; perEnd: number };
  /** Plate per walled module, ordered per RAL. Size is the order size (lysåpning 960 × 2420 + channel). */
  plate: { code: string; w: number; h: number };
  /** Støtteplate under a post of a wall that stands free (no takdrager frame), across the wall, by the same rule as
   *  the free-standing textile wall (Bjørn 1.11.2026). calc/wallSupports.ts. `pin` is mounted on the plate (M8) and
   *  threads into the post's centre channel: stored mounted, plate + pin is one piece. */
  support: { foot: FootPlate; pin: string; rule: SupportRule };
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

/** Foot plate, size along and across the wall it holds, mm. */
export interface FootPlate {
  code: string;
  along: number;
  across: number;
}

/** Frittstående tekstilvegg: a 43TX frame on foot plates, textile on both faces (Bjørn 31.10.2026). */
export interface FreeFrameRecipe {
  /** Frame profile: top and bottom rail, and the upright at a free end. */
  profile: string;
  /** In-channel connector in every frame corner, and where a rail meets the corner post. */
  corner: string;
  /** Shared upright where two runs meet at a right angle. It replaces both runs' 43TX uprights there, and is a
   *  support in both runs like a foot. */
  cornerPost: string;
  /** Joins a top or bottom rail in its length, one per splice. */
  splice: string;
  /** Upright brace and its couplings, one at every foot. */
  brace: string;
  braceCoupling: { code: string; perEnd: number };
  /** Foot plate under the frame, one per support, size along and across the run in mm. `smallFoot` on a frame
   *  shorter than `support.minFrom`. */
  foot: FootPlate;
  smallFoot: FootPlate;
  /** Longest top or bottom rail before it is spliced in its length (the frame stays one rectangle), mm. */
  maxRail: number;
  /** Feet and braces: evenly spread, at least `min` supports (corner posts count) from `minFrom` mm and up, else
   *  one; the outer foot at most `maxEnd` in from a free end; supports at most `maxGap` apart, mm. */
  support: SupportRule;
}

/** Evenly spread supports: at least `min` (supported ends count) from `minFrom` mm and up, else one; the outer one at
 *  most `maxEnd` in from a free end; at most `maxGap` apart, mm. */
export interface SupportRule {
  min: number;
  minFrom: number;
  maxEnd: number;
  maxGap: number;
}

export interface BeamRecipe {
  /** Takdrager profile; one piece per beam length (max 6 m, see rules.beam.max), cut between the posts. */
  profile: string;
  /** Couplings at each end into the post channel. 292 is 80 high: one in the top and one in the bottom chamber.
   *  Stored mounted: each beam length + its couplings is one piece. */
  coupling: { code: string; perEnd: number };
}

/** Opening module (door or curtain): above it a header (overstykke). The Foga door (292 frame, lock 410) is picked as one unit. */
export interface DoorRecipe {
  /** Door leaf height, gap below it to the post foot end and gap above it to the header, mm. */
  leaf: number;
  floorGap: number;
  topGap: number;
}

export interface Recipes {
  wall: WallRecipe;
  frame: FrameRecipe;
  freeFrame: FreeFrameRecipe;
  beam: BeamRecipe;
  door: DoorRecipe;
}

/** Same rule for a free-standing textile wall and a system wall that stands free (Bjørn 1.11.2026). */
const SUPPORT: SupportRule = { min: 2, minFrom: 1000, maxEnd: 1000, maxGap: 3000 };

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
    support: { foot: { code: '750', along: 80, across: 500 }, pin: '795', rule: SUPPORT },
  },
  frame: { profile: '43TX', corner: '617', brace: '90', braceCoupling: { code: '600', perEnd: 1 }, wallFixing: { code: '520', perFrame: 2 } },
  freeFrame: {
    profile: '43TX',
    corner: '617',
    cornerPost: '92LTX',
    splice: '609',
    brace: '90',
    braceCoupling: { code: '600', perEnd: 1 },
    foot: { code: '740', along: 400, across: 400 },
    smallFoot: { code: '730', along: 250, across: 300 },
    maxRail: 5000,
    support: SUPPORT,
  },
  beam: { profile: '292', coupling: { code: '600', perEnd: 2 } },
  door: { leaf: 2000, floorGap: 20, topGap: 10 },
};
