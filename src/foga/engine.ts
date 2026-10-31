// Foga engine: structure + recipes → parts list (deleliste). Pure: no prices, no loose goods.
// Pre-assembled units (post with feet, rails and beams with couplings) as pieces, profiles per cut length, couplings as counts, plates per RAL and size.
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

/** Stored pre-assembled and picked as one piece: post 94 with foot, rails 92/91 and takdrager 292 with their 600s. */
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
  // Pre-assembled units, merged by name: rails and beams are stored with their couplings mounted
  const unitMap = new Map<string, UnitLine>();
  const unit = (name: string, contains: string, qty: number) => {
    if (qty <= 0) return;
    const u = unitMap.get(name);
    if (u) u.qty += qty;
    else unitMap.set(name, { name, contains, qty });
  };
  const withCouplings = (profile: string, lengthMm: number, coupling: string, n: number) =>
    `${profile} × ${lengthMm} mm · ${n} × ${coupling} (${fogaPart(coupling).artnr})`;
  const railUnit = (profile: string, role: string, n: number) => {
    const len = between(z.cc);
    const c = r.wall.railCoupling;
    unit(`${role} ${profile}, ${len} mm, med ${c.code}`, withCouplings(profile, len, c.code, 2 * c.perEnd), n);
  };
  const rails = (n: number) => {
    railUnit(r.wall.topRail, 'Toppskinne', n);
    railUnit(r.wall.bottomRail, 'Bunnskinne', n);
  };
  const addPlate = (ral: string, h: number) => {
    const k = `${ral}|${h}`;
    plates.set(k, (plates.get(k) ?? 0) + 1);
  };

  // Posts (wall and takdrager alike): stored with the foot mounted, picked as one piece
  unit(
    `Stolpe ${r.wall.post} med justeringsfot`,
    [`${r.wall.post} × ${z.postLength} mm`, ...r.wall.feet.map((f) => `${f.qty} × ${f.code} (${fogaPart(f.code).artnr})`)].join(' · '),
    s.posts,
  );

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

  // Takdrager: 292 between the posts, stored with two 600 mounted in each end, one unit per length
  for (const b of s.beams) {
    const len = between(b.lengthMm);
    const c = r.beam.coupling;
    unit(`Takdrager ${r.beam.profile}, ${len} mm, med ${c.code}`, withCouplings(r.beam.profile, len, c.code, 2 * c.perEnd), 1);
  }

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
  const units = [...unitMap.values()];
  return { units, profiles, parts, plates: plateLines };
}
