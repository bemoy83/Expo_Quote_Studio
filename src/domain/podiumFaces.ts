// The sides of a counter of Disker og podier and what they are (Byggeregler K16, K17, trinn 2): every part of the outline, from
// node to node, belongs to the section behind it, is split in light openings by the section's shelves (K19), and each
// is a plate unless that section's side says otherwise. The choice
// is kept on the section (`CounterSection.sides`), so it follows the part when the counter is moved, turned, stretched
// by a grip, built on, fused or parted; a side that becomes inner loses it (`prunedSides`). Pure, mm in the counter's
// frame.
import { covered, EPS, GRID, lineOf, withSections, type Axis } from './podiumSections';
import type { CounterLight, CounterSection, SectionSide, SectionSideKey, Variant } from './types';

/** The key of a section's side facing `out` across `axis`. */
export const sideKey = (axis: Axis, out: -1 | 1): SectionSideKey => `${axis}${out < 0 ? '-' : '+'}`;

/** One part of a counter's outline (K16): across `axis` at the node line `at`, facing `out`, from node `a` to node `b`
 *  along, in front of `section` (its index). One plate in the build. */
export interface PodiumPart {
  axis: Axis;
  out: -1 | 1;
  at: number;
  a: number;
  b: number;
  section: number;
}

/** A part's key, the same in every build of the same shape. */
export const partKey = (p: Pick<PodiumPart, 'axis' | 'out' | 'at' | 'a' | 'b'>) => `${p.axis}${p.out}:${p.at}:${p.a}:${p.b}`;

/** Every part of the outline: each section's sides split at the nodes on them, where nothing stands outside. */
export function podiumParts(sections: readonly CounterSection[]): PodiumPart[] {
  const out: PodiumPart[] = [];
  sections.forEach((s, section) => {
    for (const axis of ['x', 'z'] as const)
      for (const dir of [-1, 1] as const) {
        const at = dir < 0 ? s[axis][0] : s[axis][1];
        const run = axis === 'x' ? s.z : s.x;
        const other = axis === 'x' ? 'z' : 'x';
        // Nodes on the line inside the run: the corners of every section that touch it
        const cuts = new Set([run[0], run[1]]);
        for (const t of sections)
          if (Math.abs(t[axis][0] - at) < EPS || Math.abs(t[axis][1] - at) < EPS) for (const c of t[other]) if (c > run[0] + EPS && c < run[1] - EPS) cuts.add(c);
        const ts = [...cuts].sort((p, q) => p - q);
        for (let i = 1; i < ts.length; i++) {
          const mid = (ts[i - 1] + ts[i]) / 2;
          const past = at + dir;
          if (covered(sections, axis === 'x' ? past : mid, axis === 'x' ? mid : past)) continue;
          out.push({ axis, out: dir, at, a: ts[i - 1], b: ts[i], section });
        }
      }
  });
  return out;
}

type Line = Pick<PodiumPart, 'axis' | 'out' | 'at' | 'a' | 'b'>;
/** Whether a part lies on a straight side of the outline (podiumSides). */
export const onSide = (side: Line) => (p: PodiumPart) => p.axis === side.axis && p.out === side.out && Math.abs(p.at - side.at) < EPS && p.a > side.a - EPS && p.b < side.b + EPS;

/** The parts on a straight side of the outline, in order along it. */
export const partsOn = (sections: readonly CounterSection[], side: Line): PodiumPart[] => podiumParts(sections).filter(onSide(side)).sort((p, q) => p.a - q.a);

/** What a part's light opening `i` (from the floor) is as stored: a plate (null), open or a sliding door. */
export const lightOf = (sections: readonly CounterSection[], p: PodiumPart, i = 0): CounterLight | null => sections[p.section]?.sides?.[sideKey(p.axis, p.out)]?.lights?.[i] ?? null;

/** How many light openings a part has: one over each shelf of its section and one under the lowest (K16, K19). */
export const lightCount = (sections: readonly CounterSection[], p: PodiumPart) => (sections[p.section]?.shelves?.length ?? 0) + 1;

/** What each light opening of a part is as built, from the floor: no sliding door on a part of 250 (K17). */
export const lightsOf = (sections: readonly CounterSection[], p: PodiumPart): (CounterLight | null)[] =>
  Array.from({ length: lightCount(sections, p) }, (_, i) => {
    const k = lightOf(sections, p, i);
    return k === 'door' && !takesDoor(p) ? null : k;
  });

/** A side with its light opening `i` set (null: a plate again); empty when it holds nothing. */
function withLightAt(side: SectionSide | undefined, i: number, kind: CounterLight | null): SectionSide | undefined {
  const lights = [...(side?.lights ?? [])];
  while (lights.length <= i) lights.push(null);
  lights[i] = kind;
  while (lights.length && lights[lights.length - 1] === null) lights.pop();
  return withSideField(side, 'lights', lights);
}

/** A side with one field set, or taken off when `value` is left out or an empty list; none when nothing is left. */
export function withSideField<K extends keyof SectionSide>(side: SectionSide | undefined, k: K, value: SectionSide[K] | undefined): SectionSide | undefined {
  const { [k]: _, ...rest } = side ?? {};
  const next: SectionSide = value === undefined || (Array.isArray(value) && !value.length) ? rest : { ...rest, [k]: value };
  return Object.keys(next).length ? next : undefined;
}

/** A section with one side replaced; no `sides` when none is left. */
export function withSide(s: CounterSection, key: SectionSideKey, side: SectionSide | undefined): CounterSection {
  const sides = { ...s.sides };
  if (side) sides[key] = side;
  else delete sides[key];
  const { sides: _, ...rest } = s;
  return Object.keys(sides).length ? { ...rest, sides } : rest;
}

/** The sections with the light opening `i` of each of `parts` set to `kind` (null: plate), or every light opening of
 *  them when `i` is left out. Parts in front of the same section's side share it. */
export function setLight(sections: readonly CounterSection[], parts: readonly PodiumPart[], kind: CounterLight | null, i?: number): CounterSection[] {
  const out = [...sections];
  for (const p of parts) {
    const s = out[p.section];
    if (!s) continue;
    const key = sideKey(p.axis, p.out);
    let side = s.sides?.[key];
    for (const at of i === undefined ? Array.from({ length: lightCount(out, p) }, (_, k) => k) : [i]) side = withLightAt(side, at, kind);
    out[p.section] = withSide(s, key, side);
  }
  return out;
}

/** The parts' end nodes in the counter's frame (x, z). */
export const partLine = (p: PodiumPart) => lineOf(p.axis, p.at, p.a, p.b);

type Stretch = [[number, number], [number, number]];
/** What the build reads of the sides (K16, K17): the parts open in every light opening (`open`, drawn as a hairline in
 *  the plan), and the other parts with an open light opening or a sliding door, with what each light opening is. A part
 *  against a wall or another counter (`locked`, by partKey) stays a plate. */
export function podiumLights(sections: readonly CounterSection[], locked: ReadonlySet<string> = new Set()): { open: Stretch[]; lights: { a: [number, number]; b: [number, number]; kinds: (CounterLight | null)[] }[] } {
  const open: Stretch[] = [];
  const lights: { a: [number, number]; b: [number, number]; kinds: (CounterLight | null)[] }[] = [];
  if (!sections.some((s) => s.sides)) return { open, lights };
  for (const p of podiumParts(sections)) {
    if (locked.has(partKey(p))) continue;
    const kinds = lightsOf(sections, p);
    const [a, b] = partLine(p);
    if (kinds.every((k) => k === 'open')) open.push([a, b]);
    else if (kinds.some((k) => k)) lights.push({ a, b, kinds });
  }
  return { open, lights };
}

/** A sliding door takes a part longer than GRID (K17: not on a part of 250). */
export const takesDoor = (p: Pick<PodiumPart, 'a' | 'b'>) => p.b - p.a > GRID + EPS;
/** Why a part takes no sliding door, or null. */
export const NO_DOOR = 'Skyvedør går ikke på en del på 250';


/** The sections without the choices of sides that are no longer outside anywhere (K16: a part that becomes inner loses
 *  its choice). */
export function prunedSides(sections: readonly CounterSection[]): CounterSection[] {
  if (!sections.some((s) => s.sides)) return [...sections];
  const outer = new Set(podiumParts(sections).map((p) => `${p.section}:${sideKey(p.axis, p.out)}`));
  return sections.map((s, i) => {
    if (!s.sides) return s;
    let t = s;
    for (const key of Object.keys(s.sides) as SectionSideKey[]) if (!outer.has(`${i}:${key}`)) t = withSide(t, key, undefined);
    return t;
  });
}

const DIRS: Record<SectionSideKey, [number, number]> = { 'x-': [-1, 0], 'x+': [1, 0], 'z-': [0, -1], 'z+': [0, 1] };
/** A direction turned `rot` degrees, as counterShape's turn (no import: counterShape reads this file). */
const turn = (p: [number, number], rot: number): [number, number] => {
  const t = (rot * Math.PI) / 180;
  const c = Math.round(Math.cos(t));
  const s = Math.round(Math.sin(t));
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};
const keyOf = ([x, z]: [number, number]): SectionSideKey => (x < 0 ? 'x-' : x > 0 ? 'x+' : z < 0 ? 'z-' : 'z+');

/** A section's sides turned by `rot` degrees (into a frame turned −rot from its own: inFrame). */
export function turnedSides(sides: CounterSection['sides'], rot: number): CounterSection['sides'] {
  if (!sides || !(((rot % 360) + 360) % 360)) return sides;
  const out: Partial<Record<SectionSideKey, SectionSide>> = {};
  for (const [k, v] of Object.entries(sides) as [SectionSideKey, SectionSide][]) out[keyOf(turn(DIRS[k], rot))] = v;
  return out;
}

/** t, cut or stretched from s, without the sides that moved to a new line (a new part is a plate, K16), except `keep`
 *  (the side a grip moved). A side only made shorter or longer keeps its choice. */
export function keptSides(s: CounterSection, t: CounterSection, keep?: SectionSideKey): CounterSection {
  if (!t.sides) return t;
  let out = t;
  for (const key of Object.keys(t.sides) as SectionSideKey[]) {
    if (key === keep) continue;
    const axis = key[0] as Axis;
    const i = key[1] === '-' ? 0 : 1;
    if (Math.abs(s[axis][i] - t[axis][i]) > EPS) out = withSide(out, key, undefined);
  }
  return out;
}

/** What a counter has beside plates, for its line in the quote (K21): «2 åpne sider · 1 skyvedør · 3 hyller», a side
 *  of the outline counted once however many of its parts or light openings are open, a sliding door per light opening,
 *  and the shelves; `locked` parts are plates. */
export function podiumHas(sections: readonly CounterSection[], locked: readonly string[] = []): string[] {
  const off = new Set(locked);
  const live = podiumParts(sections).filter((p) => !off.has(partKey(p)));
  const sides = new Set(live.filter((p) => lightsOf(sections, p).includes('open')).map((p) => `${p.axis}${p.out}:${p.at}:${runOf(sections, p)}`));
  const doors = live.reduce((n, p) => n + lightsOf(sections, p).filter((k) => k === 'door').length, 0);
  const shelves = sections.reduce((n, s) => n + (s.shelves?.length ?? 0), 0);
  const some = (n: number, one: string, many: string) => (n ? [`${n} ${n === 1 ? one : many}`] : []);
  return [...some(sides.size, 'åpen side', 'åpne sider'), ...some(doors, 'skyvedør', 'skyvedører'), ...some(shelves, 'hylle', 'hyller')];
}

/** Which straight side of the outline a part lies on: where its run of outer parts in line starts. */
function runOf(sections: readonly CounterSection[], p: PodiumPart): number {
  const line = podiumParts(sections).filter((q) => q.axis === p.axis && q.out === p.out && Math.abs(q.at - p.at) < EPS);
  let a = p.a;
  for (let again = true; again; ) {
    again = false;
    for (const q of line)
      if (Math.abs(q.b - a) < EPS) {
        a = q.a;
        again = true;
      }
  }
  return a;
}

/** The sketch with the parts `keys` (partKey) of counter `id` set to `kind` (null: plate) in light opening `light` (from
 *  the floor), or in all of them (K16); a door only where the part takes one (K17). */
export function setPodiumLight(v: Variant, id: string, keys: readonly string[], kind: CounterLight | null, light?: number): Variant {
  const want = new Set(keys);
  return withSections(v, id, (ss) => setLight(ss, podiumParts(ss).filter((p) => want.has(partKey(p)) && (kind !== 'door' || takesDoor(p))), kind, light));
}
