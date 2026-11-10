// Foga engine: structure + recipes → parts list (deleliste), each line in a subgroup of the product grouping. Pure: no prices, no loose goods.
// Pre-assembled units (post with feet, rails and beams and textile braces with their couplings) are one piece each;
// loose profiles are counted per cut length; plates per RAL and size.
// Byggeregler V2–V5, S8, T1, D2, P1, P2, H2, H3 (docs/byggeregler.md).
import { resolveGroup } from '../catalog/groups';
import { fogaPart } from './parts';
import type { Recipes } from './recipes';
import type { FogaStructure, ModuleSpec } from './structure';

export interface BomLine {
  /** Foga art.nr, or empty for a pre-assembled unit and for plates (not Foga). */
  artnr: string;
  name: string;
  /** What it is made of, or the cut lengths. */
  detail: string;
  /** Pre-assembled units: where the piece goes, without what it is made of ('overstykke', 'til fotplate'). */
  note?: string;
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
  shelves: 'hyll.hyller',
} as const;

type BomGroup = (typeof BOM_GROUP)[keyof typeof BOM_GROUP];

/** Height a rail takes up in the wall: the long side of its section (92: 40, 91: 30). */
const railHeight = (code: string) => Math.max(...(fogaPart(code).section ?? [0]));

const mmList = (cuts: Map<number, number>) =>
  [...cuts]
    .sort(([a], [b]) => b - a)
    .map(([len, qty]) => `${qty} × ${len}`)
    .join(' · ') + ' mm';

/** 43TX cut lengths. Every end is mitred except at a rail splice and where a rail meets a 92LTX corner post: there it
 *  is cut straight, so those pieces are named apart (Bjørn 8.11.2026): «… mm · 2 × 2463 og 2 × 1463 har én butt ende,
 *  resten gjæret». */
function cutDetail(cuts: Map<number, number>, butt: Map<string, number>): string {
  if (!butt.size) return mmList(cuts);
  const byEnds = [1, 2].flatMap((n) => {
    const list = [...butt]
      .filter(([k]) => +k.split('|')[1] === n)
      .map(([k, qty]) => [+k.split('|')[0], qty] as const)
      .sort(([a], [b]) => b - a)
      .map(([len, qty]) => `${qty} × ${len}`);
    if (!list.length) return [];
    const and = list.length > 1 ? `${list.slice(0, -1).join(', ')} og ${list[list.length - 1]}` : list[0];
    return [`${and} har ${n === 1 ? 'én butt ende' : 'to butte ender'}`];
  });
  return `${mmList(cuts)} · ${byEnds.join(' · ')}, resten gjæret`;
}

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
  /** A profile with couplings mounted in its ends, picked as one piece. `note` says where it goes. */
  const unit = (group: BomGroup, name: string, profile: string, lengthMm: number, c: { code: string; perEnd: number }, qty: number, note = '') =>
    put(
      group,
      `${name}|${profile}|${lengthMm}`,
      {
        artnr: '',
        name: `${name} ${profile}, ${lengthMm} mm, med ${c.code}`,
        detail: withCouplings(profile, lengthMm, c.code, 2 * c.perEnd) + (note && ` · ${note}`),
        ...(note && { note }),
        preassembled: true,
      },
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

  // Stolper: wall and takdrager alike, stored with the foot mounted. A post on a støtteplate has the plate's pin in its
  // centre channel instead, so it is picked without the foot.
  const bare = s.barePosts ?? 0;
  put(
    BOM_GROUP.posts,
    'post',
    {
      artnr: '',
      name: `Stolpe ${r.wall.post} med justeringsfot`,
      detail: [`${r.wall.post} × ${z.postLength} mm`, ...r.wall.feet.map((f) => `${f.qty} × ${f.code} (${fogaPart(f.code).artnr})`)].join(' · '),
      preassembled: true,
    },
    s.posts - bare,
  );
  put(BOM_GROUP.posts, 'post-bare', { artnr: '', name: `Stolpe ${r.wall.post} uten fot`, detail: `${r.wall.post} × ${z.postLength} mm · til fotplate`, note: 'til fotplate', preassembled: true }, bare);

  // Støtteplater under the posts of walls that stand free: the plate with its pin (M8) mounted, one piece, threaded
  // into the post's centre channel on site
  const sp = r.wall.support;
  put(
    BOM_GROUP.posts,
    'stotteplate',
    { artnr: '', name: `Fotplate ${sp.foot.code} med ${sp.pin}`, detail: [sp.foot.code, sp.pin].map((c) => `1 × ${c} (${fogaPart(c).artnr})`).join(' · '), preassembled: true },
    s.wallFeet ?? 0,
  );

  // Skinner: top and bottom rail between the posts with a 600 in each end, for every module. An opening (door or
  // curtain) gets the same rails in its header (overstykke) with a lower plate; the header is listed with the doors.
  // A curtain's header has 92 at the bottom too: the glider runs in its channel.
  const walled = s.modules.filter((m) => !m.opening);
  const headers = s.modules.filter((m) => m.opening);
  const bottomRail = (m: ModuleSpec) => (m.curtain ? r.door.curtainBottomRail : r.wall.bottomRail);
  unit(BOM_GROUP.rails, 'Toppskinne', r.wall.topRail, rail, r.wall.railCoupling, walled.length);
  unit(BOM_GROUP.rails, 'Bunnskinne', r.wall.bottomRail, rail, r.wall.railCoupling, walled.length);
  for (const m of headers) {
    unit(BOM_GROUP.header, 'Toppskinne', r.wall.topRail, rail, r.wall.railCoupling, 1, 'overstykke');
    unit(BOM_GROUP.header, 'Bunnskinne', bottomRail(m), rail, r.wall.railCoupling, 1, 'overstykke');
  }
  for (const m of walled) addPlate(BOM_GROUP.plates, m.plate, plate.h, '');
  for (const ral of s.swaps ?? []) addPlate(BOM_GROUP.plates, ral, plate.h, ' · platebytte i standvegg');
  const headerRails = (m: ModuleSpec) => railHeight(r.wall.topRail) + railHeight(bottomRail(m));
  for (const m of headers) addPlate(BOM_GROUP.header, m.plate, header - headerRails(m) + plateExtra, ' · overstykke');

  // Takdrager: 292 between the posts with two 600 in each end, one piece per length
  for (const b of s.beams) unit(BOM_GROUP.beams, 'Takdrager', r.beam.profile, between(b.lengthMm), r.beam.coupling, 1);
  // A takdrager's end hanging on another beam: a hook in 01 with one leg (enveis) or two (toveis), picked whole
  const hook = r.beam.hook;
  const hookUnit = (key: string, kind: string, legs: number, qty: number) =>
    put(
      BOM_GROUP.beams,
      key,
      {
        artnr: '',
        name: `Krok ${hook.profile} ${kind}`,
        detail: `${hook.profile} (${fogaPart(hook.profile).artnr}) × ${hook.top} mm + ${legs} × ${hook.leg} mm · ${hook.screw} · 1 × ${hook.nut} (${fogaPart(hook.nut).artnr})`,
        note: kind === 'enveis' ? 'takdrager fra én side' : 'takdrager fra begge sider',
        preassembled: true,
      },
      qty,
    );
  hookUnit('hook-one', 'enveis', 1, s.beamHooks?.oneWay ?? 0);
  hookUnit('hook-two', 'toveis', 2, s.beamHooks?.twoWay ?? 0);
  // Lifted over a textile wall: a piece of 94 on top of each post under the beam (609 down into the post), and at a hook
  // point between a lifted beam and one that is not, the same piece coupled to the other beam with a 600
  const lift = r.beam.lift;
  const liftPiece = (key: string, coupling: string, note: string, qty: number) =>
    put(
      BOM_GROUP.beams,
      key,
      { artnr: '', name: `Skjøt ${lift.profile}, ${lift.length} mm, med ${coupling}`, detail: `${lift.profile} × ${lift.length} mm · 1 × ${coupling} (${fogaPart(coupling).artnr}) · ${note}`, note, preassembled: true },
      qty,
    );
  liftPiece('lift-post', lift.post, 'på stolpe, takdrager over tekstilvegg', s.beamLift?.posts ?? 0);
  liftPiece('lift-hook', lift.hook, 'oppå tverrgående takdrager, takdrager over tekstilvegg', s.beamLift?.hooks ?? 0);
  // Byggeregel T15: a lifted beam ending on a wall between its posts, the same piece on top of the wall
  liftPiece('lift-wall', lift.hook, 'oppå vegg, takdrager over tekstilvegg', s.beamLift?.walls ?? 0);

  // Tekstilvegger, one frame on a wall or on foot plates (Bjørn 7.11.2026), each counted once in its parts
  // (calc/textile/common.ts): 43TX per cut length in one line, a 92LTX post per corner, the upright braces in 90 with
  // a 600 in each end, stored pre-assembled (the brace line names the frames it belongs to), and the loose parts:
  // 617, the splice connectors (609, 604), 520 on a wall and the foot plates
  const tf = r.textileFrame;
  const cuts = new Map<number, number>();
  const butt = new Map<string, number>();
  const braces = new Map<number, { qty: number; frames: string[] }>();
  const loose = new Map<string, number>();
  for (const { pos, parts } of s.frames) {
    for (const [len, qty] of parts.cuts) cuts.set(len, (cuts.get(len) ?? 0) + qty);
    for (const [len, ends, qty] of parts.butt ?? []) butt.set(`${len}|${ends}`, (butt.get(`${len}|${ends}`) ?? 0) + qty);
    const { qty, length } = parts.braces;
    if (qty) {
      const b = braces.get(length) ?? { qty: 0, frames: [] };
      b.qty += qty;
      b.frames.push(qty > 1 ? `${pos} (${qty})` : pos);
      braces.set(length, b);
    }
    for (const [code, q] of parts.loose) loose.set(code, (loose.get(code) ?? 0) + q);
  }
  if (cuts.size) {
    const p = fogaPart(tf.profile);
    const pieces = [...cuts.values()].reduce((a, b) => a + b, 0);
    const lm = [...cuts].reduce((a, [len, qty]) => a + (len * qty) / 1000, 0);
    put(BOM_GROUP.textile, p.code, { artnr: p.artnr, name: `${p.code} · ${p.name}`, detail: cutDetail(cuts, butt), preassembled: false, lm }, pieces);
  }
  if (s.cornerPosts?.qty) {
    const p = fogaPart(tf.feet.cornerPost);
    put(BOM_GROUP.textile, p.code, { artnr: p.artnr, name: `${p.code} · ${p.name}`, detail: `${s.cornerPosts.qty} × ${s.cornerPosts.H} mm`, preassembled: false, lm: (s.cornerPosts.qty * s.cornerPosts.H) / 1000 }, s.cornerPosts.qty);
  }
  for (const [len, b] of braces) unit(BOM_GROUP.textile, 'Støttestag', tf.brace, len, tf.braceCoupling, b.qty, `til ${b.frames.join(', ')}`);
  // Loose parts in a fixed order (connectors, splices, brackets), then the foot plates as they come
  const first = [tf.corner, tf.splice.thread, tf.splice.slide.code, tf.wall.fixing.code];
  for (const code of [...first, ...[...loose.keys()].filter((c) => !first.includes(c))]) part(BOM_GROUP.textile, code, loose.get(code) ?? 0);

  // Hyller (Byggeregler H2, H3): the brackets with their 600 into the post, stored mounted, and the boards (not Foga)
  const sh = r.shelf;
  const bracket = (code: string, qty: number, note: string) =>
    put(
      BOM_GROUP.shelves,
      `bracket|${code}`,
      {
        artnr: '',
        name: `Hylleknekt ${code}, ${sh.bracket} mm, med ${sh.coupling.code}`,
        detail: `${code} × ${sh.bracket} mm · ${sh.coupling.perBracket} × ${sh.coupling.code} (${fogaPart(sh.coupling.code).artnr}) · ${note}`,
        note,
        preassembled: true,
      },
      qty,
    );
  bracket(sh.end, s.shelves?.end ?? 0, 'ende');
  bracket(sh.twin, s.shelves?.twin ?? 0, 'mellom to hylleplater');
  put(BOM_GROUP.shelves, 'board', { artnr: '', name: fogaPart(sh.board.code).name, detail: `${sh.board.w} × ${sh.board.d} mm`, preassembled: false }, s.shelves?.boards ?? 0);

  // Tree order; inside a subgroup beams longest first, plates tallest first then by RAL, the rest as added
  const order = (l: BomLine) => resolveGroup(l.group).order;
  return {
    lines: [...lines.values()]
      .sort((a, b) => order(a.line) - order(b.line) || b.size - a.size || (a.line.ral ?? '').localeCompare(b.line.ral ?? ''))
      .map((e) => e.line),
  };
}
