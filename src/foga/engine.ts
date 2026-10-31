// Foga engine: structure + recipes → parts list (deleliste). Pure: no prices, no loose goods.
// Profiles come out as pieces per cut length, couplings and feet as counts, plates per RAL. Anything without a
// confirmed recipe becomes an open item that names the question it waits for.
import { fogaPart, type FogaPart } from './parts';
import { QUESTIONS, type QuestionId, type Recipes } from './recipes';
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
  qty: number;
}

export interface OpenItem {
  question: QuestionId;
  no: number;
  text: string;
  /** What in this stand waits for the answer, e.g. "12 stolper". */
  affects: string;
}

export interface Bom {
  profiles: ProfileLine[];
  parts: PartLine[];
  plates: PlateLine[];
  open: OpenItem[];
}

/** Sizes the engine needs from the rules, mm. */
export interface BomSizes {
  /** Post length without feet (system wall height). */
  postLength: number;
  /** Module centre distance. */
  cc: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function bom(s: FogaStructure, r: Recipes, z: BomSizes): Bom {
  const cuts = new Map<string, Map<number, number>>();
  const counts = new Map<string, number>();
  const plates = new Map<string, number>();
  const open: OpenItem[] = [];

  const cut = (code: string, lengthMm: number, qty: number) => {
    if (qty <= 0 || lengthMm <= 0) return;
    const m = cuts.get(code) ?? new Map<number, number>();
    m.set(lengthMm, (m.get(lengthMm) ?? 0) + qty);
    cuts.set(code, m);
  };
  const add = (code: string, qty: number) => {
    if (qty > 0) counts.set(code, (counts.get(code) ?? 0) + qty);
  };
  const ask = (q: QuestionId, affects: string) => open.push({ question: q, no: QUESTIONS[q].no, text: QUESTIONS[q].text, affects });

  // Wall posts: profile 94 at wall height, feet on every post
  const wallPosts = s.posts.filter((p) => !p.beamOnly);
  cut(r.wall.post, z.postLength, wallPosts.length);
  for (const f of r.wall.feet) add(f.code, wallPosts.length * f.qty);

  // Wall modules: top and bottom rail between the posts, one plate
  const walled = s.modules.filter((m) => m.plate);
  const rail = z.cc - (fogaPart(r.wall.post).section?.[0] ?? 0);
  cut(r.wall.topRail, rail, walled.length);
  cut(r.wall.bottomRail, rail, walled.length);
  for (const m of walled) plates.set(m.plate!, (plates.get(m.plate!) ?? 0) + 1);
  if (walled.length) ask('railCoupling', plural(walled.length * 2, 'skinne', 'skinner'));
  const openings = s.modules.filter((m) => m.opening).length;
  if (openings) ask('header', plural(openings, 'åpning', 'åpninger'));

  // Takdrager: one 292 per length, posts that only carry a beam wait for their length
  for (const b of s.beams) cut(r.beam.profile, b.lengthMm, 1);
  const beamPosts = s.posts.length - wallPosts.length;
  if (s.beams.length)
    ask('beamMount', beamPosts ? `${plural(s.beams.length, 'takdrager', 'takdragere')}, ${plural(beamPosts, 'frittstående stolpe', 'frittstående stolper')}` : plural(s.beams.length, 'takdrager', 'takdragere'));

  // Textile frames: 2W + 2H mitred, 4 corners, upright braces in profile 90
  for (const f of s.frames) {
    cut(r.frame.profile, f.W, 2);
    cut(r.frame.profile, f.H, 2);
    add(r.frame.corner, 4);
    if (f.braces) cut(r.frame.brace, f.braces.length, f.braces.qty);
  }
  const nBraces = s.frames.reduce((a, f) => a + (f.braces?.qty ?? 0), 0);
  if (nBraces) ask('braceCoupling', plural(nBraces, 'tverrstag', 'tverrstag'));
  if (s.frames.length) ask('frameFixing', plural(s.frames.length, 'ramme', 'rammer'));
  const joints = s.frames.filter((f) => f.joinedToNext).length;
  if (joints) ask('frameJoint', plural(joints, 'skjøt', 'skjøter'));

  const profiles: ProfileLine[] = [...cuts].map(([code, m]) => {
    const list = [...m].map(([lengthMm, qty]) => ({ lengthMm, qty })).sort((a, b) => b.lengthMm - a.lengthMm);
    return { part: fogaPart(code), cuts: list, lm: list.reduce((a, c) => a + (c.lengthMm * c.qty) / 1000, 0) };
  });
  const parts: PartLine[] = [...counts].map(([code, qty]) => ({ part: fogaPart(code), qty }));
  const plate = fogaPart(r.wall.plate.code);
  open.sort((a, b) => a.no - b.no);
  return { profiles, parts, plates: [...plates].map(([ral, qty]) => ({ part: plate, ral, qty })), open };
}
