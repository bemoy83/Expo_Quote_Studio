// Byggeregel V15: the last stroke wins, the same motif again does nothing, door parts print apart.
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
import { moduleCc, moduleCount, moduleStart, pointAlong, wallLength } from './grid';
import { fitFoil, foilBlocked, freeFelts, inBand } from './decor';
import { uncolourPlates } from './plateDecor';
import { roomAt, roomOf } from './rooms';
import { builtModules } from './walls';
import { setWallPlate } from './edit';
import type { DoorSurface, Foil, Variant, Wall } from './types';
import { doorWindows } from './doors';
import { nextId } from './ids';
import { faceNormal, faces, type FaceSide, felt, sideOf, upperFelt } from './faces';

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
export const fillPlates = (v: Variant, rules: Rules, w: Wall, s: FaceSide): number[] => printPlates(v, rules, w, s).filter((i) => !otherRoom(v, w, s, moduleStart(w, i) + moduleCc(w, i) / 2));

/** Upper felts (module indices, V20) of a raised wall's face that the paint bucket prints with its plates: every raised
 *  module, over a door too, except where a bakrom stands against the face. */
export const fillUppers = (v: Variant, rules: Rules, w: Wall, s: FaceSide): number[] =>
  w.raise ? Array.from({ length: moduleCount(w) }, (_, i) => i).filter((i) => !foilBlocked(v, rules, w.id, i, s, true, true) && !otherRoom(v, w, s, moduleStart(w, i) + moduleCc(w, i) / 2)) : [];

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
    const f = felt(rules, moduleStart(w, i), moduleCc(w, i));
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

/**
 * The parts of a motif on plates and upper felts when it is stretched over a raised wall's face (V20): one picture over
 * the box from the lowest plate to the highest upper felt, the middle rail hiding its strip of it as the posts do. Keyed
 * `module` for a plate, `module/upper` for an upper felt.
 */
export function stretchCropsHigh(rules: Rules, w: Wall, s: FaceSide, plates: number[], uppers: number[], ratio: number): Map<string, Crop> {
  const L = wallLength(w);
  const win = (k: string, f: { a: number; b: number; y0: number; y1: number }) => ({ k, x0: s === 1 ? f.a : L - f.b, x1: s === 1 ? f.b : L - f.a, y0: f.y0, y1: f.y1 });
  const all = [
    ...plates.map((i) => win(String(i), felt(rules, moduleStart(w, i), moduleCc(w, i)))),
    ...uppers.map((i) => win(`${i}/upper`, upperFelt(rules, moduleStart(w, i), moduleCc(w, i), w.raise ?? 0))),
  ];
  const out = new Map<string, Crop>();
  if (!all.length) return out;
  const box = { x0: Math.min(...all.map((p) => p.x0)), x1: Math.max(...all.map((p) => p.x1)), y0: Math.min(...all.map((p) => p.y0)), y1: Math.max(...all.map((p) => p.y1)) };
  const crop = coverCrop((box.x1 - box.x0) / (box.y1 - box.y0), ratio);
  for (const p of all) out.set(p.k, cropWindow(crop, box, p).map(r4) as Crop);
  return out;
}

const plateFoil = (id: string, w: Wall, module: number, s: FaceSide, motif: string, upper = false): Foil => ({ id, wallId: w.id, module, side: s, full: true, width: 0, height: 0, x: 0, y: 0, motif, ...(upper && { upper: true as const }) });

/** Take all foil off these plates of a face, prints and decals: a print replaces them. `uppers`: the upper felts (V20). */
function strip(v: Variant, w: Wall, s: FaceSide, modules: ReadonlySet<number>, uppers: ReadonlySet<number> = new Set()): Foil[] {
  return v.foils.filter((f) => !(f.wallId === w.id && sideOf(v, f) === s && (f.upper ? uppers : modules).has(f.module)));
}

/**
 * The paint bucket with «Print»: the motif stretched over every plate of the face that can take it (not inside a
 * bakrom standing against it), replacing the prints and decals there. Clicked again on a face that already carries
 * this print, it does nothing: the same motif again never takes a print off (Bjørn 18.11.2026); a colour or the trash does.
 */
export function printWall(v: Variant, rules: Rules, wallId: string, s: FaceSide, motif: string, ratio: number): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return v;
  const plates = fillPlates(v, rules, w, s);
  // A raised wall: the upper felts too, one picture over the full height (V20)
  const uppers = fillUppers(v, rules, w, s);
  const all = [...plates.map((i) => ({ i, up: false })), ...uppers.map((i) => ({ i, up: true }))];
  if (!all.length) return v;
  const on = printsOn(v, w.id, s);
  const has = (f: Foil) => all.some((p) => p.i === f.module && inBand(f, p.up));
  const same = all.every((p) => on.some((f) => f.module === p.i && inBand(f, p.up) && f.motif === motif && (all.length === 1 || f.run)));
  const runs = new Set(on.filter(has).map((f) => f.run));
  if (same && runs.size === 1) return v;
  const kept = strip(v, w, s, new Set(plates), new Set(uppers));
  const ids = kept.map((f) => f.id);
  const run = all.length > 1 ? nextId([...new Set(v.foils.map((f) => f.run).filter((x): x is string => !!x))], 'p') : undefined;
  const low = uppers.length ? null : stretchCrops(rules, w, s, plates, ratio);
  const high = uppers.length ? stretchCropsHigh(rules, w, s, plates, uppers, ratio) : null;
  const added = all.map(({ i, up }) => {
    const id = nextId(ids, 'f');
    ids.push(id);
    const crop = low ? low.get(i) : high!.get(up ? `${i}/upper` : String(i));
    return fitFoil(v, { ...plateFoil(id, w, i, s, motif, up), ...(run ? { run, crop } : {}) }, rules, 0);
  });
  return uncolourHidden({ ...v, foils: [...kept, ...added] }, w.id);
}

/**
 * The brush with «Print» on one plate: the whole motif on it, replacing its print and decals. A plate that already
 * carries the whole of this motif is left as it is (Bjørn 18.11.2026); a part of a stretched print gets the whole motif.
 */
export function printPlate(v: Variant, rules: Rules, wallId: string, module: number, s: FaceSide, motif: string, upper = false): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  // The upper felt of a raised plate (V20) is printed on its own, the plate under it left as it is
  if (!w || (upper ? !!foilBlocked(v, rules, w.id, module, s, true, true) : !printPlates(v, rules, w, s).includes(module))) return v;
  const cur = printsOn(v, w.id, s).find((f) => f.module === module && inBand(f, upper));
  if (cur?.motif === motif && !cur.run) return v;
  const one = new Set([module]);
  const kept = upper ? strip(v, w, s, new Set(), one) : strip(v, w, s, one);
  const id = nextId(kept.map((f) => f.id), 'f');
  return uncolourHidden({ ...v, foils: [...kept, fitFoil(v, plateFoil(id, w, module, s, motif, upper), rules, 0)] }, w.id);
}

const OTHER: Record<DoorSurface, DoorSurface> = { header: 'leaf', leaf: 'header' };

/** Whether a print shows on a door's surface `part`: one over both does, one on a single surface only there. */
export const onDoorPart = (f: Pick<Foil, 'door'>, part: DoorSurface) => !f.door || f.door === part;

/**
 * Print with the brush on one surface of a door (Bjørn 18.11.2026): the whole motif on the header or the leaf, its
 * window of the plate. A picture over both keeps showing on the other surface; the same motif again does nothing.
 */
export function printDoorPart(v: Variant, rules: Rules, wallId: string, module: number, s: FaceSide, motif: string, part: DoorSurface): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w || !printPlates(v, rules, w, s).includes(module)) return v;
  const here = printsOn(v, w.id, s).filter((f) => f.module === module && !f.upper);
  if (here.some((f) => f.door === part && f.motif === motif)) return v;
  const kept = withoutDoorPart(v, w.id, s, module, part).foils;
  const win = doorWindows(rules)[part];
  const id = nextId(v.foils.map((f) => f.id), 'f');
  const foil: Foil = { id, wallId: w.id, module, side: s, full: true, width: r4(win.w), height: r4(win.y1 - win.y0), x: 0, y: r4((win.y0 + win.y1) / 2), motif, door: part };
  // Decals on the door go, as on a plate
  return { ...v, foils: [...kept.filter((f) => !(f.wallId === w.id && f.module === module && sideOf(v, f) === s && !f.full && !f.upper)), foil] };
}

/**
 * The print taken off one surface of a door on face s (a colour on the header or the leaf: the last stroke wins): a
 * print on that surface goes, a picture over both stays on the other surface only.
 */
export function withoutDoorPart(v: Variant, wallId: string, s: FaceSide, module: number, part: DoorSurface): Variant {
  let changed = false;
  const foils = v.foils.flatMap((f) => {
    if (!(f.full && !f.upper && f.wallId === wallId && f.module === module && sideOf(v, f) === s && onDoorPart(f, part))) return [f];
    changed = true;
    return f.door ? [] : [{ ...f, door: OTHER[part] }];
  });
  return changed ? { ...v, foils } : v;
}

/**
 * Plates (module keys) whose colour shows nowhere: every face that can carry decor is printed over the whole plate. A
 * stand wall has one such face (the other is the neighbour's or the aisle's), an inner or room wall two. Doors and
 * curtains are not plates.
 */
export function hiddenPlates(v: Variant): Set<string> {
  // The plate's own print: one on the upper felt (V20) does not hide it
  const printed = new Set(v.foils.filter((f) => f.full && !f.upper).map((f) => `${f.wallId}:${f.module}:${sideOf(v, f)}`));
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
export function uncolourHidden(v: Variant, wallId: string): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return v;
  const hidden = hiddenPlates(v);
  const room = roomOf(v, w);
  const walls = new Set((room ? v.walls.filter((x) => x.room?.id === room.id) : [w]).map((x) => x.id));
  const own = builtModules(v).filter((m) => walls.has(m.wallId) && !m.opening);
  const next = uncolourPlates(v, own.filter((m) => hidden.has(m.key)).map((m) => m.key));
  const coloured = (room ? room.plate : w.plate) !== undefined;
  return coloured && own.length && own.every((m) => hidden.has(m.key)) ? setWallPlate(next, w.id, next.defaultPlate) : next;
}

/** A colour painted on a face (all plates, or the given ones) takes the print off there. Decals stay. `upper`: only
 *  on the plates (false) or only on their upper felts (true, V20); none: both. */
export function clearPrint(v: Variant, wallId: string, s: FaceSide, modules?: Iterable<number>, upper?: boolean): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return v;
  const set = modules ? new Set(modules) : null;
  const foils = v.foils.filter((f) => !(f.full && f.wallId === w.id && sideOf(v, f) === s && (!set || set.has(f.module)) && (upper === undefined || inBand(f, upper))));
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
