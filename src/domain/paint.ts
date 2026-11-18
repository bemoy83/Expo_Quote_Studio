// Colour and print on the surfaces of a wall, in one place (Bjørn 18.11.2026): every way of colouring goes through here,
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
import { setDoorRal } from './doors';
import { COUNTER_STOCK_RAL, counterRal } from './objects';
import { printOf, setPodiumPrint } from './podiumDecor';
import { partKey, podiumParts, ralsOf, setPlateRal } from './podiumFaces';
import { withSections } from './podiumSections';
import { setWallPlate } from './edit';
import type { FaceSide } from './faces';
import { setPanels, wallRal } from './panels';
import { clearPrint, hiddenPlates, printsOn, uncolourHidden, withoutDoorPart } from './print';
import { roomOf } from './rooms';
import type { CounterSection, PlacedObject, Variant, Wall } from './types';
import { builtModules, type BuiltModule } from './walls';

/** A stroke and how many printed surfaces it left as they were (for the toast). */
export interface Painted {
  v: Variant;
  /** Printed plates and door leaves the stroke went past. */
  skipped: number;
}

/** The colour a plate has without its own: its owning wall's. */
export const plateBase = (v: Variant) => {
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
    if (m.opening) {
      const ral = m.opening.ral ?? before.defaultPlate;
      x = { ...x, openings: x.openings.map((o) => (o.id === m.opening!.id ? withRal(o, ral, x.defaultPlate) : o)) };
    } else if (!hidden.has(m.key)) x = setPanels(x, [m.key], m.plate, base);
  }
  return x;
}

const withRal = <T extends { ral?: string }>(o: T, ral: string, def: string): T => {
  const { ral: _r, ...rest } = o;
  return (ral === def ? rest : { ...rest, ral }) as T;
};

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
  JSON.stringify([a.walls, a.rooms, a.panels, a.openings]) === JSON.stringify([b.walls, b.rooms, b.panels, b.openings]);

/** A colour on one plate of a face (the brush, a felt's palette, the wall pen): the last stroke wins, so its print on
 *  this face comes off. Decals stay. `ral` back to the wall's own colour drops the plate's own. */
export function paintPlate(v: Variant, wallId: string, s: FaceSide, module: number, key: string, ral: string): Variant {
  const x = setPanels(v, [key], ral, plateBase(v));
  // A door's header is a surface of its own: only its print comes off, the leaf keeps its share (Bjørn 18.11.2026)
  if (builtModules(v).some((m) => m.key === key && m.opening)) return withoutDoorPart(x, wallId, s, module, 'header');
  return clearPrint(x, wallId, s, [module]);
}

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
  const x = setPanels(v, keys, ral, plateBase(v));
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
  const { panels: _p, ...rest } = v;
  const all: Variant = {
    ...rest,
    defaultPlate: ral,
    walls: v.walls.map(({ plate: _w, ...w }) => w),
    rooms: v.rooms.map(({ plate: _r, ...r }) => r),
    openings: v.openings.map(({ ral: _o, ...o }) => o),
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
// has a colour (`PlacedObject.ral`), and each light opening of a part may have its own (`SectionSide.ral`). Print covers
// a whole part (K20), so a part with print is one printed surface.

const own = (o: Pick<PlacedObject, 'ral'>, ral: string) => (ral === counterRal(o) ? null : ral);
const partsOf = (ss: readonly CounterSection[], keys: readonly string[]) => {
  const want = new Set(keys);
  return podiumParts(ss).filter((p) => want.has(partKey(p)));
};

/** A colour on what is chosen on a counter (a part, or light opening `light` of it): the last stroke wins, so the
 *  part's print comes off. Decals stay. The counter's own colour is stored as none. */
export function paintCounterPlates(v: Variant, id: string, keys: readonly string[], ral: string, light?: number): Variant {
  const o = v.objects.find((x) => x.id === id);
  if (!o?.sections) return v;
  const x = withSections(v, id, (ss) => setPlateRal(ss, partsOf(ss, keys), own(o, ral), light));
  return setPodiumPrint(x, id, keys, null);
}

/**
 * The paint bucket on the side shown, or its colour with nothing chosen: every part `keys` in `ral`, all its light
 * openings; a part with print is left as it is, print and colour.
 */
export function paintCounterSide(v: Variant, id: string, keys: readonly string[], ral: string): Painted {
  const o = v.objects.find((x) => x.id === id);
  if (!o?.sections) return { v, skipped: 0 };
  const parts = partsOf(o.sections, keys);
  const printed = parts.filter((p) => printOf(o.sections!, p));
  const rest = parts.filter((p) => !printOf(o.sections!, p));
  return { v: withSections(v, id, (ss) => setPlateRal(ss, rest, own(o, ral))), skipped: printed.length };
}

/** A counter's sections with its colour `ral` and its parts' colours of their own off, except the printed parts:
 *  they keep the colours they had. */
function recoloured(o: PlacedObject, ral: string): { o: PlacedObject; skipped: number } {
  const { ral: _r, ...rest } = o;
  const next: PlacedObject = ral === COUNTER_STOCK_RAL ? rest : { ...rest, ral };
  if (!o.sections) return { o: next, skipped: 0 };
  const ss0 = o.sections;
  const parts = podiumParts(ss0);
  const printed = parts.filter((p) => printOf(ss0, p));
  let ss = setPlateRal(ss0, parts.filter((p) => !printOf(ss0, p)), null);
  const was = counterRal(o);
  for (const p of printed)
    ralsOf(ss0, p).forEach((r, i) => {
      ss = setPlateRal(ss, [p], own(next, r ?? was), i);
    });
  return { o: { ...next, sections: ss }, skipped: printed.length };
}

/** The counter's colour (the pill's colours): every plate of it in `ral`, colours of their own off; a printed part
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
