// Foga engine: structure + recipes → parts list (deleliste). Pure: no prices, no loose goods.
// Pre-assembled units (post with feet) as pieces, profiles per cut length, couplings as counts, plates per RAL and size.
import { fogaPart, type FogaPart } from './parts';
import type { Recipes } from './recipes';
import type { FogaStructure } from './structure';

export interface Cut {
  lengthMm: number;
  qty: number;
}

export interface ProfileLine {
  part: FogaPart;
  /** Longest first. */
  cuts: Cut[];
  /** Total metres. */
  lm: number;
}

export interface PartLine {
  part: FogaPart;
  qty: number;
}

export interface PlateLine {
  part: FogaPart;
  ral: string;
  /** Order size, mm. */
  w: number;
  h: number;
  qty: number;
}

/** Stored pre-assembled and picked as one piece, e.g. post 94 with its adjustable foot. */
export interface UnitLine {
  name: string;
  /** What the unit is made of, for reference. */
  contains: string;
  qty: number;
}

export interface Bom {
  units: UnitLine[];
  profiles: ProfileLine[];
  parts: PartLine[];
  plates: PlateLine[];
}

/** Sizes the engine needs from the rules, mm. */
export interface BomSizes {
  /** Post length without feet (system wall height). */
  postLength: number;
  /** Module centre distance. */
  cc: number;
}

/** Height a rail takes up in the wall: the long side of its section (92: 40, 91: 30). */
const railHeight = (code: string) => Math.max(...(fogaPart(code).section ?? [0]));

export function bom(s: FogaStructure, r: Recipes, z: BomSizes): Bom {
  const cuts = new Map<string, Map<number, number>>();
  const counts = new Map<string, number>();
  const plates = new Map<string, number>();

  const cut = (code: string, lengthMm: number, qty: number) => {
    if (qty <= 0 || lengthMm <= 0) return;
    const m = cuts.get(code) ?? new Map<number, number>();
    m.set(lengthMm, (m.get(lengthMm) ?? 0) + qty);
    cuts.set(code, m);
  };
  const add = (code: string, qty: number) => {
    if (qty > 0) counts.set(code, (counts.get(code) ?? 0) + qty);
  };

  const postW = fogaPart(r.wall.post).section?.[0] ?? 0;
  const between = (centres: number) => centres - postW;
  const plate = r.wall.plate;
  const wallClear = z.postLength - railHeight(r.wall.topRail) - railHeight(r.wall.bottomRail);
  const plateExtra = plate.h - wallClear;
  const rails = (n: number) => {
    cut(r.wall.topRail, between(z.cc), n);
    cut(r.wall.bottomRail, between(z.cc), n);
    add(r.wall.railCoupling.code, n * 2 * 2 * r.wall.railCoupling.perEnd);
  };
  const addPlate = (ral: string, h: number) => {
    const k = `${ral}|${h}`;
    plates.set(k, (plates.get(k) ?? 0) + 1);
  };

  // Posts (wall and takdrager alike): stored with the foot mounted, picked as one piece
  const units: UnitLine[] = [];
  if (s.posts > 0)
    units.push({
      name: `Stolpe ${r.wall.post} med justeringsfot`,
      contains: [`${r.wall.post} × ${z.postLength} mm`, ...r.wall.feet.map((f) => `${f.qty} × ${f.code} (${fogaPart(f.code).artnr})`)].join(' · '),
      qty: s.posts,
    });

  // Wall modules: top and bottom rail between the posts (one 600 per end), one plate
  const walled = s.modules.filter((m) => !m.opening);
  rails(walled.length);
  for (const m of walled) addPlate(m.plate, plate.h);

  // Openings (door or curtain): a header above = a small wall with its own rails and plate.
  // The Foga door itself is picked as a unit (loose goods)
  const header = z.postLength - r.door.floorGap - r.door.leaf - r.door.topGap;
  const openings = s.modules.filter((m) => m.opening);
  rails(openings.length);
  for (const m of openings) addPlate(m.plate, header - railHeight(r.wall.topRail) - railHeight(r.wall.bottomRail) + plateExtra);

  // Takdrager: 292 between the posts, two 600 per end
  for (const b of s.beams) cut(r.beam.profile, between(b.lengthMm), 1);
  add(r.beam.coupling.code, s.beams.length * 2 * r.beam.coupling.perEnd);

  // Textile frames: 2W + 2H mitred, 4 × 613, upright braces in 90 with a 600 in each end, 2 × 520 to the wall
  for (const f of s.frames) {
    cut(r.frame.profile, f.W, 2);
    cut(r.frame.profile, f.H, 2);
    add(r.frame.corner, 4);
    add(r.frame.wallFixing.code, r.frame.wallFixing.perFrame);
    if (f.braces) {
      cut(r.frame.brace, f.braces.length, f.braces.qty);
      add(r.frame.braceCoupling.code, f.braces.qty * 2 * r.frame.braceCoupling.perEnd);
    }
  }

  const profiles: ProfileLine[] = [...cuts].map(([code, m]) => {
    const list = [...m].map(([lengthMm, qty]) => ({ lengthMm, qty })).sort((a, b) => b.lengthMm - a.lengthMm);
    return { part: fogaPart(code), cuts: list, lm: list.reduce((a, c) => a + (c.lengthMm * c.qty) / 1000, 0) };
  });
  const parts: PartLine[] = [...counts].map(([code, qty]) => ({ part: fogaPart(code), qty }));
  const platePart = fogaPart(plate.code);
  const plateLines = [...plates]
    .map(([k, qty]) => {
      const [ral, h] = k.split('|');
      return { part: platePart, ral, w: plate.w, h: Number(h), qty };
    })
    .sort((a, b) => b.h - a.h || a.ral.localeCompare(b.ral));
  return { units, profiles, parts, plates: plateLines };
}
