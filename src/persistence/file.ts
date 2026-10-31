// Sketch file: JSON `{ format: 'standskisse', versjon, prosjekt, varianter, egneMotiver }`.
// Newer versions are refused with an explanation; older versions are migrated step by step.
import { rectOutline } from '../domain/outline';
import { RECT_SIDE, roomWalls, roomWallId } from '../domain/rooms';
import type { Project, Room, Variant } from '../domain/types';
import { createProject, createVariant } from '../domain/variant';

export const FORMAT = 'standskisse';
export const VERSION = 2;

/** A customer motif uploaded by the user (image as data URL). */
export interface Motif {
  id: string;
  name: string;
  ratio: number;
  src: string;
}

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

/** Stand a new sketch starts with: a 6 × 4 m row stand with its standard walls and nothing else. */
export const NEW_STAND = { width: 6, depth: 4, type: 'row' } as const;

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
};

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
      return s.flip && o.swing ? { ...out, swing: o.swing === 1 ? (-1 as const) : (1 as const) } : out;
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
  // Rooms and free-standing textile walls came after version 1 files were first written: a variant without them has none
  const vs = (variants as Variant[]).map((x) => ({
    ...x,
    rooms: Array.isArray(x.rooms) ? x.rooms : [],
    freeTextiles: Array.isArray(x.freeTextiles) ? x.freeTextiles : [],
  }));
  return { ok: true, sketch: { project: project as unknown as Project, variants: vs, motifs: motifs as Motif[] } };
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
    isObject(x.floor.cells) &&
    arrays.every((k) => Array.isArray(x[k]))
  );
}
