import { RULES, type CarpetRates } from '../rules/rules';
import { fillCarpet } from './carpet';
import { fillTiles } from './floor';
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
    floor: { tiles: [], protection: false },
    objects: [],
    textiles: [],
    freeTextiles: [],
    foils: [],
    counted: [],
    loose: [],
  };
}

/** Lay the whole stand with one product ("Fyll hele standen"). `roll`: roll width, m, for floor laid in lanes. */
/** Lay the whole stand with one floor: carpet tiles, or rolled floor `roll` m wide the cheapest way (domain/carpet.ts). */
export function fillFloor(v: Variant, product: string, roll?: number, rates: CarpetRates = RULES.carpet): Variant {
  if (roll) return fillCarpet({ ...v, floor: { ...v.floor, tiles: [] } }, product, roll, rates);
  return { ...v, floor: { ...v.floor, tiles: fillTiles(v.stand, product) } };
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
