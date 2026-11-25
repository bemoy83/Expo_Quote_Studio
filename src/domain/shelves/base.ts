// Shelves (hylle 6311): the shelves of a variant, on a face and in a felt. Shared by model.ts and corners.ts, which
// would otherwise import each other.
import { sideOf, type FaceSide } from '../faces';
import type { Shelf, Variant } from '../types';

export const EPS = 1e-6;

export const shelvesOf = (v: Variant): Shelf[] => v.shelves ?? [];

export const shelvesOn = (v: Variant, wallId: string, s: FaceSide) => shelvesOf(v).filter((x) => x.wallId === wallId && sideOf(v, x) === s);

/** Shelves in one felt (module and face), lowest first. */
export const shelvesIn = (v: Variant, wallId: string, module: number, s: FaceSide, skipId?: string) =>
  shelvesOn(v, wallId, s)
    .filter((x) => x.module === module && x.id !== skipId)
    .sort((a, b) => a.y - b.y);
