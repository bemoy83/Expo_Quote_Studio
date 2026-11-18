// Every plate of a stand, from what is built (felles plateregel, trinn A1, Bjørn 18.11.2026): the walls' modules and
// their parts (V1, V10), the header and the leaf of a door (D5), the light openings and sliding leaves of a counter (K4,
// K16, K17). Each has an address made of measures, so decor can later be looked up by it whatever product the plate is
// in. Two ways of addressing a plate are given:
// - `id`: by where it stands in the plan (a wall plate by its edge; a counter's in the counter's own frame, mm), which
//   survives a wall being split, merged or shared;
// - `local`: by its owner and its place along it (a wall's id and mm from its start, a door leaf by its door), which
//   survives the owner moving. Trinn A2 (plates.test.ts) measured both; the colour of a wall's plates and door leaves
//   is kept by `local` (Variant.decor, trinn B1), and carried by `id` where the owner is gone (plateDecor.ts).
// The sales product (6120, 6560, 6570) is a combination of plates and profiles; the price stays with it (Bjørn 18.11.2026).
import { counterBuildOf } from './counterShape';
import { doorRal, doorWindows } from './doors';
import { faces, type FaceSide } from './faces';
import { modulePlate } from '../foga/plates';
import { RECIPES } from '../foga/recipes';
import type { Rules } from '../rules/rules';
import type { PlacedObject, Variant } from './types';
import { leafLocal } from './plateDecor';
import { builtModules } from './walls';

/** What a plate is in its product. */
export type PlateKind = 'felt' | 'header' | 'leaf' | 'counter' | 'step' | 'slide';

export interface Plate {
  /** By where it stands: a wall plate by its edge in the plan (with `/header` or `/leaf` on a door), a counter's by its
   *  side, its stretch along it and the height it starts at, mm in the counter's frame. */
  id: string;
  /** By its owner and its place along it: the wall and the stretch, mm from the wall's start; a counter's as `id`. */
  local: string;
  owner: { wall: string } | { object: string };
  kind: PlateKind;
  /** Its colour as built. */
  ral: string;
  /** Cut size, mm (a door leaf: its light opening in the 292 frame). */
  w: number;
  h: number;
  /** The faces that show: a stand wall its inside, an inner wall or a door both, a counter its outside. */
  faces: FaceSide[];
  /** Why it takes no print or decal, or null when it does (on top of what covers a face, such as a textile frame). */
  noPrint: string | null;
  noDecal: string | null;
}

const mm = (m: number) => Math.round(m * 1000);

/** The plates of every wall: a felt per module or part, a header and a leaf (a door) or a header (a curtain). */
export function wallPlates(v: Variant, rules: Rules, isCurtain: (product: string) => boolean): Plate[] {
  const z = { postLength: mm(rules.wall.height), cc: mm(rules.wall.cc) };
  const leaf = doorWindows(rules).leaf;
  return builtModules(v).flatMap((m): Plate[] => {
    const w = v.walls.find((x) => x.id === m.wallId)!;
    const base = { owner: { wall: m.wallId }, faces: faces(v, w) };
    const local = m.local;
    const curtain = !!m.opening && isCurtain(m.opening.product);
    const spec = modulePlate({ plate: m.plate, opening: !!m.opening, ...(curtain && { curtain: true }), ...(m.cc < 1 - 1e-6 && { cc: mm(m.cc) }) }, RECIPES, z);
    if (!m.opening) {
      // V10: a part of a split module takes no print yet
      const split = m.whole ? 'Delte plater kan ikke ha print ennå' : null;
      return [{ ...base, id: m.key, local, kind: 'felt', ral: m.plate, w: spec.w, h: spec.h, noPrint: split, noDecal: split }];
    }
    const header: Plate = { ...base, id: `${m.key}/header`, local: `${local}/header`, kind: 'header', ral: m.plate, w: spec.w, h: spec.h, noPrint: curtain ? 'Forheng har ikke print' : null, noDecal: 'Folie kan ikke ligge på en åpning' };
    if (curtain) return [header];
    const o = m.opening;
    return [header, { ...base, id: `${m.key}/leaf`, local: leafLocal(o.id), kind: 'leaf', ral: doorRal(v, o), w: mm(leaf.w), h: mm(leaf.y1 - leaf.y0), noPrint: null, noDecal: 'Folie kan ikke ligge på en åpning' }];
  });
}

const LEVEL_KIND = { full: 'counter', step: 'step', door: 'slide' } as const;

/** The plates of a counter built of Foga profiles: one per light opening of its closed sides, a step's, the two leaves
 *  of a sliding door; outward along x or z, its stretch and where it starts from the floor, mm in the counter's frame.
 *  Not where it ends: a lower top leaves the plate the same plate, and a new shelf leaves the lower part the one it was. */
export function counterPlates(o: PlacedObject, ral: string): Plate[] {
  return counterBuildOf(o).plates.map((p): Plate => {
    const alongX = Math.abs(p.out[1]) > 0;
    const run = alongX ? p.box.x : p.box.z;
    const at = alongX ? p.box.z : p.box.x;
    const id = `${o.id}:${alongX ? 'z' : 'x'}${p.out[alongX ? 1 : 0] > 0 ? '+' : '-'}${Math.round(at[0])}:${Math.round(run[0])}-${Math.round(run[1])}:${Math.round(p.box.y[0])}`;
    return { id, local: id, owner: { object: o.id }, kind: LEVEL_KIND[p.level], ral: p.ral ?? ral, w: p.w, h: p.h, faces: [1], noPrint: null, noDecal: null };
  });
}

/** Every plate of the stand. `isCounter`: the objects built of Foga profiles; `counterRal`: a counter's own colour. */
export function standPlates(v: Variant, rules: Rules, ctx: { isCurtain: (product: string) => boolean; isCounter: (product: string) => boolean; counterRal: (o: PlacedObject) => string }): Plate[] {
  return [...wallPlates(v, rules, ctx.isCurtain), ...v.objects.filter((o) => ctx.isCounter(o.product)).flatMap((o) => counterPlates(o, ctx.counterRal(o)))];
}
