// Print på hele plater: «Print» last in the wall drawer's palette, with the motif chosen in the graphics shelf.
// The paint bucket stretches one motif over every plate of the face that can take it: one picture, cut per plate,
// running on behind the posts and over a door, so it lines up across the joints. The brush puts the whole motif on
// one plate. A print is foil over the whole plate on one face, over the plate's colour (which is both faces), and it
// replaces the decals on its plate. The last stroke wins (Bjørn 3.11.2026): a colour painted on a face takes the print
// off there (decals stay), and a print that leaves a plate's colour showing nowhere takes that colour away (see
// `hiddenPlates`), so the plate is neither priced nor picked in a colour no one sees.
// Textile frames are skipped; doors take print on leaf and header; curtains and plates of another wall do not. The
// bucket also leaves the stretch inside a bakrom that stands against the face; the brush can still print there.
import type { Rules } from '../rules/rules';
import { moduleCc, pointAlong, wallLength, wallModules } from './grid';
import { fitFoil, freeFelts } from './decor';
import { clearPanels } from './panels';
import { roomAt, roomOf } from './rooms';
import { builtModules } from './walls';
import { setWallPlate } from './edit';
import type { Foil, Variant, Wall } from './types';
import { nextId } from './ids';
import { faceNormal, faces, type FaceSide, felt, sideOf } from './faces';

export type Crop = NonNullable<Foil['crop']>;

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** The window of a motif (width / height `ratio`) that covers a face of this aspect: cropped, centred, never stretched. */
export function coverCrop(aspect: number, ratio: number): Crop {
  const r = ratio > 0 ? ratio : aspect;
  const ww = aspect > r ? 1 : aspect / r;
  const wh = aspect > r ? r / aspect : 1;
  return [(1 - ww) / 2, (1 - wh) / 2, (1 + ww) / 2, (1 + wh) / 2];
}

/** The part of the motif a full-plate foil shows: its share of a stretched print, else the whole motif cropped to the plate. */
export const plateCrop = (f: Foil, ratio: number): Crop => f.crop ?? coverCrop(f.width / f.height, ratio);

/**
 * The part of `crop` (the picture over the box x0…x1, y0…y1, x left to right as seen from the face, y up) that shows
 * through a window inside the box.
 */
export function cropWindow(crop: Crop, box: { x0: number; x1: number; y0: number; y1: number }, win: { x0: number; x1: number; y0: number; y1: number }): Crop {
  const kx = (crop[2] - crop[0]) / (box.x1 - box.x0);
  const ky = (crop[3] - crop[1]) / (box.y1 - box.y0);
  return [crop[0] + (win.x0 - box.x0) * kx, crop[1] + (box.y1 - win.y1) * ky, crop[0] + (win.x1 - box.x0) * kx, crop[1] + (box.y1 - win.y0) * ky];
}

/** True where another room stands in front of the face at offset t: that stretch is the inside of a bakrom. */
function otherRoom(v: Variant, w: Wall, s: FaceSide, t: number): boolean {
  const [x, y] = pointAlong(w, t);
  const [nx, ny] = faceNormal(w, s);
  const r = roomAt(v, x + nx * 0.25, y + ny * 0.25);
  return !!r && r.id !== w.room?.id;
}

/** Plates (module indices) of a face that can take print (the brush). */
export const printPlates = (v: Variant, rules: Rules, w: Wall, s: FaceSide): number[] => freeFelts(v, rules, w.id, s, true);

/** Plates the paint bucket fills: those that can take print, except where a bakrom stands against the face (Bjørn 2.11.2026). */
export const fillPlates = (v: Variant, rules: Rules, w: Wall, s: FaceSide): number[] => printPlates(v, rules, w, s).filter((i) => !otherRoom(v, w, s, i + moduleCc(w, i) / 2));

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
    const f = felt(rules, i, moduleCc(w, i));
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

/**
 * The paint bucket with «Print»: the motif stretched over every plate of the face that can take it (not inside a
 * bakrom standing against it), replacing the prints and decals there. Clicked again on a face that already carries
 * this print, it takes the print off.
 */
export function printWall(v: Variant, rules: Rules, wallId: string, s: FaceSide, motif: string, ratio: number): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return v;
  const plates = fillPlates(v, rules, w, s);
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
    return fitFoil(v, { ...plateFoil(id, w, i, s, motif), ...(run ? { run, crop: crops.get(i) } : {}) }, rules, 0);
  });
  return uncolourHidden({ ...v, foils: [...kept, ...added] }, w.id);
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
  return uncolourHidden({ ...v, foils: [...kept, fitFoil(v, plateFoil(id, w, module, s, motif), rules, 0)] }, w.id);
}

/**
 * Plates (module keys) whose colour shows nowhere: every face that can carry decor is printed over the whole plate. A
 * stand wall has one such face (the other is the neighbour's or the aisle's), an inner or room wall two. Doors and
 * curtains are not plates.
 */
export function hiddenPlates(v: Variant): Set<string> {
  const printed = new Set(v.foils.filter((f) => f.full).map((f) => `${f.wallId}:${f.module}:${sideOf(v, f)}`));
  const byId = new Map(v.walls.map((w) => [w.id, w]));
  const out = new Set<string>();
  for (const m of builtModules(v)) {
    const w = byId.get(m.wallId);
    if (w && !m.opening && faces(v, w).every((s) => printed.has(`${w.id}:${m.index}:${s}`))) out.add(m.key);
  }
  return out;
}

/**
 * Print over a colour: the plates of this wall that the print now hides lose their own colour, and when it hides all
 * of the wall (a room: all of the room) the wall's own colour goes too. They take the stand's colour again.
 */
function uncolourHidden(v: Variant, wallId: string): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return v;
  const hidden = hiddenPlates(v);
  const room = roomOf(v, w);
  const walls = new Set((room ? v.walls.filter((x) => x.room?.id === room.id) : [w]).map((x) => x.id));
  const own = builtModules(v).filter((m) => walls.has(m.wallId) && !m.opening);
  const next = clearPanels(v, own.filter((m) => hidden.has(m.key)).map((m) => m.key));
  const coloured = (room ? room.plate : w.plate) !== undefined;
  return coloured && own.length && own.every((m) => hidden.has(m.key)) ? setWallPlate(next, w.id, next.defaultPlate) : next;
}

/** A colour painted on a face (all plates, or the given ones) takes the print off there. Decals stay. */
export function clearPrint(v: Variant, wallId: string, s: FaceSide, modules?: Iterable<number>): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return v;
  const set = modules ? new Set(modules) : null;
  const foils = v.foils.filter((f) => !(f.full && f.wallId === w.id && sideOf(v, f) === s && (!set || set.has(f.module))));
  return foils.length === v.foils.length ? v : { ...v, foils };
}

/**
 * The wall drawer's trash with the whole wall chosen: the wall back to plain. Its foil goes from both faces, prints
 * and decals, and its plates lose their own colours, so they take the wall's again. Textile frames stay: they are
 * things of their own.
 */
export function clearDecor(v: Variant, wallId: string): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return v;
  const foils = v.foils.filter((f) => f.wallId !== w.id);
  const own = new Set(builtModules(v).filter((m) => m.wallId === w.id).map((m) => m.key));
  const cleared = clearPanels(v, wallModules(w).map((m) => m.key).filter((k) => own.has(k)));
  return foils.length === v.foils.length && cleared === v ? v : { ...cleared, foils };
}

/**
 * The wall drawer's trash with one felt chosen (Bjørn 9.11.2026): the plate's own colour and the print on this face go,
 * so the plate shows its wall's colour again. Decals and shelves stay; they are removed one by one.
 */
export function clearFelt(v: Variant, wallId: string, module: number, s: FaceSide): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  const key = w && wallModules(w)[module]?.key;
  if (!w || !key) return v;
  const own = builtModules(v).some((m) => m.key === key && m.wallId === w.id);
  return clearPrint(own ? clearPanels(v, [key]) : v, w.id, s, [module]);
}

/** Stretched prints that still cover more than one plate: each needs its print file fitted and cut per plate. */
export function stretchedRuns(v: Variant): Map<string, Foil[]> {
  const walls = new Set(v.walls.map((w) => w.id));
  const out = new Map<string, Foil[]>();
  for (const f of v.foils) if (f.run && f.full && walls.has(f.wallId)) out.set(f.run, [...(out.get(f.run) ?? []), f]);
  for (const [k, fs] of out) if (fs.length < 2) out.delete(k);
  return out;
}
