// The sides of a counter of Disker og podier and what they are (Byggeregel K16, trinn 2): every part of the outline, from
// node to node, belongs to the section behind it and is a plate unless that section's side says otherwise. The choice
// is kept on the section (`CounterSection.sides`), so it follows the part when the counter is moved, turned, stretched
// by a grip, built on, fused or parted; a side that becomes inner loses it (`prunedSides`). Pure, mm in the counter's
// frame.
import { covered, EPS, type Axis } from './podiumSections';
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

/** The parts on a straight side of the outline (podiumSides), in order along it. */
export const partsOn = (sections: readonly CounterSection[], side: { axis: Axis; out: -1 | 1; at: number; a: number; b: number }): PodiumPart[] =>
  podiumParts(sections)
    .filter((p) => p.axis === side.axis && p.out === side.out && Math.abs(p.at - side.at) < EPS && p.a > side.a - EPS && p.b < side.b + EPS)
    .sort((p, q) => p.a - q.a);

/** What a part's light opening `i` (from the floor) is: a plate (null), or open. */
export const lightOf = (sections: readonly CounterSection[], p: PodiumPart, i = 0): CounterLight | null => sections[p.section]?.sides?.[sideKey(p.axis, p.out)]?.lights?.[i] ?? null;

/** A side with its light opening `i` set (null: a plate again); empty when it holds nothing. */
function withLightAt(side: SectionSide | undefined, i: number, kind: CounterLight | null): SectionSide | undefined {
  const lights = [...(side?.lights ?? [])];
  while (lights.length <= i) lights.push(null);
  lights[i] = kind;
  while (lights.length && lights[lights.length - 1] === null) lights.pop();
  const { lights: _, ...rest } = side ?? {};
  return lights.length ? { ...rest, lights } : Object.keys(rest).length ? rest : undefined;
}

/** A section with one side replaced; no `sides` when none is left. */
export function withSide(s: CounterSection, key: SectionSideKey, side: SectionSide | undefined): CounterSection {
  const sides = { ...s.sides };
  if (side) sides[key] = side;
  else delete sides[key];
  const { sides: _, ...rest } = s;
  return Object.keys(sides).length ? { ...rest, sides } : rest;
}

/** The sections with the light opening `i` of each of `parts` set to `kind` (null: plate). Parts in front of the same
 *  section's side share it. */
export function setLight(sections: readonly CounterSection[], parts: readonly PodiumPart[], kind: CounterLight | null, i = 0): CounterSection[] {
  const out = [...sections];
  for (const p of parts) {
    const s = out[p.section];
    if (!s) continue;
    const key = sideKey(p.axis, p.out);
    out[p.section] = withSide(s, key, withLightAt(s.sides?.[key], i, kind));
  }
  return out;
}

/** The parts' end nodes in the counter's frame (x, z). */
export const partLine = (p: PodiumPart): [[number, number], [number, number]] =>
  p.axis === 'x' ? [[p.at, p.a], [p.at, p.b]] : [[p.a, p.at], [p.b, p.at]];

/** The open stretches of the build (K16): every part open from the floor, unless it stands against a wall or another
 *  counter (`locked`, by partKey), which keeps it a plate. */
export function openStretches(sections: readonly CounterSection[], locked: ReadonlySet<string> = new Set()): [[number, number], [number, number]][] {
  return podiumParts(sections)
    .filter((p) => lightOf(sections, p) === 'open' && !locked.has(partKey(p)))
    .map(partLine);
}

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

/** What a counter has beside plates, for its line in the quote (K21): «1 åpen side», a side of the outline counted once
 *  however many of its parts are open; `locked` parts are plates. */
export function podiumHas(sections: readonly CounterSection[], locked: readonly string[] = []): string[] {
  const off = new Set(locked);
  const sides = new Set(podiumParts(sections).filter((p) => lightOf(sections, p) === 'open' && !off.has(partKey(p))).map((p) => `${p.axis}${p.out}:${p.at}:${runOf(sections, p)}`));
  const n = sides.size;
  return n ? [`${n} ${n === 1 ? 'åpen side' : 'åpne sider'}`] : [];
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

/** The sketch with the parts `keys` (partKey) of counter `id` set to `kind` (null: plate) from the floor (K16). */
export function setPodiumLight(v: Variant, id: string, keys: readonly string[], kind: CounterLight | null): Variant {
  const o = v.objects.find((x) => x.id === id);
  if (!o?.sections) return v;
  const want = new Set(keys);
  const parts = podiumParts(o.sections).filter((p) => want.has(partKey(p)));
  if (!parts.length) return v;
  const sections = setLight(o.sections, parts, kind);
  return { ...v, objects: v.objects.map((x) => (x.id === id ? { ...x, sections } : x)) };
}
