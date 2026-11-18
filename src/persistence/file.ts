// Sketch file: JSON `{ format: 'standskisse', versjon, prosjekt, varianter, egneMotiver }`.
// Only the current version opens; other versions are refused with an explanation.
import type { Motif, Project, Variant } from '../domain/types';
import { createProject, createVariant } from '../domain/variant';

export const FORMAT = 'standskisse';
export const VERSION = 5;

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

export function parse(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Filen er ikke gyldig JSON.' };
  }
  if (!isObject(data) || data.format !== FORMAT) return { ok: false, error: 'Filen er ikke en standskisse.' };
  const v = data.versjon;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { ok: false, error: 'Filen mangler gyldig versjon.' };
  if (v > VERSION) {
    return { ok: false, error: `Filen er laget i en nyere versjon (${v}) enn denne appen støtter (${VERSION}). Oppdater appen.` };
  }
  if (v < VERSION) return { ok: false, error: `Filen er laget i en eldre versjon (${v}) som appen ikke lenger åpner.` };
  const project = data.prosjekt;
  const variants = data.varianter;
  const motifs = data.egneMotiver ?? [];
  if (!isObject(project) || !Array.isArray(project.fields)) return { ok: false, error: 'Prosjektinfo mangler i filen.' };
  if (!Array.isArray(variants) || variants.length === 0 || variants.length > 4 || !variants.every(isVariant)) {
    return { ok: false, error: 'Filen har ingen gyldige varianter.' };
  }
  if (!Array.isArray(motifs)) return { ok: false, error: 'Egne motiver er ugyldige.' };
  // Drawn takdrager and shelves are left out when there are none
  const vs = (variants as Variant[]).map((x) => ({
    ...x,
    innerBeams: Array.isArray(x.innerBeams) ? x.innerBeams : undefined,
    shelves: Array.isArray(x.shelves) ? x.shelves : undefined,
  }));
  return { ok: true, sketch: { project: project as unknown as Project, variants: vs, motifs: motifs as Motif[] } };
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function isVariant(x: unknown): boolean {
  if (!isObject(x) || !isObject(x.stand) || !isObject(x.floor)) return false;
  const { width, depth } = x.stand;
  const arrays = ['walls', 'rooms', 'openings', 'objects', 'textiles', 'freeTextiles', 'foils', 'counted', 'loose'];
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
