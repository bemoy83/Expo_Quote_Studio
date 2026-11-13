// Print og dekal på disk (Byggeregel K20, trinn 2): print is a decal over the whole of a part, every plate and sliding
// door of it, never on an open light opening, a step plate or a part held to a plate against a wall or another counter
// (K16; the choice stays and comes back when the counter is moved out). Parts in a row on the same side with the same
// motif show one motif stretched over them, as `printWall`. A decal has a size and a place on its part and is moved and
// scaled as on a wall. The colour stays the counter's (K6). Stored on the section's side (`SectionSide.print`,
// `decals`), so it follows the part as the lights do. Pure, mm in the counter's frame.
import { RECIPES } from '../foga/recipes';
import { nextId } from './ids';
import { lightsOf, partKey, podiumParts, sideKey, withSide, type PodiumPart } from './podiumFaces';
import { coverCrop, cropWindow, type Crop } from './print';
import { EPS, withSections, type Axis } from './podiumSections';
import type { CounterSection, PodiumDecal, SectionSide, Variant } from './types';

const R = RECIPES.counter;

/** The way along a side that runs left to right for one standing outside it, in the counter's frame. */
export const rightOf = (axis: Axis, out: -1 | 1): 1 | -1 => (axis === 'z' ? out : (-out as 1 | -1));

/** A window of a part where its plates show, mm: along the side from t0 to t1 (counter frame, t0 < t1), y0 to y1 above
 *  the floor (between the rails). */
export interface PartWindow {
  t0: number;
  t1: number;
  y0: number;
  y1: number;
}

/** The plates of a part seen from outside (K16, K19): one window per light opening that is not open, between the posts
 *  and the rails. `locked`: all plates. */
export function partWindows(sections: readonly CounterSection[], p: PodiumPart, locked = false): PartWindow[] {
  const s = sections[p.section];
  const cuts = [0, ...(s.shelves ?? []), s.h];
  const kinds = lightsOf(sections, p);
  const t0 = p.a + R.joint;
  const t1 = p.b - R.joint;
  return cuts.slice(1).flatMap((c1, i) => (!locked && kinds[i] === 'open' ? [] : [{ t0, t1, y0: cuts[i] + R.railHeight, y1: c1 }]));
}

/** Whether a part can take print or a decal: not open in every light opening (K20). */
export const takesDecor = (sections: readonly CounterSection[], p: PodiumPart) => lightsOf(sections, p).some((k) => k !== 'open');

const sideOf = (sections: readonly CounterSection[], p: PodiumPart): SectionSide | undefined => sections[p.section]?.sides?.[sideKey(p.axis, p.out)];
/** The motif printed on a part, if any. */
export const printOf = (sections: readonly CounterSection[], p: PodiumPart) => sideOf(sections, p)?.print;
/** The middle of the section's side a part is in front of, along the side (counter frame). */
const sideMid = (sections: readonly CounterSection[], p: PodiumPart) => {
  const s = sections[p.section];
  const run = p.axis === 'x' ? s.z : s.x;
  return (run[0] + run[1]) / 2;
};

/** A window of print: where on the part, and the share of the motif it shows. */
export interface PrintWindow extends PartWindow {
  part: PodiumPart;
  motif: string;
  crop: Crop;
  /** Which run of parts it belongs to (by order), and how many parts the run has. */
  run: number;
  runParts: number;
}

/**
 * Every window of print on a counter (K20): parts in a row on one straight side with the same motif share one picture,
 * over the box from the first part's left post to the last part's right and from the bottom rail up to the highest
 * top, cropped (never stretched) to cover it; each window shows its share. `ratio`: a motif's width / height.
 */
export function podiumPrints(sections: readonly CounterSection[], locked: ReadonlySet<string>, ratio: (motif: string) => number): PrintWindow[] {
  if (!sections.some((s) => s.sides)) return [];
  const parts = podiumParts(sections).filter((p) => !locked.has(partKey(p)) && printOf(sections, p) && takesDecor(sections, p));
  const line = (p: PodiumPart) => `${p.axis}${p.out}:${p.at}`;
  const out: PrintWindow[] = [];
  const done = new Set<PodiumPart>();
  let runs = 0;
  for (const p of parts) {
    if (done.has(p)) continue;
    const motif = printOf(sections, p)!;
    // The run: parts on the same line, touching end to end, with the same motif
    const run = [p];
    for (let grew = true; grew; ) {
      grew = false;
      for (const q of parts)
        if (!run.includes(q) && line(q) === line(p) && printOf(sections, q) === motif && run.some((r) => Math.abs(r.b - q.a) < EPS || Math.abs(q.b - r.a) < EPS)) {
          run.push(q);
          grew = true;
        }
    }
    run.forEach((q) => done.add(q));
    runs++;
    const right = rightOf(p.axis, p.out);
    const ws = run.flatMap((q) => partWindows(sections, q).map((w) => ({ q, w })));
    if (!ws.length) continue;
    // Seen from outside: s = right · t
    const sx = (t: number) => right * t;
    const box = {
      x0: Math.min(...ws.map(({ w }) => Math.min(sx(w.t0), sx(w.t1)))),
      x1: Math.max(...ws.map(({ w }) => Math.max(sx(w.t0), sx(w.t1)))),
      y0: R.railHeight,
      y1: Math.max(...ws.map(({ w }) => w.y1)),
    };
    const crop = coverCrop((box.x1 - box.x0) / (box.y1 - box.y0), ratio(motif));
    for (const { q, w } of ws) {
      const win = { x0: Math.min(sx(w.t0), sx(w.t1)), x1: Math.max(sx(w.t0), sx(w.t1)), y0: w.y0, y1: w.y1 };
      out.push({ ...w, part: q, motif, crop: cropWindow(crop, box, win), run: runs, runParts: run.length });
    }
  }
  return out;
}

/** A decal placed: on which part, its box along (counter frame, t0 < t1) and up, and where it is stored. */
export interface PlacedDecal {
  part: PodiumPart;
  decal: PodiumDecal;
  section: number;
  side: ReturnType<typeof sideKey>;
  t0: number;
  t1: number;
  y0: number;
  y1: number;
}

/** Every decal on a counter as it stands (K20): on a part that is not held to a plate and not open all over. */
export function podiumDecals(sections: readonly CounterSection[], locked: ReadonlySet<string> = new Set()): PlacedDecal[] {
  if (!sections.some((s) => s.sides)) return [];
  const out: PlacedDecal[] = [];
  for (const p of podiumParts(sections)) {
    if (locked.has(partKey(p)) || !takesDecor(sections, p)) continue;
    for (const d of sideOf(sections, p)?.decals ?? []) {
      const c = sideMid(sections, p) + rightOf(p.axis, p.out) * d.x;
      // A decal belongs to the part its centre is in front of; on a node, to the part after it
      const next = partsOnSide(sections, p).some((q) => Math.abs(q.a - p.b) < EPS);
      if (c < p.a - EPS || c > p.b + EPS || (next && c > p.b - EPS)) continue;
      out.push({ part: p, decal: d, section: p.section, side: sideKey(p.axis, p.out), t0: c - d.w / 2, t1: c + d.w / 2, y0: d.y - d.h / 2, y1: d.y + d.h / 2 });
    }
  }
  return out;
}
const partsOnSide = (sections: readonly CounterSection[], p: PodiumPart) => podiumParts(sections).filter((q) => q.section === p.section && q.axis === p.axis && q.out === p.out);

/** The side of a part with `fn` done to it. */
function onSides(sections: readonly CounterSection[], parts: readonly PodiumPart[], fn: (side: SectionSide | undefined, p: PodiumPart) => SectionSide | undefined): CounterSection[] {
  const out = [...sections];
  const seen = new Set<string>();
  for (const p of parts) {
    const k = `${p.section}:${sideKey(p.axis, p.out)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const s = out[p.section];
    out[p.section] = withSide(s, sideKey(p.axis, p.out), fn(s.sides?.[sideKey(p.axis, p.out)], p));
  }
  return out;
}
/** A side with a field set or taken off; none when nothing is left. */
function withField<K extends 'print' | 'decals'>(side: SectionSide | undefined, k: K, v: SectionSide[K] | undefined): SectionSide | undefined {
  const { [k]: _, ...rest } = side ?? {};
  const next: SectionSide = v === undefined || (Array.isArray(v) && !v.length) ? rest : { ...rest, [k]: v };
  return Object.keys(next).length ? next : undefined;
}

const partsBy = (sections: readonly CounterSection[], keys: readonly string[] | 'all') => {
  const want = keys === 'all' ? null : new Set(keys);
  return podiumParts(sections).filter((p) => (!want || want.has(partKey(p))) && takesDecor(sections, p));
};

/** The sketch with print `motif` on the parts `keys` (partKey) of counter `id`, or on every part that takes it (`all`,
 *  the paint bucket); the print replaces the decals there (K20). null takes the print off. */
export function setPodiumPrint(v: Variant, id: string, keys: readonly string[] | 'all', motif: string | null): Variant {
  return withSections(v, id, (ss) => onSides(ss, partsBy(ss, keys), (side) => (motif ? withField(withField(side, 'decals', undefined), 'print', motif) : withField(side, 'print', undefined))));
}

/** The sketch with a decal of `motif` in the middle of part `key` of counter `id`: as wide as the motif allows within
 *  80 % of the part, at most 600 × 600, in the middle of its height; it takes off the print on that side. */
export function addPodiumDecal(v: Variant, id: string, key: string, motif: string, ratio: number): { v: Variant; decal?: string } {
  const o = v.objects.find((x) => x.id === id);
  const p = o?.sections && podiumParts(o.sections).find((q) => partKey(q) === key);
  if (!o?.sections || !p || !takesDecor(o.sections, p)) return { v };
  const ws = partWindows(o.sections, p);
  const top = Math.max(...ws.map((w) => w.y1));
  const span = p.b - p.a - 2 * R.joint;
  const r = ratio > 0 ? ratio : 1;
  let w = Math.min(600, span * 0.8);
  let h = w / r;
  if (h > Math.min(600, (top - R.railHeight) * 0.6)) {
    h = Math.min(600, (top - R.railHeight) * 0.6);
    w = h * r;
  }
  const taken = o.sections.flatMap((s) => Object.values(s.sides ?? {}).flatMap((x) => (x.decals ?? []).map((d) => d.id)));
  const decal: PodiumDecal = { id: nextId(taken, 'd'), motif, w: Math.round(w), h: Math.round(h), x: Math.round(rightOf(p.axis, p.out) * ((p.a + p.b) / 2 - sideMid(o.sections, p))), y: Math.round((R.railHeight + top) / 2) };
  return { v: withSections(v, id, (ss) => onSides(ss, [p], (side) => withField(withField(side, 'print', undefined), 'decals', [...(side?.decals ?? []), decal]))), decal: decal.id };
}

/** The decal `decal` of counter `id` changed (moved, scaled, another motif) or taken off (null), kept on its part. */
export function updatePodiumDecal(v: Variant, id: string, decal: string, patch: Partial<Omit<PodiumDecal, 'id'>> | null): Variant {
  return withSections(v, id, (ss) => {
    const at = podiumDecals(ss).find((x) => x.decal.id === decal);
    if (!at) return ss;
    return onSides(ss, [at.part], (side) => {
      const list = (side?.decals ?? []).flatMap((d) => (d.id !== decal ? [d] : patch ? [kept(ss, at.part, { ...d, ...patch })] : []));
      return withField(side, 'decals', list);
    });
  });
}

/** A decal held within its part's plates, mm: no smaller than 50, no bigger than the part. */
function kept(sections: readonly CounterSection[], p: PodiumPart, d: PodiumDecal): PodiumDecal {
  const ws = partWindows(sections, p);
  const lo = R.railHeight;
  const hi = Math.max(...ws.map((w) => w.y1));
  const span = p.b - p.a - 2 * R.joint;
  const w = Math.round(Math.max(50, Math.min(d.w, span)));
  const h = Math.round(Math.max(50, Math.min(d.h, hi - lo)));
  const mid = rightOf(p.axis, p.out) * ((p.a + p.b) / 2 - sideMid(sections, p));
  const x = Math.round(Math.max(mid - (span - w) / 2, Math.min(mid + (span - w) / 2, d.x)));
  const y = Math.round(Math.max(lo + h / 2, Math.min(hi - h / 2, d.y)));
  return { ...d, w, h, x, y };
}

/** What a counter's print and decals cost (K20, as on a wall): m² of print over its plates and doors, the decals' m²,
 *  the parts printed, and the prints stretched over more than one part (a print setup each). */
export function podiumDecorAreas(sections: readonly CounterSection[], locked: ReadonlySet<string> = new Set()): { full: number; decal: number; parts: number; runs: number; sizes: Map<string, number> } {
  const prints = podiumPrints(sections, locked, () => 1);
  const full = prints.reduce((a, w) => a + ((w.t1 - w.t0) * (w.y1 - w.y0)) / 1e6, 0);
  const decal = podiumDecals(sections, locked).reduce((a, d) => a + (d.decal.w * d.decal.h) / 1e6, 0);
  const parts = new Set(prints.map((w) => partKey(w.part)));
  // The foil is cut per plate or door it covers: how many of each size, B × H in mm (Byggeregel K20)
  const sizes = new Map<string, number>();
  for (const w of prints) {
    const k = `${Math.round(w.t1 - w.t0)} × ${Math.round(w.y1 - w.y0)}`;
    sizes.set(k, (sizes.get(k) ?? 0) + 1);
  }
  return { full, decal, parts: parts.size, runs: new Set(prints.filter((w) => w.runParts > 1).map((w) => w.run)).size, sizes };
}
