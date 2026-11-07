// How each element is built from parts, as confirmed by Bjørn 31.10.2026. Background and sources: docs/foga-system.md.
// Byggeregler D1, D5 (docs/byggeregler.md).

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
  /** End cap under and over the corner post (876 900 92), mm thick: the post is cut this much shorter at each end.
   *  The caps are not picked (Bjørn 6.11.2026). */
  cornerPostCap: number;
  /** Joins a top or bottom rail in its length (Bjørn 7.11.2026). `thread`: one per rail and splice (609), the profile
   *  threaded onto it, so it needs room at a free end. `slide`: `perRail` in the channel (604), slid along from the
   *  splice, so it fits a frame held at both ends (a span between walls, corner posts). */
  splice: { thread: string; slide: { code: string; perRail: number } };
  /** Upright brace and its couplings: at every foot, at most `maxBrace` mm apart (the textile pulls most in the middle),
   *  and one `spliceBrace` mm from each side of a splice, as a frame side while long motifs go up in sections (Bjørn
   *  7.11.2026: 100–200 mm). */
  brace: string;
  maxBrace: number;
  spliceBrace: number;
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
  /** A drawn (innvendig) beam's end hanging on another beam (Bjørn 1.11.2026), one per end. Placeholder part. */
  hook: string;
  /** Lifting a beam over a textile wall (Bjørn 6.11.2026, calc/beamLift.ts): a piece of `profile` `length` mm on top of
   *  every post the lifted beam rests on, with `post` down into the post, and at a hook point between a lifted beam and
   *  one that is not, the same piece with `hook` into the other beam. */
  lift: { profile: string; length: number; post: string; hook: string };
}

/** Opening module (door or curtain): above it a header (overstykke). The Foga door (292 frame, lock 410) is picked as one unit. */
export interface DoorRecipe {
  /** Door leaf height, gap below it to the post foot end and gap above it to the header, mm. */
  leaf: number;
  floorGap: number;
  topGap: number;
  /** Header bottom rail over a curtain: 92 instead of 91, its channel holds the curtain glider (Byggeregel D2). */
  curtainBottomRail: string;
  /** The leaf as drawn in 3D (Byggeregel D5): 292 frame (stiles full height, rails between), hinges 403 a little in
   *  from top and bottom, lock 410 at handle height, mm. */
  frame: string;
  hinge: { code: string; fromEnd: number };
  lock: { code: string; height: number };
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
    cornerPostCap: 7,
    splice: { thread: '609', slide: { code: '604', perRail: 2 } },
    brace: '90',
    maxBrace: 2000,
    spliceBrace: 150,
    braceCoupling: { code: '600', perEnd: 1 },
    foot: { code: '740', along: 400, across: 400 },
    smallFoot: { code: '730', along: 250, across: 300 },
    maxRail: 5000,
    support: SUPPORT,
  },
  beam: { profile: '292', coupling: { code: '600', perEnd: 2 }, hook: 'KROK', lift: { profile: '94', length: 80, post: '609', hook: '600' } },
  door: { leaf: 2000, floorGap: 20, topGap: 10, curtainBottomRail: '92', frame: '292', hinge: { code: '403', fromEnd: 150 }, lock: { code: '410', height: 1000 } },
};
