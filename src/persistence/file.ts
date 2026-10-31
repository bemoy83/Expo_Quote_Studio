// Sketch file: JSON `{ format: 'standskisse', versjon, prosjekt, varianter, egneMotiver }`.
// Newer versions are refused with an explanation; older versions are migrated step by step.
import type { Project, Variant } from '../domain/types';

export const FORMAT = 'standskisse';
export const VERSION = 1;

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

export type ParseResult = { ok: true; sketch: Sketch } | { ok: false; error: string };

export function serialize(s: Sketch): string {
  const file: SketchFile = { format: FORMAT, versjon: VERSION, prosjekt: s.project, varianter: s.variants, egneMotiver: s.motifs };
  return JSON.stringify(file, null, 2);
}

/** Migrations from version n to n + 1, keyed by n. None yet. */
const MIGRATIONS: Record<number, (f: Record<string, unknown>) => Record<string, unknown>> = {};

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
  // Rooms came after version 1 files were first written: a variant without them has none
  const vs = (variants as Variant[]).map((x) => (Array.isArray(x.rooms) ? x : { ...x, rooms: [] }));
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
