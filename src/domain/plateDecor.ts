// The decor register (felles plateregel, trinn B1, Bjørn 18.11.2026): the colour a single plate has of its own, kept by
// the plate's owner address. A wall's plate is `wallId@a-b`, mm from the wall's start (a part of a module another wall
// split, V10, by its own stretch); a door leaf is `openingId/leaf`. A door's header is its module's plate. A wall has
// one colour (Wall.plate, Room.plate, else the variant's defaultPlate); a plate here is over it. A raised plate's upper
// felt (V20) is a plate of its own, `wallId@a-b/upper`: without its own colour it has the wall's, also when the felt below
// has its own. One plate is one HDF
// sheet, so the colour is the same on both faces; a different face is print over the plate (foils, for now).
//
// Byggeregel V17. After any edit `carryDecor` takes each plate's decor to where the plate went, from the numbers of trinn A2: a wall
// moved as a whole takes its plates along; a wall stretched or cut keeps each plate where it stands along its line;
// a plate whose wall is gone or turned (split in two, made a room side) keeps its decor where it stands in the plan.
// Decor on a plate no wall has any more is dropped, so a wall drawn there later starts in its own colour.
import { plateLocal, UPPER, upperLocal, wallLength, wallModules } from './grid';
import type { PlateDecor, Variant, Wall } from './types';
import { builtModules } from './walls';

/** `{ plate }` when the colour differs from the variant's default, else nothing: walls and rooms store only overrides. */
export const ownPlate = (v: Variant, ral: string | undefined): { plate?: string } => (ral && ral !== v.defaultPlate ? { plate: ral } : {});

/** The colour of a wall's plates before any single plate is coloured (a room's walls carry the room's colour). */
export const wallRal = (v: Variant, w: Wall): string => w.plate ?? v.defaultPlate;

const mm = (m: number) => Math.round(m * 1000);

const LEAF = '/leaf';
/** The owner address of a door's leaf. */
export const leafLocal = (openingId: string) => `${openingId}${LEAF}`;

/** A door leaf's own colour, if it has one. */
export const leafRal = (v: Variant, openingId: string): string | undefined => v.decor?.[leafLocal(openingId)]?.ral;

/** The colour of the plates at these addresses; `ral` null or the plate's colour without it (`base`) drops it. */
function setRal(v: Variant, at: Iterable<[string, string]>, ral: string | null): Variant {
  const decor = { ...(v.decor ?? {}) };
  let changed = false;
  for (const [local, base] of at) {
    const want = ral === null || ral === base ? undefined : ral;
    if (decor[local]?.ral === want) continue;
    changed = true;
    const { ral: _r, ...rest } = decor[local] ?? {};
    const next: PlateDecor = want === undefined ? rest : { ...rest, ral: want };
    if (Object.keys(next).length) decor[local] = next;
    else delete decor[local];
  }
  return changed ? withDecor(v, decor) : v;
}

/** The owner address of each plate as built, by its module key (the plate's edge in the plan). */
const localsByKey = (v: Variant) => new Map(builtModules(v).map((m) => [m.key, m.local]));

/**
 * Colour these plates (module keys). `base` is the colour each would have without its own (the owning wall's): a plate
 * set back to it loses its own, so a wall coloured plate by plate back to one colour stores nothing extra.
 */
export function colourPlates(v: Variant, keys: Iterable<string>, ral: string, base: (key: string) => string): Variant {
  const local = localsByKey(v);
  return setRal(v, [...keys].flatMap((k) => (local.has(k) ? [[local.get(k)!, base(k)] as [string, string]] : [])), ral);
}

/** Colour the upper felts of these raised plates (module keys, V20); `base` as in `colourPlates`. A plate not raised
 *  is left as it is. */
export function colourUpper(v: Variant, keys: Iterable<string>, ral: string, base: (key: string) => string): Variant {
  const local = upperByKey(v);
  return setRal(v, [...keys].flatMap((k) => (local.has(k) ? [[local.get(k)!, base(k)] as [string, string]] : [])), ral);
}

/** Drop the colours of their own on the upper felts of these plates (module keys, V20). */
export function uncolourUpper(v: Variant, keys: Iterable<string>): Variant {
  if (!v.decor) return v;
  const local = upperByKey(v);
  return setRal(v, [...keys].flatMap((k) => (local.has(k) ? [[local.get(k)!, ''] as [string, string]] : [])), null);
}

/** The owner address of each raised plate's upper felt, by its module key. */
const upperByKey = (v: Variant) => new Map(builtModules(v).flatMap((m) => (m.raise ? [[m.key, upperLocal(m.local)] as const] : [])));

/** Drop the colours of their own on these plates (module keys): they take their wall's colour again. */
export function uncolourPlates(v: Variant, keys: Iterable<string>): Variant {
  if (!v.decor) return v;
  const local = localsByKey(v);
  return setRal(v, [...keys].flatMap((k) => (local.has(k) ? [[local.get(k)!, ''] as [string, string]] : [])), null);
}

/** A door leaf's colour; `ral` null or the stand's colour drops its own, so the door follows the stand. */
export const setLeafRal = (v: Variant, openingId: string, ral: string | null): Variant => setRal(v, [[leafLocal(openingId), v.defaultPlate]], ral);

/** Every plate's and door leaf's colour of its own off. */
export function uncolourAll(v: Variant): Variant {
  if (!v.decor) return v;
  const decor = Object.fromEntries(Object.entries(v.decor).flatMap(([k, d]) => {
    const { ral: _r, ...rest } = d;
    return Object.keys(rest).length ? [[k, rest]] : [];
  }));
  return withDecor(v, decor);
}

/** The colours of their own by module key, of the plates as built (for tests and for comparing two variants). */
export function plateColours(v: Variant): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of builtModules(v)) {
    const ral = v.decor?.[m.local]?.ral;
    if (ral) out[m.key] = ral;
    const up = v.decor?.[upperLocal(m.local)]?.ral;
    if (up && m.raise) out[upperLocal(m.key)] = up;
  }
  return out;
}

const sameDir = (a: Wall, b: Wall) => {
  const d = (w: Wall) => [Math.sign(w.to[0] - w.from[0]), Math.sign(w.to[1] - w.from[1])];
  const [x, y] = [d(a), d(b)];
  return x[0] === y[0] && x[1] === y[1];
};
const rigid = (a: Wall, b: Wall) => a.to[0] - a.from[0] === b.to[0] - b.from[0] && a.to[1] - a.from[1] === b.to[1] - b.from[1];

/**
 * The decor of `after` carried to where its plates went from `before` (see the top of the file). Called once on the
 * result of every edit (ui/edits.ts), so no edit has to move decor itself.
 */
export function carryDecor(before: Variant, after: Variant): Variant {
  const d = after.decor;
  if (!d) return after;
  const built = builtModules(after);
  // A plate stands where a module is built, also a whole module only its parts are built of (V10: they take its colour)
  const standing = new Set(built.flatMap((m) => [m.key, ...(m.whole ? [m.whole] : [])]));
  const valid = new Set(built.map((m) => m.local));
  // An upper felt only stands on a plate still raised (V20): lowered to 2540 its decor goes (undo brings it back)
  const raised = new Set(built.flatMap((m) => (m.raise ? [upperLocal(m.local)] : [])));
  for (const w of after.walls) for (const m of wallModules(w)) if (standing.has(m.key)) valid.add(plateLocal(w, m.a, m.b));
  const nowAt = new Map<string, string>();
  for (const w of after.walls) for (const m of wallModules(w)) nowAt.set(m.key, plateLocal(w, m.a, m.b));
  for (const m of built) nowAt.set(m.key, m.local);
  const wasAt = new Map<string, string>();
  for (const w of before.walls) for (const m of wallModules(w)) wasAt.set(plateLocal(w, m.a, m.b), m.key);
  for (const m of builtModules(before)) wasAt.set(m.local, m.key);
  const doors = new Set(after.openings.map((o) => o.id));
  const wallsBefore = new Map(before.walls.map((w) => [w.id, w]));
  const wallsAfter = new Map(after.walls.map((w) => [w.id, w]));

  const carried = (k: string): string | null => {
    if (k.endsWith(UPPER)) {
      const to = carried(k.slice(0, -UPPER.length));
      return to && raised.has(upperLocal(to)) ? upperLocal(to) : null;
    }
    if (k.endsWith(LEAF)) return doors.has(k.slice(0, -LEAF.length)) ? k : null;
    const at = k.lastIndexOf('@');
    const id = k.slice(0, at);
    const bw = wallsBefore.get(id);
    const aw = wallsAfter.get(id);
    // Set by the edit itself, on a wall it made
    if (!bw) return valid.has(k) ? k : null;
    if (aw && sameDir(bw, aw)) {
      const [a, b] = k.slice(at + 1).split('-').map(Number);
      // Moved as a whole it takes its plates along; else each plate stays where it stands along the line
      const [dx, dy] = [Math.sign(aw.to[0] - aw.from[0]), Math.sign(aw.to[1] - aw.from[1])];
      const s = rigid(bw, aw) ? 0 : mm((bw.from[0] - aw.from[0]) * dx + (bw.from[1] - aw.from[1]) * dy);
      const to = `${id}@${a + s}-${b + s}`;
      if (valid.has(to)) return to;
    }
    // Turned as a whole (Byggeregel M6): the same length another way, its plates along it as before
    if (aw && !sameDir(bw, aw) && wallLength(aw) === wallLength(bw) && valid.has(k)) return k;
    // Where it stands in the plan, on whichever wall has it now
    const key = wasAt.get(k);
    const to = key === undefined ? undefined : nowAt.get(key);
    return to && valid.has(to) ? to : null;
  };

  const out: Record<string, PlateDecor> = {};
  for (const [k, e] of Object.entries(d)) {
    const to = carried(k);
    if (to && !(to in out)) out[to] = e;
  }
  const same = Object.keys(out).length === Object.keys(d).length && Object.entries(out).every(([k, e]) => d[k] === e);
  return same ? after : withDecor(after, out);
}

function withDecor(v: Variant, decor: Record<string, PlateDecor>): Variant {
  const { decor: _old, ...rest } = v;
  return Object.keys(decor).length ? { ...rest, decor } : rest;
}
