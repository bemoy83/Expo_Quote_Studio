// Byggeregel X13 (and X1): one list of textile walls (Variant.textiles), mounted on a system wall or standing on foot plates.
// Code that works with one way of mounting reads its share here and writes it back without touching the other. Pure.
import type { FreeTextile, Textile, TextileWall, Variant } from '../types';

const walls = new WeakMap<readonly Textile[], TextileWall[]>();
const feet = new WeakMap<readonly Textile[], FreeTextile[]>();

function cached<T extends Textile>(m: WeakMap<readonly Textile[], T[]>, all: readonly Textile[], on: T['mount']): T[] {
  let r = m.get(all);
  if (!r) {
    r = all.filter((t): t is T => t.mount === on);
    m.set(all, r);
  }
  return r;
}

/** The textile walls mounted on system walls (InFrame), in order; the same array as long as the list is the same. */
export const wallTextiles = (v: Pick<Variant, 'textiles'>): TextileWall[] => cached(walls, v.textiles, 'wall');

/** The free-standing textile walls, on foot plates, in order; the same array as long as the list is the same. */
export const freeTextiles = (v: Pick<Variant, 'textiles'>): FreeTextile[] => cached(feet, v.textiles, 'feet');

/** The variant with `list` as its textile walls on system walls, the free-standing ones kept. */
export function withOnWall<V extends Pick<Variant, 'textiles'>>(v: V, list: TextileWall[]): V {
  const keep = freeTextiles(v);
  return { ...v, textiles: keep.length ? [...list, ...keep] : list };
}

/** The variant with `list` as its free-standing textile walls, those on system walls kept. */
export function withOnFeet<V extends Pick<Variant, 'textiles'>>(v: V, list: FreeTextile[]): V {
  const keep = wallTextiles(v);
  return { ...v, textiles: keep.length ? [...keep, ...list] : list };
}

/** A textile wall by id, however it is mounted. */
export const textileById = (v: Pick<Variant, 'textiles'>, id: string): Textile | undefined => v.textiles.find((t) => t.id === id);
