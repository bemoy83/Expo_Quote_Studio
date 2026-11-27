// Colour and print on the surfaces of a wall, in one place (Byggeregler V15 og V16, Bjørn 18.11.2026): every way of colouring goes through here,
// the drawer, the pill, the wall pen in the plan and Fyll, so they follow the same rules.
//
// - A surface is a plate (a felt), a door's header and its leaf (each with its own colour and print), a counter's plate (each light opening of a part, its sliding door one
//   surface: K6) or, later, a header.
// - The last stroke wins on what you point at: a colour on one plate or door leaf takes the print off it on the face
//   shown (decals stay: they do not cover the whole plate).
// - Print is a deliberate choice: a stroke over many surfaces (the paint bucket, the pill's colour for the whole wall,
//   Fyll) leaves the printed plates as they are, print and colour, so the rest can be recoloured without laying the
//   print on again. Fyll on the whole stand can be asked to colour them too (`paintAllWalls` with `prints: 'off'`).
// - The same motif again does nothing (printWall, printPlate in print.ts).
import { doorRal, setDoorRal } from './doors';
import { COUNTER_STOCK_RAL, counterRal } from './objects';
import { printAt, unprintCounter } from './podiumDecor';
import { partKey, podiumParts, ralsOf, setPlateRal, type PodiumPart } from './podiumFaces';
import { withSections } from './podiumSections';
import { setWallPlate } from './edit';
import type { FaceSide } from './faces';
import { wallModules } from './grid';
import { colourPlates, colourUpper, uncolourAll, uncolourPlates, uncolourUpper, wallRal } from './plateDecor';
import { clearPrint, hiddenPlates, printsOn, uncolourHidden, withoutDoorPart } from './print';
import { roomOf } from './rooms';
import type { CounterSection, DoorSurface, PlacedObject, Variant, Wall } from './types';
import { builtModules, type BuiltModule } from './walls';

/** A stroke and how many printed surfaces it left as they were (for the toast). */
export interface Painted {
  v: Variant;
  /** Printed plates and door leaves the stroke went past. */
  skipped: number;
}

/** The colour a plate has without its own: its owning wall's. */
const plateBase = (v: Variant) => {
  const byKey = new Map(builtModules(v).map((m) => [m.key, m]));
  return (key: string) => {
    const w = v.walls.find((x) => x.id === byKey.get(key)?.wallId);
    return w ? wallRal(v, w) : v.defaultPlate;
  };
};

/** The walls a colour on `w` reaches: a room's walls all take the room's colour. */
function reach(v: Variant, w: Wall): Set<string> {
  const room = roomOf(v, w);
  return new Set((room ? v.walls.filter((x) => x.room?.id === room.id) : [w]).map((x) => x.id));
}

/**
 * Keep the printed surfaces as they were before a stroke: each plate in `mods` keeps its colour (unless the print hides
 * it everywhere, so it has none of its own) and each door leaf its RAL.
 */
function keepPrinted(before: Variant, after: Variant, mods: readonly BuiltModule[]): Variant {
  const hidden = hiddenPlates(before);
  let x = after;
  const base = plateBase(x);
  for (const m of mods) {
    if (m.opening) x = setDoorRal(x, m.opening.id, doorRal(before, m.opening));
    else if (!hidden.has(m.key)) x = colourPlates(x, [m.key], m.plate, base);
  }
  return x;
}

/**
 * The paint bucket on a face (the wall drawer's bucket, the wall pill's colours): the whole wall in `ral`, its door
 * leaves too (the door is part of the wall), a room wall the whole room. The plates and doors printed on this face are
 * left as they are, print and colour.
 */
export function paintWallFace(v: Variant, wallId: string, s: FaceSide, ral: string): Painted {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return { v, skipped: 0 };
  const walls = reach(v, w);
  const printed = new Set(printsOn(v, w.id, s).map((f) => f.module));
  const kept = builtModules(v).filter((m) => m.wallId === w.id && printed.has(m.index));
  let x = setWallPlate(v, w.id, ral);
  x = v.openings.filter((o) => walls.has(o.wallId)).reduce((y, o) => setDoorRal(y, o.id, ral), x);
  // A colour no one sees is neither priced nor picked: plates the print hides keep none of their own (print.ts)
  const out = uncolourHidden(keepPrinted(v, x, kept), w.id);
  return { v: sameWalls(out, v) ? v : out, skipped: kept.length };
}

/** Nothing changed that a stroke could: the walls, rooms, plates and doors are as they were. */
const sameWalls = (a: Variant, b: Variant) =>
  JSON.stringify([a.walls, a.rooms, a.decor, a.openings]) === JSON.stringify([b.walls, b.rooms, b.decor, b.openings]);

/** A colour on one plate of a face (the brush, a felt's palette, the wall pen): the last stroke wins, so its print on
 *  this face comes off. Decals stay. `ral` back to the wall's own colour drops the plate's own. */
export function paintPlate(v: Variant, wallId: string, s: FaceSide, module: number, key: string, ral: string): Variant {
  const x = colourPlates(v, [key], ral, plateBase(v));
  // A door's header is a surface of its own: only its print comes off, the leaf keeps its share (Bjørn 18.11.2026)
  if (builtModules(v).some((m) => m.key === key && m.opening)) return withoutDoorPart(x, wallId, s, module, 'header');
  return clearPrint(x, wallId, s, [module]);
}

/** A colour on the upper felt of raised plate `key` (Byggeregel V20, the felt's palette): a plate of its own over the
 *  middle rail. `ral` back to the wall's own colour drops its own. */
export const paintUpper = (v: Variant, key: string, ral: string): Variant => colourUpper(v, [key], ral, plateBase(v));

/** A colour on a door leaf (the brush on the leaf, the door's pill): as a plate, its print on this face comes off; the
 *  header keeps its share of a picture over both. */
export function paintLeaf(v: Variant, openingId: string, s: FaceSide, ral: string | null): Variant {
  const o = v.openings.find((x) => x.id === openingId);
  if (!o) return v;
  return withoutDoorPart(setDoorRal(v, o.id, ral), o.wallId, s, o.module, 'leaf');
}

/**
 * The wall pen on plates that stand (pressed on a plate, swept along its wall): each plate in `ral`, its print on the
 * face pressed coming off as with the brush. A plate in its wall's own colour has none of its own.
 */
export function paintPlatesAlong(v: Variant, wallId: string, s: FaceSide, keys: readonly string[], ral: string): Variant {
  const set = new Set(keys);
  const mods = builtModules(v).filter((m) => set.has(m.key));
  const x = colourPlates(v, keys, ral, plateBase(v));
  return clearPrint(x, wallId, s, mods.filter((m) => m.wallId === wallId).map((m) => m.index));
}

/** What Fyll does with the plates and doors that have print: leaves them as they are (the default), or colours them too
 *  and takes their print off. */
export type PrintChoice = 'keep' | 'off';

/** Plates and door leaves with a print on some face, as built. */
const printedModules = (v: Variant): BuiltModule[] => {
  const on = new Set(v.foils.filter((f) => f.full).map((f) => `${f.wallId}#${f.module}`));
  return builtModules(v).filter((m) => on.has(`${m.wallId}#${m.index}`));
};

/** How many plates and door leaves on the stand have print: Fyll asks about them. */
export const printedCount = (v: Variant): number => printedModules(v).length;

/**
 * Fyll on the Vegg pill and the stand's wall colour in the panel (Bjørn 11.11.2026, 18.11.2026): every wall on the stand
 * in one colour. It becomes the stand's colour, and the colours of their own on walls, rooms, single plates and door
 * leaves come off. Printed plates and doors stay as they are (`keep`, the default), or take the colour too and lose
 * their print (`off`). Decals and textile frames stay.
 */
export function paintAllWalls(v: Variant, ral: string, prints: PrintChoice = 'keep'): Painted {
  const all: Variant = {
    ...uncolourAll(v),
    defaultPlate: ral,
    walls: v.walls.map(({ plate: _w, ...w }) => w),
    rooms: v.rooms.map(({ plate: _r, ...r }) => r),
  };
  const printed = printedModules(v);
  if (prints === 'off') return { v: { ...all, foils: v.foils.filter((f) => !f.full) }, skipped: 0 };
  return { v: keepPrinted(v, all, printed), skipped: printed.length };
}

/**
 * The Vegg pill's Fyll with a door in hand: every door leaf in `ral`. Printed doors stay as they are (`keep`), or take
 * the colour and lose their print (`off`).
 */
export function paintAllDoors(v: Variant, ral: string, isDoor: (product: string) => boolean, prints: PrintChoice = 'keep'): Painted {
  const doors = v.openings.filter((o) => isDoor(o.product));
  const printedOn = new Set(v.foils.filter((f) => f.full).map((f) => `${f.wallId}#${f.module}`));
  const printed = doors.filter((o) => printedOn.has(`${o.wallId}#${o.module}`));
  const skip = prints === 'keep' ? new Set(printed.map((o) => o.id)) : new Set<string>();
  let x = doors.filter((o) => !skip.has(o.id)).reduce((y, o) => setDoorRal(y, o.id, ral), v);
  if (prints === 'off') {
    const off = new Set(printed.map((o) => `${o.wallId}#${o.module}`));
    x = { ...x, foils: x.foils.filter((f) => !(f.full && off.has(`${f.wallId}#${f.module}`))) };
  }
  return { v: x, skipped: skip.size };
}

// ---- Counters of Disker og podier (Byggeregel K6, Bjørn 18.11.2026): the same rules on a counter's plates. The counter
// has a colour (`PlacedObject.ral`), and each light opening of a part may have its own (`SectionSide.ral`) and its own
// print (`SectionSide.print`, K20), so each plate is a surface on its own, as on a wall.

const own = (o: Pick<PlacedObject, 'ral'>, ral: string) => (ral === counterRal(o) ? null : ral);
const partsOf = (ss: readonly CounterSection[], keys: readonly string[]) => {
  const want = new Set(keys);
  return podiumParts(ss).filter((p) => want.has(partKey(p)));
};

/** The plates (part and light opening) of `parts` with print, and the ones without. */
function byPrint(ss: readonly CounterSection[], parts: readonly PodiumPart[]) {
  const printed: [PodiumPart, number][] = [];
  const plain: [PodiumPart, number][] = [];
  for (const p of parts) ralsOf(ss, p).forEach((_, i) => (printAt(ss, p, i) ? printed : plain).push([p, i]));
  return { printed, plain };
}

/** The sections with each of `plates` in its colour from `ral`. */
const ralEach = (ss: readonly CounterSection[], plates: readonly [PodiumPart, number][], ral: (p: PodiumPart, i: number) => string | null) =>
  plates.reduce((x, [p, i]) => setPlateRal(x, [p], ral(p, i), i), ss as CounterSection[]);

/** A colour on what is chosen on a counter (a part, or light opening `light` of it): the last stroke wins, so the
 *  print comes off the plates coloured. Decals stay. The counter's own colour is stored as none. */
export function paintCounterPlates(v: Variant, id: string, keys: readonly string[], ral: string, light?: number): Variant {
  const o = v.objects.find((x) => x.id === id);
  if (!o?.sections) return v;
  const x = withSections(v, id, (ss) => setPlateRal(ss, partsOf(ss, keys), own(o, ral), light));
  return unprintCounter(x, id, keys, light);
}

/**
 * The paint bucket on the side shown, or its colour with nothing chosen: every plate of the parts `keys` in `ral`; a
 * plate with print is left as it is, print and colour (V16).
 */
export function paintCounterSide(v: Variant, id: string, keys: readonly string[], ral: string): Painted {
  const o = v.objects.find((x) => x.id === id);
  if (!o?.sections) return { v, skipped: 0 };
  const { printed, plain } = byPrint(o.sections, partsOf(o.sections, keys));
  return { v: withSections(v, id, (ss) => ralEach(ss, plain, () => own(o, ral))), skipped: printed.length };
}

/** A counter's sections with its colour `ral` and its plates' colours of their own off. The printed plates keep their
 *  print, and no colour: the print hides it (V15, `uncolourPrinted`). */
function recoloured(o: PlacedObject, ral: string): { o: PlacedObject; skipped: number } {
  const { ral: _r, ...rest } = o;
  const next: PlacedObject = ral === COUNTER_STOCK_RAL ? rest : { ...rest, ral };
  if (!o.sections) return { o: next, skipped: 0 };
  const { printed, plain } = byPrint(o.sections, podiumParts(o.sections));
  return { o: { ...next, sections: ralEach(o.sections, [...plain, ...printed], () => null) }, skipped: printed.length };
}

/** The counter's colour (the pill's colours): every plate of it in `ral`, colours of their own off; a printed plate
 *  stays as it is. */
export function paintCounter(v: Variant, id: string, ral: string): Painted {
  const o = v.objects.find((x) => x.id === id);
  if (!o) return { v, skipped: 0 };
  const r = recoloured(o, ral);
  return { v: { ...v, objects: v.objects.map((x) => (x.id === id ? r.o : x)) }, skipped: r.skipped };
}

/** Fyll with Disker og podier in hand: every counter and podium drawn in `ral`, as `paintCounter`. */
export function paintAllCounters(v: Variant, ral: string): Painted {
  let skipped = 0;
  const objects = v.objects.map((o) => {
    if (!o.sections) return o;
    const r = recoloured(o, ral);
    skipped += r.skipped;
    return r.o;
  });
  return { v: { ...v, objects }, skipped };
}

// ---- «Fjern farge og print» (Bjørn 19.11.2026): one way, in every drawer and on every build system, to take a surface
// back to plain. What is chosen loses its colour of its own and its print on the face shown, and so shows the colour of
// what it is part of: a plate its wall's, a wall the stand's, a door leaf the stand's, a counter's plate or side the
// counter's. Decals, shelves and textile frames stay: each is removed on its own.

/** What «Fjern farge og print» takes back to plain. */
export type ClearAt =
  /** A plate (`module`) of a wall, its upper felt with `upper` (V20), or with none the whole wall (a room wall: the
   *  whole room's colour). */
  | { kind: 'wall'; wallId: string; side: FaceSide; module?: number; upper?: boolean }
  /** A door's leaf or its header. */
  | { kind: 'door'; openingId: string; side: FaceSide; part: DoorSurface }
  /** The parts `keys` of a counter (the side shown), or light opening `light` of them. */
  | { kind: 'counter'; id: string; keys: readonly string[]; light?: number };

/** The surface `at` back to plain (see above). Nothing to take off leaves the sketch as it is. */
export function clearSurface(v: Variant, at: ClearAt): Variant {
  if (at.kind === 'counter') {
    const o = v.objects.find((x) => x.id === at.id);
    if (!o?.sections) return v;
    const x = withSections(v, at.id, (ss) => setPlateRal(ss, partsOf(ss, at.keys), null, at.light));
    return same(unprintCounter(x, at.id, at.keys, at.light), v);
  }
  if (at.kind === 'door') {
    const o = v.openings.find((x) => x.id === at.openingId);
    if (!o) return v;
    const key = builtModules(v).find((m) => m.opening?.id === o.id)?.key;
    const x = at.part === 'leaf' ? setDoorRal(v, o.id, null) : key ? uncolourPlates(v, [key]) : v;
    return same(withoutDoorPart(x, o.wallId, at.side, o.module, at.part), v);
  }
  const w = v.walls.find((x) => x.id === at.wallId);
  if (!w) return v;
  if (at.module !== undefined) {
    const key = wallModules(w)[at.module]?.key;
    if (!key) return v;
    const owned = builtModules(v).some((m) => m.key === key && m.wallId === w.id);
    if (at.upper) return same(uncolourUpper(v, [key]), v);
    return same(clearPrint(owned ? uncolourPlates(v, [key]) : v, w.id, at.side, [at.module]), v);
  }
  // The whole wall in the stand's colour, its doors too (the door is part of the wall), the print off the face shown
  const walls = reach(v, w);
  let x = setWallPlate(v, w.id, v.defaultPlate);
  x = v.openings.filter((o) => walls.has(o.wallId)).reduce((y, o) => setDoorRal(y, o.id, null), x);
  return same(clearPrint(x, w.id, at.side), v);
}

/** The surface `at` has something «Fjern farge og print» takes off (the button is grey otherwise). */
export const hasOwnDecor = (v: Variant, at: ClearAt): boolean => clearSurface(v, at) !== v;

/** `x`, or `v` itself when nothing a stroke can change did. */
const same = (x: Variant, v: Variant) => (x === v || (sameWalls(x, v) && JSON.stringify([x.foils, x.objects]) === JSON.stringify([v.foils, v.objects])) ? v : x);
