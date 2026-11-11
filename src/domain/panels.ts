// Colour per plate (farge per veggpanel). A wall has one colour (Wall.plate, Room.plate, else the variant's
// defaultPlate); single plates can have their own, stored by module key in Variant.panels. One plate is one HDF sheet,
// so the colour is the same on both faces; a different face is foil over the whole plate. Where a room side lies on a
// stand wall the plate is the stand wall's, and so is its colour.
import { wallModules } from './grid';
import type { Variant, Wall } from './types';
import { builtModules } from './walls';

/** The colour of a wall's plates before any single plate is coloured (a room's walls carry the room's colour). */
export const wallRal = (v: Variant, w: Wall): string => w.plate ?? v.defaultPlate;

/**
 * Colour these plates (module keys). `base` is the colour each would have without its own (the owning wall's): a plate
 * set back to it loses its entry, so a wall coloured plate by plate back to one colour stores nothing extra.
 */
export function setPanels(v: Variant, keys: Iterable<string>, ral: string, base: (key: string) => string): Variant {
  const panels = { ...(v.panels ?? {}) };
  let changed = false;
  for (const k of keys) {
    const want = ral === base(k) ? undefined : ral;
    if (panels[k] === want) continue;
    changed = true;
    if (want === undefined) delete panels[k];
    else panels[k] = want;
  }
  return changed ? withPanels(v, panels) : v;
}

/** Drop the single-plate colours on these modules: the plates take their wall's colour again. */
export function clearPanels(v: Variant, keys: Iterable<string>): Variant {
  if (!v.panels) return v;
  const panels = { ...v.panels };
  let changed = false;
  for (const k of keys) {
    if (!(k in panels)) continue;
    delete panels[k];
    changed = true;
  }
  return changed ? withPanels(v, panels) : v;
}

/** Move plate colours when the plates move (an inner wall or a room side): old key → new key. Others stay. */
export function movePanels(v: Variant, moves: Map<string, string>): Variant {
  if (!v.panels || !moves.size) return v;
  const panels: Record<string, string> = {};
  for (const [k, ral] of Object.entries(v.panels)) if (!moves.has(k)) panels[k] = ral;
  for (const [from, to] of moves) {
    const ral = v.panels[from];
    if (ral) panels[to] = ral;
  }
  return withPanels(v, panels);
}

/** Drop colours on plates no wall has any more, so a wall drawn there later starts in its own colour. */
export function prunePanels(v: Variant): Variant {
  if (!v.panels) return v;
  const built = new Set(builtModules(v).map((m) => m.key));
  const gone = Object.keys(v.panels).filter((k) => !built.has(k));
  return gone.length ? clearPanels(v, gone) : v;
}

/** Old key → new key for each module of a wall that is moved or rewritten, matched by index. */
export function panelMoves(before: Wall, after: Wall, index = (i: number) => i): Map<string, string> {
  const a = wallModules(before);
  const b = wallModules(after);
  const out = new Map<string, string>();
  a.forEach((m, i) => {
    const j = index(i);
    if (b[j] && b[j].key !== m.key) out.set(m.key, b[j].key);
  });
  return out;
}

/**
 * The wall pen's paint bucket (Bjørn 11.11.2026): every wall on the stand in one colour. It becomes the stand's colour,
 * and the colours of their own on walls, rooms, single plates and door leaves (part of the wall) come off. Prints go
 * too, as the last stroke wins (colour over print); decals and textile frames stay.
 */
export function paintAllWalls(v: Variant, ral: string): Variant {
  const { panels: _p, ...rest } = v;
  return {
    ...rest,
    defaultPlate: ral,
    walls: v.walls.map(({ plate: _w, ...w }) => w),
    rooms: v.rooms.map(({ plate: _r, ...r }) => r),
    openings: v.openings.map(({ ral: _o, ...o }) => o),
    foils: v.foils.filter((f) => !f.full),
  };
}

function withPanels(v: Variant, panels: Record<string, string>): Variant {
  const { panels: _old, ...rest } = v;
  return Object.keys(panels).length ? { ...rest, panels } : rest;
}
