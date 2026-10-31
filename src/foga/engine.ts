// Foga engine: structure + recipes → parts list (stykkliste). Pure, no prices, no loose goods.
// Profiles come out as a cut list per profile; couplings and feet as counts. Anything without a confirmed recipe
// becomes an open item that names the question it waits for.
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
  open: OpenItem[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function bom(s: FogaStructure, r: Recipes): Bom {
  const cuts = new Map<string, Map<number, number>>();
  const counts = new Map<string, number>();
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

  // Textile frames: 2W + 2H mitred, 4 corners
  for (const f of s.frames) {
    cut(r.frame.profile, f.W, 2);
    cut(r.frame.profile, f.H, 2);
    add(r.frame.corner, 4);
    if (f.braces && r.frame.brace) {
      cut(r.frame.brace.profile, f.braces.length, f.braces.qty);
      add(r.frame.brace.coupling, f.braces.qty * r.frame.brace.perBrace);
    }
  }
  const nBraces = s.frames.reduce((a, f) => a + (f.braces?.qty ?? 0), 0);
  if (nBraces && !r.frame.brace) ask('brace', plural(nBraces, 'tverrstag', 'tverrstag'));

  // Walls, posts, beams and openings: no recipe yet (see recipes.ts)
  if (s.posts.length) {
    ask('post', plural(s.posts.length, 'stolpe', 'stolper'));
    ask('feet', plural(s.posts.length, 'stolpe', 'stolper'));
  }
  if (s.modules.length) ask('rails', plural(s.modules.length, 'veggmodul', 'veggmoduler'));
  const plates = s.modules.filter((m) => m.plate).length;
  if (plates) ask('plate', plural(plates, 'veggplate', 'veggplater'));
  if (s.beams.length) ask('beam', plural(s.beams.length, 'lengde takdrager', 'lengder takdrager'));
  const openings = s.modules.filter((m) => m.opening).length;
  if (openings) ask('opening', plural(openings, 'åpning', 'åpninger'));
  if (cuts.size) ask('stock', 'profilene står som kappede mål');

  const profiles: ProfileLine[] = [...cuts].map(([code, m]) => {
    const list = [...m].map(([lengthMm, qty]) => ({ lengthMm, qty })).sort((a, b) => b.lengthMm - a.lengthMm);
    return { part: fogaPart(code), cuts: list, lm: list.reduce((a, c) => a + (c.lengthMm * c.qty) / 1000, 0) };
  });
  const parts: PartLine[] = [...counts].map(([code, qty]) => ({ part: fogaPart(code), qty }));
  open.sort((a, b) => a.no - b.no);
  return { profiles, parts, open };
}
