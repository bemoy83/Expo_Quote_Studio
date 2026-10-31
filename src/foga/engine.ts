// Foga engine: structure + recipes → parts list (deleliste), grouped by product type. Pure: no prices, no loose goods.
// Pre-assembled units (post with feet, rails and beams and textile braces with their couplings) are one piece each;
// loose profiles are counted per cut length; plates per RAL and size.
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
}

export type BomGroupId = 'posts' | 'rails' | 'beams' | 'textile' | 'plates';

export interface BomGroup {
  id: BomGroupId;
  name: string;
  lines: BomLine[];
}

export interface Bom {
  /** In picking order; empty groups left out. */
  groups: BomGroup[];
}

/** Sizes the engine needs from the rules, mm. */
export interface BomSizes {
  /** Post length without feet (system wall height). */
  postLength: number;
  /** Module centre distance. */
  cc: number;
}

const GROUPS: { id: BomGroupId; name: string }[] = [
  { id: 'posts', name: 'Stolper' },
  { id: 'rails', name: 'Skinner' },
  { id: 'beams', name: 'Takdrager' },
  { id: 'textile', name: 'Tekstilvegger' },
  { id: 'plates', name: 'Veggplater' },
];

/** Height a rail takes up in the wall: the long side of its section (92: 40, 91: 30). */
const railHeight = (code: string) => Math.max(...(fogaPart(code).section ?? [0]));

const mmList = (cuts: Map<number, number>) =>
  [...cuts]
    .sort(([a], [b]) => b - a)
    .map(([len, qty]) => `${qty} × ${len}`)
    .join(' · ') + ' mm';

export function bom(s: FogaStructure, r: Recipes, z: BomSizes): Bom {
  const lines = new Map<BomGroupId, Map<string, { line: BomLine; size: number }>>(GROUPS.map((g) => [g.id, new Map()]));
  /** Add to a line, merged by key within its group. `size` (mm) orders lines in the group, largest first. */
  const put = (group: BomGroupId, key: string, line: Omit<BomLine, 'qty'>, qty: number, size = 0) => {
    if (qty <= 0) return;
    const g = lines.get(group)!;
    const l = g.get(key);
    if (l) l.line.qty += qty;
    else g.set(key, { line: { ...line, qty }, size });
  };
  const part = (group: BomGroupId, code: string, qty: number) => {
    const p = fogaPart(code);
    put(group, code, { artnr: p.artnr, name: `${p.code} · ${p.name}`, detail: '', preassembled: false }, qty);
  };
  const withCouplings = (profile: string, lengthMm: number, coupling: string, n: number) =>
    `${profile} × ${lengthMm} mm · ${n} × ${coupling} (${fogaPart(coupling).artnr})`;
  /** A profile with couplings mounted in its ends, picked as one piece. */
  const unit = (group: BomGroupId, name: string, profile: string, lengthMm: number, c: { code: string; perEnd: number }, qty: number, note = '') =>
    put(
      group,
      `${name}|${lengthMm}`,
      { artnr: '', name: `${name} ${profile}, ${lengthMm} mm, med ${c.code}`, detail: withCouplings(profile, lengthMm, c.code, 2 * c.perEnd) + note, preassembled: true },
      qty,
      group === 'beams' ? lengthMm : 0,
    );

  const postW = fogaPart(r.wall.post).section?.[0] ?? 0;
  const between = (centres: number) => centres - postW;
  const rail = between(z.cc);
  const plate = r.wall.plate;
  const railsH = railHeight(r.wall.topRail) + railHeight(r.wall.bottomRail);
  const plateExtra = plate.h - (z.postLength - railsH);
  const header = z.postLength - r.door.floorGap - r.door.leaf - r.door.topGap;
  const addPlate = (ral: string, h: number, note: string) =>
    put('plates', `${ral}|${h}`, { artnr: '', name: fogaPart(plate.code).name, detail: `${plate.w} × ${h} mm${note}`, preassembled: false, ral }, 1, h);

  // Stolper: wall and takdrager alike, stored with the foot mounted
  put(
    'posts',
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
  // curtain) gets the same rails in its header (overstykke), plus a lower plate.
  unit('rails', 'Toppskinne', r.wall.topRail, rail, r.wall.railCoupling, s.modules.length);
  unit('rails', 'Bunnskinne', r.wall.bottomRail, rail, r.wall.railCoupling, s.modules.length);
  for (const m of s.modules)
    if (m.opening) addPlate(m.plate, header - railsH + plateExtra, ' · overstykke');
    else addPlate(m.plate, plate.h, '');

  // Takdrager: 292 between the posts with two 600 in each end, one piece per length
  for (const b of s.beams) unit('beams', 'Takdrager', r.beam.profile, between(b.lengthMm), r.beam.coupling, 1);

  // Tekstilvegger: 43TX cut mitred 2W + 2H (loose), 4 × 613, 2 × 520, and upright braces in 90 with a 600 in each
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
    put('textile', p.code, { artnr: p.artnr, name: `${p.code} · ${p.name}, gjæret`, detail: mmList(frameCuts), preassembled: false, lm }, pieces);
  }
  for (const [len, b] of braces) unit('textile', 'Støttestag', r.frame.brace, len, r.frame.braceCoupling, b.qty, ` · til ${b.frames.join(', ')}`);
  part('textile', r.frame.corner, 4 * s.frames.length);
  part('textile', r.frame.wallFixing.code, r.frame.wallFixing.perFrame * s.frames.length);

  // Order inside groups: beams longest first; plates tallest first, then by RAL; the rest as added
  return {
    groups: GROUPS.map((g) => ({
      ...g,
      lines: [...lines.get(g.id)!.values()].sort((a, b) => b.size - a.size || (a.line.ral ?? '').localeCompare(b.line.ral ?? '')).map((e) => e.line),
    })).filter((g) => g.lines.length),
  };
}
