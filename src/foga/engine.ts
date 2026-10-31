// Foga engine: structure + recipes → parts list (deleliste), each line in a subgroup of the product grouping. Pure: no prices, no loose goods.
// Pre-assembled units (post with feet, rails and beams and textile braces with their couplings) are one piece each;
// loose profiles are counted per cut length; plates per RAL and size.
import { resolveGroup } from '../catalog/groups';
import { fogaPart } from './parts';
import type { Recipes } from './recipes';
import type { FogaStructure } from './structure';

export interface BomLine {
  /** Foga art.nr, or empty for a pre-assembled unit and for plates (not Foga). */
  artnr: string;
  name: string;
  /** What it is made of, or the cut lengths. */
  detail: string;
  qty: number;
  /** Stored pre-assembled, picked as one piece. */
  preassembled: boolean;
  /** Plates: RAL, so the UI can name the colour. */
  ral?: string;
  /** Loose profiles: total metres. */
  lm?: number;
  /** Subgroup id (groups.ts). */
  group: string;
}

export interface Bom {
  /** In tree order (groups.ts), then by size inside a subgroup. */
  lines: BomLine[];
}

/** Sizes the engine needs from the rules, mm. */
export interface BomSizes {
  /** Post length without feet (system wall height). */
  postLength: number;
  /** Module centre distance. */
  cc: number;
}

/** Subgroups (groups.ts) the Foga parts go under. */
export const BOM_GROUP = {
  posts: 'vegg.stolper',
  rails: 'vegg.skinner',
  beams: 'vegg.takdrager',
  plates: 'vegg.plater',
  /** Header (overstykke) over a door or curtain: its rails and plate. */
  header: 'vegg.dorer',
  textile: 'prof.tekstil',
} as const;

type BomGroup = (typeof BOM_GROUP)[keyof typeof BOM_GROUP];

/** Height a rail takes up in the wall: the long side of its section (92: 40, 91: 30). */
const railHeight = (code: string) => Math.max(...(fogaPart(code).section ?? [0]));

const mmList = (cuts: Map<number, number>) =>
  [...cuts]
    .sort(([a], [b]) => b - a)
    .map(([len, qty]) => `${qty} × ${len}`)
    .join(' · ') + ' mm';

export function bom(s: FogaStructure, r: Recipes, z: BomSizes): Bom {
  const lines = new Map<string, { line: BomLine; size: number }>();
  /** Add to a line, merged by key within its group. `size` (mm) orders lines in the group, largest first. */
  const put = (group: BomGroup, key: string, line: Omit<BomLine, 'qty' | 'group'>, qty: number, size = 0) => {
    if (qty <= 0) return;
    const l = lines.get(`${group}|${key}`);
    if (l) l.line.qty += qty;
    else lines.set(`${group}|${key}`, { line: { ...line, qty, group }, size });
  };
  const part = (group: BomGroup, code: string, qty: number) => {
    const p = fogaPart(code);
    put(group, code, { artnr: p.artnr, name: `${p.code} · ${p.name}`, detail: '', preassembled: false }, qty);
  };
  const withCouplings = (profile: string, lengthMm: number, coupling: string, n: number) =>
    `${profile} × ${lengthMm} mm · ${n} × ${coupling} (${fogaPart(coupling).artnr})`;
  /** A profile with couplings mounted in its ends, picked as one piece. */
  const unit = (group: BomGroup, name: string, profile: string, lengthMm: number, c: { code: string; perEnd: number }, qty: number, note = '') =>
    put(
      group,
      `${name}|${lengthMm}`,
      { artnr: '', name: `${name} ${profile}, ${lengthMm} mm, med ${c.code}`, detail: withCouplings(profile, lengthMm, c.code, 2 * c.perEnd) + note, preassembled: true },
      qty,
      group === BOM_GROUP.beams ? lengthMm : 0,
    );

  const postW = fogaPart(r.wall.post).section?.[0] ?? 0;
  const between = (centres: number) => centres - postW;
  const rail = between(z.cc);
  const plate = r.wall.plate;
  const railsH = railHeight(r.wall.topRail) + railHeight(r.wall.bottomRail);
  const plateExtra = plate.h - (z.postLength - railsH);
  const header = z.postLength - r.door.floorGap - r.door.leaf - r.door.topGap;
  const addPlate = (group: BomGroup, ral: string, h: number, note: string) =>
    put(group, `${ral}|${h}|${note}`, { artnr: '', name: fogaPart(plate.code).name, detail: `${plate.w} × ${h} mm${note}`, preassembled: false, ral }, 1, h);

  // Stolper: wall and takdrager alike, stored with the foot mounted
  put(
    BOM_GROUP.posts,
    'post',
    {
      artnr: '',
      name: `Stolpe ${r.wall.post} med justeringsfot`,
      detail: [`${r.wall.post} × ${z.postLength} mm`, ...r.wall.feet.map((f) => `${f.qty} × ${f.code} (${fogaPart(f.code).artnr})`)].join(' · '),
      preassembled: true,
    },
    s.posts,
  );

  // Skinner: top and bottom rail between the posts with a 600 in each end, for every module. An opening (door or
  // curtain) gets the same rails in its header (overstykke) with a lower plate; the header is listed with the doors.
  const walled = s.modules.filter((m) => !m.opening);
  const headers = s.modules.filter((m) => m.opening);
  for (const [group, n, note] of [[BOM_GROUP.rails, walled.length, ''], [BOM_GROUP.header, headers.length, ' · overstykke']] as const) {
    unit(group, 'Toppskinne', r.wall.topRail, rail, r.wall.railCoupling, n, note);
    unit(group, 'Bunnskinne', r.wall.bottomRail, rail, r.wall.railCoupling, n, note);
  }
  for (const m of walled) addPlate(BOM_GROUP.plates, m.plate, plate.h, '');
  for (const ral of s.swaps ?? []) addPlate(BOM_GROUP.plates, ral, plate.h, ' · platebytte i standvegg');
  for (const m of headers) addPlate(BOM_GROUP.header, m.plate, header - railsH + plateExtra, ' · overstykke');

  // Takdrager: 292 between the posts with two 600 in each end, one piece per length
  for (const b of s.beams) unit(BOM_GROUP.beams, 'Takdrager', r.beam.profile, between(b.lengthMm), r.beam.coupling, 1);

  // Tekstilvegger: 43TX cut mitred 2W + 2H (loose), 4 × 617, 2 × 520, and upright braces in 90 with a 600 in each
  // end, stored pre-assembled; the brace line names the frames it belongs to
  const frameCuts = new Map<number, number>();
  const braces = new Map<number, { qty: number; frames: string[] }>();
  for (const f of s.frames) {
    frameCuts.set(f.W, (frameCuts.get(f.W) ?? 0) + 2);
    frameCuts.set(f.H, (frameCuts.get(f.H) ?? 0) + 2);
    if (!f.braces) continue;
    const b = braces.get(f.braces.length) ?? { qty: 0, frames: [] };
    b.qty += f.braces.qty;
    b.frames.push(f.braces.qty > 1 ? `${f.pos} (${f.braces.qty})` : f.pos);
    braces.set(f.braces.length, b);
  }
  if (frameCuts.size) {
    const p = fogaPart(r.frame.profile);
    const pieces = [...frameCuts.values()].reduce((a, b) => a + b, 0);
    const lm = [...frameCuts].reduce((a, [len, qty]) => a + (len * qty) / 1000, 0);
    put(BOM_GROUP.textile, p.code, { artnr: p.artnr, name: `${p.code} · ${p.name}, gjæret`, detail: mmList(frameCuts), preassembled: false, lm }, pieces);
  }

  // Frittstående: top and bottom rail (spliced with 609 when long) and the uprights at free ends in 43TX, a 92LTX post per
  // corner, and at every support a foot plate with an upright brace above it
  const free = s.freeFrames ?? [];
  const freeCuts = new Map<number, number>();
  const addCut = (len: number, qty: number) => qty && freeCuts.set(len, (freeCuts.get(len) ?? 0) + qty);
  for (const f of free) {
    for (const c of f.railCuts) addCut(c, 2);
    addCut(f.H, f.uprights);
    const b = braces.get(f.braceLength) ?? { qty: 0, frames: [] };
    b.qty += f.supports;
    b.frames.push(f.supports > 1 ? `${f.pos} (${f.supports})` : f.pos);
    braces.set(f.braceLength, b);
  }
  if (freeCuts.size) {
    const p = fogaPart(r.freeFrame.profile);
    const pieces = [...freeCuts.values()].reduce((a, b) => a + b, 0);
    const lm = [...freeCuts].reduce((a, [len, qty]) => a + (len * qty) / 1000, 0);
    put(BOM_GROUP.textile, `${p.code}|fri`, { artnr: p.artnr, name: `${p.code} · ${p.name}, frittstående vegg`, detail: mmList(freeCuts), preassembled: false, lm }, pieces);
  }
  if (s.cornerPosts?.qty) {
    const p = fogaPart(r.freeFrame.cornerPost);
    put(BOM_GROUP.textile, p.code, { artnr: p.artnr, name: `${p.code} · ${p.name}`, detail: `${s.cornerPosts.qty} × ${s.cornerPosts.H} mm`, preassembled: false, lm: (s.cornerPosts.qty * s.cornerPosts.H) / 1000 }, s.cornerPosts.qty);
  }

  for (const [len, b] of braces) unit(BOM_GROUP.textile, 'Støttestag', r.frame.brace, len, r.frame.braceCoupling, b.qty, ` · til ${b.frames.join(', ')}`);
  // Corner connectors: four per InFrame frame; top and bottom at a free end and into a corner post (same part, 617)
  part(BOM_GROUP.textile, r.frame.corner, 4 * s.frames.length);
  part(BOM_GROUP.textile, r.freeFrame.corner, 2 * free.reduce((a, f) => a + f.uprights + f.corners, 0));
  part(BOM_GROUP.textile, r.freeFrame.splice, 2 * free.reduce((a, f) => a + f.railCuts.length - 1, 0));
  part(BOM_GROUP.textile, r.frame.wallFixing.code, r.frame.wallFixing.perFrame * s.frames.length);
  for (const code of new Set(free.map((f) => f.foot))) part(BOM_GROUP.textile, code, free.filter((f) => f.foot === code).reduce((a, f) => a + f.supports, 0));

  // Tree order; inside a subgroup beams longest first, plates tallest first then by RAL, the rest as added
  const order = (l: BomLine) => resolveGroup(l.group).order;
  return {
    lines: [...lines.values()]
      .sort((a, b) => order(a.line) - order(b.line) || b.size - a.size || (a.line.ral ?? '').localeCompare(b.line.ral ?? ''))
      .map((e) => e.line),
  };
}
