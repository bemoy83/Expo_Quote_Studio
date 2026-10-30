import { CELL, cellKey } from './grid';
import type { Project, Stand, Variant, VariantName } from './types';
import { standardWalls } from './walls';

export const DEFAULT_PLATE = '9010';

/** A new variant with the walls its stand type implies and nothing else. */
export function createVariant(name: VariantName, stand: Stand): Variant {
  return {
    name,
    stand,
    defaultPlate: DEFAULT_PLATE,
    walls: standardWalls(stand),
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

export function createProject(): Project {
  return { fields: FIXED_PROJECT_FIELDS.map((f) => ({ ...f, value: '' })) };
}

export function customerName(p: Project): string {
  return p.fields.find((f) => f.id === 'kunde')?.value.trim() ?? '';
}
