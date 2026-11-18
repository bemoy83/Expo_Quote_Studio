// Print og dekal på disk (Byggeregel K20): print is a decal over a plate or a sliding door, never on an open light
// opening or a step plate. As on a wall (Bjørn 18.11.2026): the brush lays the whole motif on one plate, the paint
// bucket one picture over every plate of the side, each showing its share (`run`, as `Foil.run`). A decal has a size and
// a place on its part and is moved and scaled as on a wall. Stored on the section's side per light opening
// (`SectionSide.print`, `decals`), so it follows the part as the lights do. Pure, mm in the counter's frame.
import { RECIPES } from '../foga/recipes';
import { nextId } from './ids';
import { lightsOf, partKey, podiumParts, sideKey, withAt, withSide, withSideField, type PodiumPart } from './podiumFaces';
import { coverCrop, cropWindow, type Crop } from './print';
import { EPS, withSections, type Axis } from './podiumSections';
import type { CounterSection, PodiumDecal, PodiumPrint, SectionSide, Variant } from './types';

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
 *  and the rails, with the light opening it is (from the floor). */
export function partWindows(sections: readonly CounterSection[], p: PodiumPart): (PartWindow & { light: number })[] {
  const s = sections[p.section];
  const cuts = [0, ...(s.shelves ?? []), s.h];
  const kinds = lightsOf(sections, p);
  const t0 = p.a + R.joint;
  const t1 = p.b - R.joint;
  return cuts.slice(1).flatMap((c1, i) => (kinds[i] === 'open' ? [] : [{ t0, t1, y0: cuts[i] + R.railHeight, y1: c1, light: i }]));
}

/** Whether a part can take print or a decal: not open in every light opening (K20). */
export const takesDecor = (sections: readonly CounterSection[], p: PodiumPart) => lightsOf(sections, p).some((k) => k !== 'open');

const sideOf = (sections: readonly CounterSection[], p: PodiumPart): SectionSide | undefined => sections[p.section]?.sides?.[sideKey(p.axis, p.out)];
/** The print on light opening `light` of a part as it stands: none on what is open. */
export const printAt = (sections: readonly CounterSection[], p: PodiumPart, light: number): PodiumPrint | null =>
  lightsOf(sections, p)[light] === 'open' ? null : (sideOf(sections, p)?.print?.[light] ?? null);
/** The light openings of a part with print. */
export const printedLights = (sections: readonly CounterSection[], p: PodiumPart): number[] =>
  lightsOf(sections, p).flatMap((_, i) => (printAt(sections, p, i) ? [i] : []));
/** The motif printed on light opening `light` of a part, or on all of it that takes print when `light` is left out:
 *  none when one of them has none or they differ. */
export function printOf(sections: readonly CounterSection[], p: PodiumPart, light?: number): string | undefined {
  if (light !== undefined) return printAt(sections, p, light)?.motif;
  const ms = new Set(partWindows(sections, p).map((w) => printAt(sections, p, w.light)?.motif));
  return ms.size === 1 ? [...ms][0] : undefined;
}
/** The middle of the section's side a part is in front of, along the side (counter frame). */
const sideMid = (sections: readonly CounterSection[], p: PodiumPart) => {
  const s = sections[p.section];
  const run = p.axis === 'x' ? s.z : s.x;
  return (run[0] + run[1]) / 2;
};

/** A window of print: where on the part, and the share of the motif it shows. */
export interface PrintWindow extends PartWindow {
  part: PodiumPart;
  light: number;
  motif: string;
  crop: Crop;
  /** Which print it belongs to (by order), and how many parts that print covers. */
  run: number;
  runParts: number;
}

/**
 * Every window of print on a counter (K20). A plate printed with the brush shows the whole motif, cropped (never
 * stretched) to cover it. The plates of one print with the bucket (`run`) share one picture over the box from the
 * left post of the first to the right of the last and from the bottom rail up to the highest top, seen from outside
 * the side they are on; each window shows its share. `ratio`: a motif's width / height.
 */
export function podiumPrints(sections: readonly CounterSection[], ratio: (motif: string) => number): PrintWindow[] {
  if (!sections.some((s) => s.sides)) return [];
  const groups = new Map<string, { p: PodiumPart; w: PartWindow & { light: number }; print: PodiumPrint }[]>();
  for (const p of podiumParts(sections))
    for (const w of partWindows(sections, p)) {
      const print = printAt(sections, p, w.light);
      if (!print) continue;
      // A run is one picture on one side of the counter; a plate on its own is its own
      const key = print.run ? `${print.run}|${p.axis}${p.out}` : `${p.section}:${sideKey(p.axis, p.out)}:${p.a}:${w.light}`;
      groups.set(key, [...(groups.get(key) ?? []), { p, w, print }]);
    }
  const out: PrintWindow[] = [];
  let runs = 0;
  for (const ws of groups.values()) {
    runs++;
    const right = rightOf(ws[0].p.axis, ws[0].p.out);
    const motif = ws[0].print.motif;
    // Seen from outside: s = right · t
    const sx = (t: number) => right * t;
    const box = {
      x0: Math.min(...ws.map(({ w }) => Math.min(sx(w.t0), sx(w.t1)))),
      x1: Math.max(...ws.map(({ w }) => Math.max(sx(w.t0), sx(w.t1)))),
      y0: ws.length > 1 ? R.railHeight : ws[0].w.y0,
      y1: Math.max(...ws.map(({ w }) => w.y1)),
    };
    const crop = coverCrop((box.x1 - box.x0) / (box.y1 - box.y0), ratio(motif));
    const parts = new Set(ws.map(({ p }) => p)).size;
    for (const { p, w } of ws) {
      const win = { x0: Math.min(sx(w.t0), sx(w.t1)), x1: Math.max(sx(w.t0), sx(w.t1)), y0: w.y0, y1: w.y1 };
      out.push({ t0: w.t0, t1: w.t1, y0: w.y0, y1: w.y1, part: p, light: w.light, motif, crop: cropWindow(crop, box, win), run: runs, runParts: parts });
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

/** Every decal on a counter as it stands (K20): on a part that is not open all over. */
export function podiumDecals(sections: readonly CounterSection[]): PlacedDecal[] {
  if (!sections.some((s) => s.sides)) return [];
  const out: PlacedDecal[] = [];
  for (const p of podiumParts(sections)) {
    if (!takesDecor(sections, p)) continue;
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

const partsBy = (sections: readonly CounterSection[], keys: readonly string[] | 'all') => {
  const want = keys === 'all' ? null : new Set(keys);
  return podiumParts(sections).filter((p) => (!want || want.has(partKey(p))) && takesDecor(sections, p));
};

/** The print ids used on a counter. */
const runsOf = (ss: readonly CounterSection[]) => ss.flatMap((s) => Object.values(s.sides ?? {}).flatMap((x) => (x.print ?? []).flatMap((q) => (q?.run ? [q.run] : []))));

/** Each light opening of `p` that takes print, with `fn` giving its print. */
function printEach(ss: readonly CounterSection[], p: PodiumPart, side: SectionSide | undefined, fn: (light: number) => PodiumPrint | null, lights?: readonly number[]): SectionSide | undefined {
  let out = side;
  for (const w of partWindows(ss, p)) if (!lights || lights.includes(w.light)) out = withAt(out, 'print', w.light, fn(w.light));
  return out;
}

/**
 * A colour no one sees is neither priced nor picked (V15, as `uncolourHidden` on a wall): a printed plate of counter
 * `id` has no colour of its own, and when every plate and sliding door of it is printed the counter takes its stock
 * colour again.
 */
export function uncolourPrinted(v: Variant, id: string): Variant {
  const x = withSections(v, id, (ss) =>
    podiumParts(ss).reduce((acc, p) => {
      const lights = printedLights(acc, p).filter((i) => acc[p.section]?.sides?.[sideKey(p.axis, p.out)]?.ral?.[i]);
      return onSides(acc, [p], (side) => lights.reduce((sd, i) => withAt(sd, 'ral', i, null), side));
    }, ss),
  );
  const o = x.objects.find((q) => q.id === id);
  if (!o?.sections || o.ral === undefined) return x;
  const plates = podiumParts(o.sections).flatMap((p) => partWindows(o.sections!, p).map((w) => printAt(o.sections!, p, w.light)));
  if (!plates.length || !plates.every(Boolean)) return x;
  const { ral: _r, ...rest } = o;
  return { ...x, objects: x.objects.map((q) => (q.id === id ? rest : q)) };
}

/**
 * The paint bucket with «Print» (K20, as `printWall`): one picture of `motif` over every plate and sliding door of the
 * parts `keys` (partKey) of counter `id`, or of every part that takes it (`all`), replacing their print and decals. On
 * plates that already show this one picture together it does nothing.
 */
export function printCounterSide(v: Variant, id: string, keys: readonly string[] | 'all', motif: string): Variant {
  const x = withSections(v, id, (ss) => {
    const parts = partsBy(ss, keys);
    const at = parts.flatMap((p) => partWindows(ss, p).map((w) => printAt(ss, p, w.light)));
    if (!at.length) return ss;
    const one = at.length === 1;
    if (at.every((q) => q?.motif === motif && (one ? !q.run : q.run && q.run === at[0]?.run))) return ss;
    const print: PodiumPrint = one ? { motif } : { motif, run: nextId(runsOf(ss), 'p') };
    return onSides(ss, parts, (side, p) => printEach(ss, p, withSideField(side, 'decals', undefined), () => print));
  });
  return uncolourPrinted(x, id);
}

/**
 * The brush with «Print» on light opening `light` of part `key` (K20, as `printPlate`): the whole motif on that plate,
 * replacing its print and the decals on it. A plate that already has the whole of this motif is left as it is; one with
 * a share of a picture over more gets the whole motif.
 */
export function printCounterPlate(v: Variant, id: string, key: string, light: number, motif: string): Variant {
  const x = withSections(v, id, (ss) => {
    const p = podiumParts(ss).find((q) => partKey(q) === key);
    const w = p && partWindows(ss, p).find((x) => x.light === light);
    if (!p || !w) return ss;
    const cur = printAt(ss, p, light);
    if (cur?.motif === motif && !cur.run) return ss;
    const off = new Set(podiumDecals(ss).filter((d) => d.part === p && (d.y0 + d.y1) / 2 >= w.y0 - EPS && (d.y0 + d.y1) / 2 <= w.y1 + EPS).map((d) => d.decal.id));
    return onSides(ss, [p], (side) => {
      const decals = (side?.decals ?? []).filter((d) => !off.has(d.id));
      return printEach(ss, p, withSideField(side, 'decals', decals), () => ({ motif }), [light]);
    });
  });
  return uncolourPrinted(x, id);
}

/** The print taken off the parts `keys` of counter `id`: off light opening `light` of them, or all of them. */
export function unprintCounter(v: Variant, id: string, keys: readonly string[] | 'all', light?: number): Variant {
  return withSections(v, id, (ss) => {
    const parts = partsBy(ss, keys).filter((p) => (light === undefined ? printedLights(ss, p).length : printAt(ss, p, light)));
    return parts.length ? onSides(ss, parts, (side, p) => printEach(ss, p, side, () => null, light === undefined ? undefined : [light])) : ss;
  });
}

/** The sketch with a decal of `motif` in the middle of part `key` of counter `id`: as wide as the motif allows within
 *  80 % of the part, at most 600 × 600, in the middle of its height; it takes off the print on that side. */
export function addPodiumDecal(v: Variant, id: string, key: string, motif: string, ratio: number): { v: Variant; decal?: string } {
  const o = v.objects.find((x) => x.id === id);
  const p = o?.sections && podiumParts(o.sections).find((q) => partKey(q) === key);
  if (!o?.sections || !p || !takesDecor(o.sections, p)) return { v };
  const { lo, hi, span, mid } = decalRoom(o.sections, p);
  const r = ratio > 0 ? ratio : 1;
  let w = Math.min(600, span * 0.8);
  let h = w / r;
  if (h > Math.min(600, (hi - lo) * 0.6)) {
    h = Math.min(600, (hi - lo) * 0.6);
    w = h * r;
  }
  const taken = o.sections.flatMap((s) => Object.values(s.sides ?? {}).flatMap((x) => (x.decals ?? []).map((d) => d.id)));
  const decal: PodiumDecal = { id: nextId(taken, 'd'), motif, w: Math.round(w), h: Math.round(h), x: Math.round(mid), y: Math.round((lo + hi) / 2) };
  return { v: withSections(v, id, (ss) => onSides(ss, [p], (side) => withSideField(withSideField(side, 'print', undefined), 'decals', [...(side?.decals ?? []), decal]))), decal: decal.id };
}

/** The decal `decal` of counter `id` changed (moved, scaled, another motif) or taken off (null), kept on its part. */
export function updatePodiumDecal(v: Variant, id: string, decal: string, patch: Partial<Omit<PodiumDecal, 'id'>> | null): Variant {
  return withSections(v, id, (ss) => {
    const at = podiumDecals(ss).find((x) => x.decal.id === decal);
    if (!at) return ss;
    return onSides(ss, [at.part], (side) => {
      const list = (side?.decals ?? []).flatMap((d) => (d.id !== decal ? [d] : patch ? [kept(ss, at.part, { ...d, ...patch })] : []));
      return withSideField(side, 'decals', list);
    });
  });
}

/** Where a decal can go on a part: from the bottom rail (lo) to the highest plate top (hi), mm up, `span` between the
 *  posts and the part's middle as a decal's `x` (from the middle of the section's side, seen from outside). */
function decalRoom(sections: readonly CounterSection[], p: PodiumPart) {
  const hi = Math.max(...partWindows(sections, p).map((w) => w.y1));
  return { lo: R.railHeight, hi, span: p.b - p.a - 2 * R.joint, mid: rightOf(p.axis, p.out) * ((p.a + p.b) / 2 - sideMid(sections, p)) };
}

/** A decal held within its part's plates, mm: no smaller than 50, no bigger than the part. */
function kept(sections: readonly CounterSection[], p: PodiumPart, d: PodiumDecal): PodiumDecal {
  const { lo, hi, span, mid } = decalRoom(sections, p);
  const w = Math.round(Math.max(50, Math.min(d.w, span)));
  const h = Math.round(Math.max(50, Math.min(d.h, hi - lo)));
  const x = Math.round(Math.max(mid - (span - w) / 2, Math.min(mid + (span - w) / 2, d.x)));
  const y = Math.round(Math.max(lo + h / 2, Math.min(hi - h / 2, d.y)));
  return { ...d, w, h, x, y };
}

/** What a counter's print and decals cost (K20, as on a wall): m² of print over its plates and doors, the decals' m²,
 *  the parts printed, and the prints stretched over more than one part (a print setup each). */
export function podiumDecorAreas(sections: readonly CounterSection[]): { full: number; decal: number; parts: number; runs: number; sizes: Map<string, number> } {
  const prints = podiumPrints(sections, () => 1);
  const full = prints.reduce((a, w) => a + ((w.t1 - w.t0) * (w.y1 - w.y0)) / 1e6, 0);
  const decal = podiumDecals(sections).reduce((a, d) => a + (d.decal.w * d.decal.h) / 1e6, 0);
  const parts = new Set(prints.map((w) => partKey(w.part)));
  // The foil is cut per plate or door it covers: how many of each size, B × H in mm (Byggeregel K20)
  const sizes = new Map<string, number>();
  for (const w of prints) {
    const k = `${Math.round(w.t1 - w.t0)} × ${Math.round(w.y1 - w.y0)}`;
    sizes.set(k, (sizes.get(k) ?? 0) + 1);
  }
  return { full, decal, parts: parts.size, runs: new Set(prints.filter((w) => w.runParts > 1).map((w) => w.run)).size, sizes };
}
