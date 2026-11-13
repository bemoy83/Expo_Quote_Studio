// Shelves in a counter of Disker og podier (Byggeregel K19, trinn 2): a shelf belongs to a section and stands at CC 250,
// 500 or 750, below the section's height, on four rails round it that split the section's sides into light openings
// (K16). What each light opening is stays with it: a new shelf splits one in two, both keeping its choice; a shelf
// taken away joins the two round it into the lower one, which keeps its choice (bestilling, «Modell»). Pure, mm.
import { withSide } from './podiumFaces';
import type { CounterLight, CounterSection, SectionSide, SectionSideKey, Variant } from './types';

/** The heights a shelf stands at (K19): CC 250, 500 and 750; at 1000 stands the top. */
export const SHELF_HEIGHTS = [250, 500, 750] as const;

/** A side's light openings with `fn` done to them; empty when only plates are left. */
function withLights(s: CounterSection, fn: (lights: (CounterLight | null)[]) => void): CounterSection {
  if (!s.sides) return s;
  let out = s;
  for (const [key, side] of Object.entries(s.sides) as [SectionSideKey, SectionSide][]) {
    if (!side.lights) continue;
    const lights = [...side.lights];
    fn(lights);
    while (lights.length && lights[lights.length - 1] === null) lights.pop();
    const { lights: _, ...rest } = side;
    out = withSide(out, key, lights.length ? { ...rest, lights } : Object.keys(rest).length ? rest : undefined);
  }
  return out;
}

const withShelves = (s: CounterSection, shelves: number[]): CounterSection => {
  const { shelves: _, ...rest } = s;
  return shelves.length ? { ...rest, shelves } : rest;
};

/** The section with a shelf at `y`, when it takes one there: the light opening it splits gives both halves its choice. */
export function withShelf(s: CounterSection, y: number): CounterSection {
  const shelves = s.shelves ?? [];
  if (!(SHELF_HEIGHTS as readonly number[]).includes(y) || y >= s.h || shelves.includes(y)) return s;
  const k = shelves.filter((x) => x < y).length;
  const t = withLights(s, (l) => {
    if (k < l.length) l.splice(k, 0, l[k]);
  });
  return withShelves(t, [...shelves, y].sort((a, b) => a - b));
}

/** The section without its shelf at `y`: the two light openings round it become the lower one. */
export function withoutShelf(s: CounterSection, y: number): CounterSection {
  const shelves = s.shelves ?? [];
  const k = shelves.indexOf(y);
  if (k < 0) return s;
  const t = withLights(s, (l) => {
    if (k + 1 < l.length) l.splice(k + 1, 1);
  });
  return withShelves(
    t,
    shelves.filter((x) => x !== y),
  );
}

/** The section at height `h` without the shelves in or above it (K18), and how many went. */
export function lowered(s: CounterSection, h: number): { section: CounterSection; gone: number } {
  const over = (s.shelves ?? []).filter((y) => y >= h).sort((a, b) => b - a);
  return { section: { ...over.reduce(withoutShelf, s), h }, gone: over.length };
}

/** Where a shelf at `from` can be moved toward `to` (K19): to the nearest height on the way, stopping short of a shelf
 *  beside it and of the top. */
export function shelfStop(s: Pick<CounterSection, 'h' | 'shelves'>, from: number, to: number): number {
  const others = (s.shelves ?? []).filter((y) => y !== from);
  const lo = Math.max(0, ...others.filter((y) => y < from));
  const hi = Math.min(s.h, ...others.filter((y) => y > from));
  const ok = SHELF_HEIGHTS.filter((y) => y > lo && y < hi);
  return ok.reduce((a, b) => (Math.abs(b - to) < Math.abs(a - to) ? b : a), from);
}

/** The section with its shelf at `from` moved to `to`; the light openings keep their choices. */
export function movedShelf(s: CounterSection, from: number, to: number): CounterSection {
  const shelves = s.shelves ?? [];
  if (!shelves.includes(from) || shelfStop(s, from, to) !== to || to === from) return s;
  return { ...s, shelves: shelves.map((y) => (y === from ? to : y)) };
}

const onObject = (v: Variant, id: string, fn: (sections: CounterSection[]) => CounterSection[]): Variant => {
  const o = v.objects.find((x) => x.id === id);
  if (!o?.sections) return v;
  const sections = fn(o.sections);
  if (sections.every((s, i) => s === o.sections![i])) return v;
  return { ...v, objects: v.objects.map((x) => (x.id === id ? { ...x, sections } : x)) };
};

/** The sketch with a shelf at `y` put in (`on`) or taken out of the sections `which` (by index) of counter `id`; only
 *  where the section is higher than `y`. */
export function setPodiumShelf(v: Variant, id: string, which: readonly number[], y: number, on: boolean): Variant {
  const pick = new Set(which);
  return onObject(v, id, (ss) => ss.map((s, i) => (pick.has(i) ? (on ? withShelf(s, y) : withoutShelf(s, y)) : s)));
}

/** The sketch with the shelf at `from` in section `section` of counter `id` moved to `to`. */
export function movePodiumShelf(v: Variant, id: string, section: number, from: number, to: number): Variant {
  return onObject(v, id, (ss) => ss.map((s, i) => (i === section ? movedShelf(s, from, to) : s)));
}
