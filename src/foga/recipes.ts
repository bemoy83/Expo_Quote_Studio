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

/** Foot plate, size along and across the wall it holds, mm. */
export interface FootPlate {
  code: string;
  along: number;
  across: number;
}

/**
 * Textile frame (43TX), one product whatever it is mounted on (Bjørn 7.11.2026): the frame is the same, only the
 * mounting differs, on a system wall with 520 or free-standing on foot plates. A later mounting (a cube) or a deeper
 * frame for LED is a new mounting or a new recipe of the same shape. Byggeregler X1–X8 (docs/byggeregler.md).
 */
export interface TextileFrameRecipe {
  /** Frame profile: top and bottom rail, the sides on a wall, the uprights at free ends on foot plates. Cut mitred. */
  profile: string;
  /** In-channel connector in every frame corner, and where a rail meets a corner post (4 per frame on a wall). */
  corner: string;
  /** Joins a top or bottom rail in its length (Bjørn 7.11.2026). `thread`: one per rail and splice (609), the profile
   *  threaded onto it, so it needs room at a free end. `slide`: `perRail` in the channel (604), slid along from the
   *  splice, so it fits a frame held at both ends (a span between walls, corner posts). */
  splice: { thread: string; slide: { code: string; perRail: number } };
  /** Longest top or bottom rail before it is spliced in its length (the frame stays one rectangle), mm. */
  maxRail: number;
  /** Upright brace, length H − 2 × frame profile, and its couplings: at most `rules.textile.inFrame.stag` mm apart (the
   *  textile pulls most in the middle), and one `spliceBrace` mm from each side of a splice, as a frame side while long
   *  motifs go up in sections (Bjørn 7.11.2026: 100–200 mm). Not at the feet. Stored mounted, brace + couplings. */
  brace: string;
  spliceBrace: number;
  braceCoupling: { code: string; perEnd: number };
  /** On a system wall: brackets fixing the frame to the wall post (one side in 43TX, the other in 94). Supplied with
   *  screw and 503. */
  wall: { fixing: { code: string; perFrame: number } };
  /** Free-standing on foot plates, textile on both faces (Bjørn 31.10.2026). */
  feet: {
    /** Shared upright where two runs meet at a right angle. It replaces both runs' uprights there, and is a support
     *  in both runs like a foot. */
    cornerPost: string;
    /** End cap under and over the corner post (876 900 92), mm thick: the post is cut this much shorter at each end.
     *  The caps are not picked (Bjørn 6.11.2026). */
    cornerPostCap: number;
    /** Foot plate under the frame, one per support. `smallFoot` on a frame shorter than `support.minFrom`. */
    foot: FootPlate;
    smallFoot: FootPlate;
    /** Feet: evenly spread, at least `min` supports (corner posts count) from `minFrom` mm and up, else one; the outer
     *  foot at most `maxEnd` in from a free end; supports at most `maxGap` apart, mm. */
    support: SupportRule;
  };
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
  /** Hook a beam end hangs on another beam or a wall's top rail 92 with (Bjørn 10.11.2026, calc/beams/beamHooks.ts): `profile`
   *  set as a T over the beam or rail, a `top` mm piece lying on it fixed with `screw` into a `nut` in its top channel,
   *  and a `leg` mm piece down its side per side a beam hangs from, its channel taking that beam's couplings. Picked
   *  whole, screw and nut mounted; no art.nr. and no cost of its own. */
  hook: { profile: string; top: number; leg: number; screw: string; nut: string };
  /** Lifting a beam over a textile wall (Bjørn 6.11.2026, calc/beams/beamLift.ts): a piece of `profile` `length` mm on top of
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

/**
 * Shelf (hylle 6311), Byggeregler H1–H3 (docs/byggeregler.md): a board in one wall module on two brackets in the face
 * channels of its posts. The bracket at the end of a row is `end` (one flange), between two boards at the same height
 * `twin` (flanges both sides, carries both). Each bracket is cut `bracket` mm and fixed with `coupling` into the post.
 * The board is not Foga (bought elsewhere), mm.
 */
export interface ShelfRecipe {
  end: string;
  twin: string;
  bracket: number;
  coupling: { code: string; perBracket: number };
  board: { code: string; w: number; d: number; t: number };
  /** In an inner corner (Byggeregler H9–H12): the post's face channel there is taken by the other wall, so the corner
   *  end rests on `rail` (01) hung on the other wall's face with `hook` over its top rail. Alone: a `short` piece of
   *  `bracket` (91) in the rail, `single` mm out from the corner post's face to the rail's centre, under a `corner`
   *  board. Two shelves meeting: a twin (91FF) in the rail at the corner board's front edge (`play` between), the
   *  corner board on the wall drawn first, `twoThirds` on the other. `narrow` where the other wall's rail passes behind
   *  the board. `behind`: the board's back lies this far behind the post's face (H1, into its inner corner). The
   *  twin's flange top is `flange` above the bottom of its `body`. mm. */
  corner: {
    rail: string;
    hook: string;
    bracket: string;
    short: number;
    single: number;
    play: number;
    behind: number;
    flange: number;
    body: number;
    boards: Record<'corner' | 'narrow' | 'twoThirds', { name: string; w: number; d: number }>;
  };
}

/**
 * Counter (bardisk 6560), Byggeregler K1–K5 (docs/byggeregler.md): a box of Foga profiles with plates in its channels,
 * closed on the front and both ends, open at the back where the staff stand. `post` in every corner, full height, its
 * closed faces outward. `rail` all round at `middle` and `top` (bottom of the rail, mm from the floor), `bottomRail` on
 * the floor on the closed sides only. Rails sit between the posts: side − 2 × post. `coupling` in each rail end. `plate`
 * is the wall plate (V5) in the channels, split at the middle rail; `board` lies in the rail's notch, the top and
 * a shelf on the middle rail. The counter is one box of one size now; a brush
 * that draws counters of any length and with corners is a later step (K1), with the joints it needs. mm.
 */
export interface CounterRecipe {
  /** The profile standing in a node, by the directions it joins (K8): two at a right angle, three, four. */
  nodes: { corner: string; tee: string; cross: string };
  rail: string;
  /** A rail inside the counter, between two parts: a 94, carrying a top and a shelf on both sides, no plate (K8). Its
   *  section across, mm. */
  innerRail: { code: string; size: number };
  /** Nodes c/c along a run: whole metres, and a half to make up the length (K7), mm. */
  module: { whole: number; half: number };
  /** From a node to the outer face where it joins nothing, and to the end of a rail it joins (K8), mm: outer size is
   *  c/c + 2 × face, a rail c/c − 2 × joint, whatever profile stands in the node. */
  face: number;
  joint: number;
  bottomRail: string;
  coupling: { code: string; perEnd: number };
  plate: string;
  board: { code: string; t: number };
  height: number;
  /** Post section (92L), rail height (93 and 92) and the rail's depth into the box (93 is 30, 92 is 20), mm. */
  postSize: number;
  railHeight: number;
  bottomRailDepth: number;
  middle: number;
  top: number;
  /** Channel: its centre in from the outer face and its depth. A plate (`plateThickness`) goes to the channel's bottom,
   *  `platePlay` shorter in all along and at its top end. A board lies in the notch, as deep as a channel, so its top
   *  is the notch less its thickness under the rail's top, and stops `boardPlay` short of the rail's body. */
  channel: { inset: number; depth: number };
  plateThickness: number;
  platePlay: number;
  boardPlay: number;
  /** The counter in stock (6560): ready built, picked as one piece (K1). Outer size, mm, and the colour of its plates
   *  (K6): another wall colour means its plates are swapped. */
  stock: { length: number; depth: number; ral: string };
}

export interface Recipes {
  wall: WallRecipe;
  textileFrame: TextileFrameRecipe;
  beam: BeamRecipe;
  door: DoorRecipe;
  shelf: ShelfRecipe;
  counter: CounterRecipe;
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
  textileFrame: {
    profile: '43TX',
    corner: '617',
    splice: { thread: '609', slide: { code: '604', perRail: 2 } },
    maxRail: 5000,
    brace: '90',
    spliceBrace: 150,
    braceCoupling: { code: '600', perEnd: 1 },
    wall: { fixing: { code: '520', perFrame: 2 } },
    feet: {
      cornerPost: '92LTX',
      cornerPostCap: 7,
      foot: { code: '740', along: 400, across: 400 },
      smallFoot: { code: '730', along: 250, across: 300 },
      support: SUPPORT,
    },
  },
  beam: { profile: '292', coupling: { code: '600', perEnd: 2 }, hook: { profile: '01', top: 20, leg: 80, screw: 'M5 maskinskrue', nut: '503' }, lift: { profile: '94', length: 80, post: '609', hook: '600' } },
  door: { leaf: 2000, floorGap: 20, topGap: 10, curtainBottomRail: '92', frame: '292', hinge: { code: '403', fromEnd: 150 }, lock: { code: '410', height: 1000 } },
  // Bjørn 8.11.2026: 91F at the ends, 91FF between, 290 mm, one 600 into the post; board 18 × 300 × 976 into the post's inner corner
  shelf: { end: '91F', twin: '91FF', bracket: 290, coupling: { code: '600', perBracket: 1 }, board: { code: 'HYLLEPLATE', w: 976, d: 300, t: 18 },
    // Bjørn 10.11.2026 (STL «enkel hylle» and «hjørnehyller» in a system corner): 01 with 01-kanal-krok, 91 × 80 or
    // 91FF; boards 960 × 300 («hjørne hylleplate»), 960 × 290 where the other rail passes behind, 655 × 300 («2/3»)
    corner: {
      rail: '01',
      hook: '01-kanal-krok',
      bracket: '91',
      short: 80,
      single: 200,
      play: 1,
      behind: 10,
      flange: 10.5,
      body: 30,
      boards: {
        corner: { name: 'Hjørne hylleplate', w: 960, d: 300 },
        narrow: { name: 'Hjørne hylleplate, smal', w: 960, d: 290 },
        twoThirds: { name: '2/3 hylleplate', w: 655, d: 300 },
      },
    },
  },
  // Bjørn 11.11.2026 (STL «6560 barinformasjonsdisk»): 92L corners, 93 top and middle, 92 at the bottom, 600 in the
  // rail ends, wall plate 3 mm, Fibraplast 6 mm top and shelf, straight on the floor (no feet)
  counter: {
    nodes: { corner: '92L', tee: '93', cross: '94' },
    rail: '93',
    innerRail: { code: '94', size: 40 },
    module: { whole: 1000, half: 500 },
    face: 10,
    joint: 20,
    bottomRail: '92',
    coupling: { code: '600', perEnd: 1 },
    plate: 'HDF',
    board: { code: 'FIBRAPLAST6', t: 6 },
    height: 1040,
    postSize: 30,
    railHeight: 40,
    bottomRailDepth: 20,
    middle: 750,
    top: 1000,
    channel: { inset: 10, depth: 10 },
    plateThickness: 3,
    platePlay: 4,
    boardPlay: 2,
    stock: { length: 1020, depth: 520, ral: '9010' },
  },
};
