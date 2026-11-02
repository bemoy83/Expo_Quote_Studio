// Print på hele plater: «Print» last in the wall drawer's palette, with the motif chosen in the graphics shelf.
// The paint bucket stretches one motif over every plate of the face that can take it: one picture, cut per plate,
// running on behind the posts and over a door, so it lines up across the joints. The brush puts the whole motif on
// one plate. A print is foil over the whole plate on one face, over the plate's colour (which is both faces), and it
// replaces the decals on its plate. A colour painted on a face takes the print off there; decals stay (Bjørn 2.11.2026).
// Textile frames are skipped; doors take print on leaf and header; curtains and plates of another wall do not.
import type { Rules } from '../rules/rules';
import { wallLength } from './grid';
import { felt, freeFelts, sideOf, type FaceSide } from './decor';
import { nextId } from './edit';
import type { Foil, Variant, Wall } from './types';

export type Crop = NonNullable<Foil['crop']>;

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** The window of a motif (width / height `ratio`) that covers a face of this aspect: cropped, centred, never stretched. */
export function coverCrop(aspect: number, ratio: number): Crop {
  const r = ratio > 0 ? ratio : aspect;
  const ww = aspect > r ? 1 : aspect / r;
  const wh = aspect > r ? r / aspect : 1;
  return [(1 - ww) / 2, (1 - wh) / 2, (1 + ww) / 2, (1 + wh) / 2];
}

/** The part of `crop` on the band from height `lo` to `hi` of a plate whose crop spans `y0` to `y1` (metres). */
export function cropBand(crop: Crop, y0: number, y1: number, lo: number, hi: number): Crop {
  const k = (crop[3] - crop[1]) / (y1 - y0);
  return [crop[0], crop[1] + (y1 - hi) * k, crop[2], crop[1] + (y1 - lo) * k];
}

/** Plates (module indices) of a face that can take print. */
export const printPlates = (v: Variant, rules: Rules, w: Wall, s: FaceSide): number[] => freeFelts(v, rules, w.id, s, true);

/** A face's print: the foils covering whole plates on it. */
export const printsOn = (v: Variant, wallId: string, s: FaceSide): Foil[] => v.foils.filter((f) => f.full && f.wallId === wallId && sideOf(v, f) === s);

/**
 * The part of a motif (width / height `ratio`) on each plate when it is stretched over these plates: the picture
 * covers the span from the first plate to the last as seen from the face (cropped, never stretched out of shape,
 * centred), and each plate shows its window of it. Posts and gaps between the plates hide their strip of it.
 */
export function stretchCrops(rules: Rules, w: Wall, s: FaceSide, modules: number[], ratio: number): Map<number, Crop> {
  const L = wallLength(w);
  // Along the face as seen standing in front of it: left to right
  const span = modules.map((i) => {
    const f = felt(rules, i);
    return { i, x0: s === 1 ? f.a : L - f.b, x1: s === 1 ? f.b : L - f.a, h: f.h };
  });
  const out = new Map<number, Crop>();
  if (!span.length) return out;
  const left = Math.min(...span.map((p) => p.x0));
  const W = Math.max(...span.map((p) => p.x1)) - left;
  const H = span[0].h;
  const [wx, wy, wx1, wy1] = coverCrop(W / H, ratio);
  const ww = wx1 - wx;
  const wh = wy1 - wy;
  for (const p of span) out.set(p.i, [r4(wx + ((p.x0 - left) / W) * ww), r4(wy), r4(wx + ((p.x1 - left) / W) * ww), r4(wy + wh)]);
  return out;
}

const plateFoil = (id: string, w: Wall, module: number, s: FaceSide, motif: string): Foil => ({ id, wallId: w.id, module, side: s, full: true, width: 0, height: 0, x: 0, y: 0, motif });

/** Take foil off these plates of a face: the prints (`decals` too) go, the rest stays. */
function strip(v: Variant, w: Wall, s: FaceSide, modules: ReadonlySet<number>, decals: boolean): Foil[] {
  return v.foils.filter((f) => !(f.wallId === w.id && sideOf(v, f) === s && modules.has(f.module) && (decals || f.full)));
}

/** Fit a full-plate foil to its felt, as decor.ts does for every foil. */
function fit(rules: Rules, f: Foil): Foil {
  const fe = felt(rules, f.module);
  return { ...f, width: fe.w, height: fe.h, x: 0, y: Math.round(((fe.y0 + fe.y1) / 2) * 1000) / 1000 };
}

/**
 * The paint bucket with «Print»: the motif stretched over every plate of the face that can take it, replacing the
 * prints and decals there. Clicked again on a face that already carries this print, it takes the print off.
 */
export function printWall(v: Variant, rules: Rules, wallId: string, s: FaceSide, motif: string, ratio: number): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return v;
  const plates = printPlates(v, rules, w, s);
  if (!plates.length) return v;
  const on = printsOn(v, w.id, s);
  const same = plates.every((i) => on.some((f) => f.module === i && f.motif === motif && (plates.length === 1 || f.run)));
  const runs = new Set(on.filter((f) => plates.includes(f.module)).map((f) => f.run));
  if (same && runs.size === 1) return { ...v, foils: strip(v, w, s, new Set(plates), false) };
  const kept = strip(v, w, s, new Set(plates), true);
  const ids = kept.map((f) => f.id);
  const run = plates.length > 1 ? nextId([...new Set(v.foils.map((f) => f.run).filter((x): x is string => !!x))], 'p') : undefined;
  const crops = stretchCrops(rules, w, s, plates, ratio);
  const added = plates.map((i) => {
    const id = nextId(ids, 'f');
    ids.push(id);
    return fit(rules, { ...plateFoil(id, w, i, s, motif), ...(run ? { run, crop: crops.get(i) } : {}) });
  });
  return { ...v, foils: [...kept, ...added] };
}

/**
 * The brush with «Print» on one plate: the whole motif on it, replacing its print and decals. A plate that already
 * carries this motif loses it (as the brush gives a plate its wall's colour back).
 */
export function printPlate(v: Variant, rules: Rules, wallId: string, module: number, s: FaceSide, motif: string): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w || !printPlates(v, rules, w, s).includes(module)) return v;
  const cur = printsOn(v, w.id, s).find((f) => f.module === module);
  if (cur?.motif === motif) return { ...v, foils: v.foils.filter((f) => f.id !== cur.id) };
  const kept = strip(v, w, s, new Set([module]), true);
  const id = nextId(kept.map((f) => f.id), 'f');
  return { ...v, foils: [...kept, fit(rules, plateFoil(id, w, module, s, motif))] };
}

/** A colour painted on a face (all plates, or the given ones) takes the print off there. Decals stay. */
export function clearPrint(v: Variant, wallId: string, s: FaceSide, modules?: Iterable<number>): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return v;
  const set = modules ? new Set(modules) : null;
  const foils = v.foils.filter((f) => !(f.full && f.wallId === w.id && sideOf(v, f) === s && (!set || set.has(f.module))));
  return foils.length === v.foils.length ? v : { ...v, foils };
}

/** Stretched prints that still cover more than one plate: each needs its print file fitted and cut per plate. */
export function stretchedRuns(v: Variant): Map<string, Foil[]> {
  const walls = new Set(v.walls.map((w) => w.id));
  const out = new Map<string, Foil[]>();
  for (const f of v.foils) if (f.run && f.full && walls.has(f.wallId)) out.set(f.run, [...(out.get(f.run) ?? []), f]);
  for (const [k, fs] of out) if (fs.length < 2) out.delete(k);
  return out;
}
