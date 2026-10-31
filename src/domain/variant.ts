import { CELL, cellKey } from './grid';
import type { Project, Stand, StandWallTerms, Variant, VariantName } from './types';
import { standardWalls } from './walls';

export const DEFAULT_PLATE = '9010';

/** A new variant with the walls its stand type implies and nothing else. */
export function createVariant(name: VariantName, stand: Stand): Variant {
  return {
    name,
    stand,
    defaultPlate: DEFAULT_PLATE,
    walls: standardWalls(stand),
    rooms: [],
    openings: [],
    floor: { cells: {}, protection: false },
    objects: [],
    textiles: [],
    foils: [],
    counted: [],
    loose: [],
  };
}

/** Fill every floor cell of the stand with one product ("Fyll hele standen"). */
export function fillFloor(v: Variant, product: string): Variant {
  const nx = Math.round(v.stand.width / CELL);
  const ny = Math.round(v.stand.depth / CELL);
  const cells: Record<string, string> = {};
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) cells[cellKey(i, j)] = product;
  return { ...v, floor: { ...v.floor, cells } };
}

export const FIXED_PROJECT_FIELDS = [
  { id: 'kunde', name: 'Kundenavn' },
  { id: 'prosjekt', name: 'Prosjekt' },
  { id: 'standnr', name: 'Standnr.' },
] as const;

/** The organiser pays the stand walls in most fairs (about 90 %), and they are white. */
export const DEFAULT_STAND_WALLS: StandWallTerms = { payer: 'arrangør', ral: '9010' };

export const standWallTerms = (p: Project): StandWallTerms => p.standWalls ?? DEFAULT_STAND_WALLS;

export function createProject(): Project {
  return { fields: FIXED_PROJECT_FIELDS.map((f) => ({ ...f, value: '' })) };
}

const FIXED_IDS = new Set<string>(FIXED_PROJECT_FIELDS.map((f) => f.id));

/** Kundenavn, Prosjekt and Standnr. can be filled in but not renamed or removed. */
export const isFixedField = (id: string) => FIXED_IDS.has(id);

/** Trimmed value of a project field, '' when missing. */
export function projectField(p: Project, id: string): string {
  return p.fields.find((f) => f.id === id)?.value.trim() ?? '';
}

export const customerName = (p: Project) => projectField(p, 'kunde');
