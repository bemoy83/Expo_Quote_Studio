// Sketch file: JSON `{ format: 'standskisse', versjon, prosjekt, varianter, egneMotiver }`.
// Newer versions are refused with an explanation; older versions are migrated step by step.
import { DEFAULT_CATALOG, OLD_COUNTERS, OLD_SHELF } from '../catalog/defaultCatalog';
import { builtProduct } from '../catalog/podium';
import { asSections, isStock } from '../domain/podiumStock';
import { addStockAnywhere, funcByShape } from '../domain/podiums';
import { placeContext } from '../catalog/lookup';
import { RULES } from '../rules/rules';
import { tilesFromCells } from '../domain/floor/tiles';
import { nextId } from '../domain/ids';
import { rectOutline } from '../domain/outline';
import { RECT_SIDE, roomWalls } from '../domain/rooms';
import { roomWallId } from '../domain/roomKeys';
import type { Motif, Project, Room, Variant } from '../domain/types';
import { createProject, createVariant } from '../domain/variant';

export const FORMAT = 'standskisse';
export const VERSION = 3;

export interface SketchFile {
  format: typeof FORMAT;
  versjon: typeof VERSION;
  prosjekt: Project;
  varianter: Variant[];
  egneMotiver: Motif[];
}

export interface Sketch {
  project: Project;
  variants: Variant[];
  motifs: Motif[];
}

/** Stand a new sketch starts with: the classic 4 × 3 m corner stand, open to the right, with its standard walls and
 *  nothing else (Bjørn 2.11.2026). */
export const NEW_STAND = { width: 4, depth: 3, type: 'corner', cornerSide: 'right' } as const;

/** A new, empty sketch ("Ny"): blank customer fields, one variant, no own motifs. */
export function newSketch(): Sketch {
  return { project: createProject(), variants: [createVariant('A', { ...NEW_STAND })], motifs: [] };
}

export type ParseResult = { ok: true; sketch: Sketch } | { ok: false; error: string };

export function serialize(s: Sketch): string {
  const file: SketchFile = { format: FORMAT, versjon: VERSION, prosjekt: s.project, varianter: s.variants, egneMotiver: s.motifs };
  return JSON.stringify(file, null, 2);
}

/** Migrations from version n to n + 1, keyed by n. */
const MIGRATIONS: Record<number, (f: Record<string, unknown>) => Record<string, unknown>> = {
  1: (f) => ({ ...f, varianter: Array.isArray(f.varianter) ? f.varianter.map(rectRoomsToOutlines) : f.varianter }),
  2: (f) => ({ ...f, varianter: Array.isArray(f.varianter) ? f.varianter.map(cellsToTiles) : f.varianter }),
};

/** Version 2 → 3: the floor was one product per 0,5 m cell; now it is tiles, laid 1 × 1 where the cells allow. */
function cellsToTiles(x: unknown): unknown {
  if (!isObject(x) || !isObject(x.floor) || !isObject(x.floor.cells)) return x;
  const { cells, ...floor } = x.floor;
  return { ...x, floor: { ...floor, tiles: tilesFromCells(cells as Record<string, string>) } };
}

type Face = keyof typeof RECT_SIDE;
interface RectRoomV1 {
  id: string;
  x: number;
  y: number;
  w: number;
  d: number;
  label?: string;
  plate?: string;
  gaps?: { face: Face; module: number }[];
}
type Things = Pick<Variant, 'walls' | 'openings' | 'textiles' | 'foils'> & { rooms?: RectRoomV1[] };

/**
 * Version 1 → 2: rooms were rectangles `{ x, y, w, d }` with sides named back, right, front, left (front and left
 * running left → right and back → front); now they are outlines with numbered sides running clockwise. Front and
 * left turn round, so offsets along them and the faces of what stands on them are mirrored.
 */
function rectRoomsToOutlines(x: unknown): unknown {
  const v = x as Things;
  if (typeof x !== 'object' || x === null || !Array.isArray(v.rooms) || !v.rooms.length) return x;
  const sides = new Map<string, { wallId: string; len: number; flip: boolean }>();
  const rooms: Room[] = v.rooms.map((r) => {
    for (const face of Object.keys(RECT_SIDE) as Face[]) {
      const len = face === 'back' || face === 'front' ? r.w : r.d;
      sides.set(`${r.id}.${face}`, { wallId: roomWallId(r.id, RECT_SIDE[face]), len, flip: face === 'front' || face === 'left' });
    }
    const room: Room = { id: r.id, outline: rectOutline(r), ...(r.label ? { label: r.label } : {}), ...(r.plate ? { plate: r.plate } : {}) };
    if (r.gaps?.length) {
      room.gaps = r.gaps.map((g) => {
        const s = sides.get(`${r.id}.${g.face}`)!;
        return { side: RECT_SIDE[g.face], module: s.flip ? s.len - 1 - g.module : g.module };
      });
    }
    return room;
  });
  const flipSide = <T extends { side?: 1 | -1 }>(t: T): T => (t.side ? { ...t, side: t.side === 1 ? -1 : 1 } : t);
  return {
    ...v,
    rooms,
    walls: [...v.walls.filter((w) => !w.room), ...rooms.flatMap(roomWalls)],
    openings: v.openings.map((o) => {
      const s = sides.get(o.wallId);
      if (!s) return o;
      const out = { ...o, wallId: s.wallId, module: s.flip ? s.len - 1 - o.module : o.module };
      if (!s.flip) return out;
      const { hinge: _h, ...rest } = out;
      return { ...rest, ...(o.swing ? { swing: o.swing === 1 ? (-1 as const) : (1 as const) } : {}), ...(o.hinge === -1 ? {} : { hinge: -1 as const }) };
    }),
    textiles: v.textiles.map((t) => {
      const s = sides.get(t.wallId);
      if (!s) return t;
      const out = { ...t, wallId: s.wallId };
      return s.flip ? flipSide({ ...out, from: s.len - t.from - t.width }) : out;
    }),
    foils: v.foils.map((f) => {
      const s = sides.get(f.wallId);
      if (!s) return f;
      const out = { ...f, wallId: s.wallId };
      return s.flip ? flipSide({ ...out, module: s.len - 1 - f.module, x: -f.x }) : out;
    }),
  };
}

export function parse(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Filen er ikke gyldig JSON.' };
  }
  if (!isObject(data) || data.format !== FORMAT) return { ok: false, error: 'Filen er ikke en standskisse.' };
  let v = data.versjon;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { ok: false, error: 'Filen mangler gyldig versjon.' };
  if (v > VERSION) {
    return { ok: false, error: `Filen er laget i en nyere versjon (${v}) enn denne appen støtter (${VERSION}). Oppdater appen.` };
  }
  let f: Record<string, unknown> = data;
  while (v < VERSION) {
    const step = MIGRATIONS[v];
    if (!step) return { ok: false, error: `Kan ikke oppgradere fil fra versjon ${v}.` };
    f = step(f);
    v++;
  }
  const project = f.prosjekt;
  const variants = f.varianter;
  const motifs = f.egneMotiver ?? [];
  if (!isObject(project) || !Array.isArray(project.fields)) return { ok: false, error: 'Prosjektinfo mangler i filen.' };
  if (!Array.isArray(variants) || variants.length === 0 || variants.length > 4 || !variants.every(isVariant)) {
    return { ok: false, error: 'Filen har ingen gyldige varianter.' };
  }
  if (!Array.isArray(motifs)) return { ok: false, error: 'Egne motiver er ugyldige.' };
  // Rooms, free-standing textile walls and drawn takdrager came after version 1 files were first written: a variant without them has none
  const vs = (variants as Variant[]).map((x) => ({
    ...x,
    rooms: Array.isArray(x.rooms) ? x.rooms : [],
    freeTextiles: Array.isArray(x.freeTextiles) ? x.freeTextiles : [],
    innerBeams: Array.isArray(x.innerBeams) ? x.innerBeams : undefined,
    shelves: Array.isArray(x.shelves) ? x.shelves : undefined,
  })).map(retiredToLoose).map(countersAsSections).map(countedAsPodier).map(builtAsFunction);
  return { ok: true, sketch: { project: project as unknown as Project, variants: vs, motifs: motifs as Motif[] } };
}

/** The products of Disker og podier built on site (K13): a disk, a podie. */
const BUILT = (func: string) => builtProduct(DEFAULT_CATALOG.products, func)!.variants[0].artnr;
/** The one product of Disker og podier before a disk and a podie were each their own (Bjørn 14.11.2026). */
const OLD_PODIUM = '6570';

/** Counters and podier drawn before a disk and a podie were each their own product (Bjørn 14.11.2026): built as the
 *  one their shape is by K13, as they were named. */
function builtAsFunction(v: Variant): Variant {
  if (!v.objects.some((o) => o.product === OLD_PODIUM)) return v;
  return { ...v, objects: v.objects.map((o) => (o.product === OLD_PODIUM ? { ...o, product: BUILT(funcByShape(o.sections ?? [])) } : o)) };
}

/** Counters from before Disker og podier took over Disker (Bjørn 13.11.2026), as its sections: the counter in stock as
 *  its standard counter, a drawn counter section by section, built and priced the same (Byggeregel K22). */
function countersAsSections(v: Variant): Variant {
  if (!v.objects.some((o) => asSections(o, BUILT('disker')) !== o)) return v;
  return { ...v, objects: v.objects.map((o) => asSections(o, BUILT('disker'))) };
}

/** Podier counted before Podie 50 × 50 became a standard podie of Disker og podier (Bjørn 14.11.2026), placed: one per
 *  piece where + in Utstyr puts it, in the height its art.nr has always meant (K22). One that finds no room stays
 *  counted. */
function countedAsPodier(v: Variant): Variant {
  if (!v.counted.some((c) => isStock(c.product))) return v;
  const ctx = placeContext(RULES, DEFAULT_CATALOG);
  let next: Variant = { ...v, counted: [] };
  const left: Variant['counted'] = [];
  for (const c of v.counted) {
    if (!isStock(c.product)) {
      left.push(c);
      continue;
    }
    let k = 0;
    for (; k < c.qty; k++) {
      const placed = addStockAnywhere(next, ctx, BUILT('podier'), c.product);
      if (!placed) break;
      next = placed;
    }
    if (k < c.qty) left.push({ ...c, qty: c.qty - k });
  }
  return { ...next, counted: left };
}

/** Counted products the catalog no longer has, kept as loose lines at their price so the quote is the same: «Hylle 1 m»
 *  (6180) before the drawn shelf 6311 replaced it (Bjørn 8.11.2026), and the made-up counters before 6560 (Bjørn
 *  11.11.2026). */
function retiredToLoose(v: Variant): Variant {
  const retired = (product: string) => {
    if (OLD_COUNTERS[product]) return OLD_COUNTERS[product];
    if (!product.startsWith(OLD_SHELF.prefix)) return undefined;
    const variant = OLD_SHELF.variants[Number(product.slice(OLD_SHELF.prefix.length)) - 1];
    return { name: `${OLD_SHELF.name}${variant ? `, ${variant.toLowerCase()}` : ''}`, price: OLD_SHELF.price };
  };
  if (!v.counted.some((c) => retired(c.product))) return v;
  const ids = v.loose.map((l) => l.id);
  const loose = v.counted.flatMap((c) => {
    const r = retired(c.product);
    if (!r || c.qty <= 0) return [];
    const id = nextId(ids, 'l');
    ids.push(id);
    return [{ id, name: r.name, qty: c.qty, price: r.price }];
  });
  return { ...v, counted: v.counted.filter((c) => !retired(c.product)), loose: [...v.loose, ...loose] };
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function isVariant(x: unknown): boolean {
  if (!isObject(x) || !isObject(x.stand) || !isObject(x.floor)) return false;
  const { width, depth } = x.stand;
  const arrays = ['walls', 'openings', 'objects', 'textiles', 'foils', 'counted', 'loose'];
  return (
    typeof x.name === 'string' &&
    typeof width === 'number' &&
    typeof depth === 'number' &&
    width > 0 &&
    depth > 0 &&
    Array.isArray(x.floor.tiles) &&
    arrays.every((k) => Array.isArray(x[k]))
  );
}
