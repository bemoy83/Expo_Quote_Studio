// The three reference stands from the handoff (Referansestander.md), built with the domain API.
import { DOOR } from '../catalog/defaultCatalog';
import type { Variant } from '../domain/types';
import { createVariant } from '../domain/variant';
import { addRoom, RECT_SIDE } from '../domain/rooms';

/** R1 · Row stand 3 × 3 m, nothing added. */
export function r1(): Variant {
  return createVariant('A', { width: 3, depth: 3, type: 'row' });
}

/** R2 · Corner stand 6 × 4 m (right side open), backroom 2 × 2 m back left with door in front, textile wall filling the back wall right of it (4 m). */
export function r2(): Variant {
  const base = createVariant('A', { width: 6, depth: 4, type: 'corner', cornerSide: 'right' });
  const v = addRoom(base, { x: 0, y: 0, w: 2, d: 2 }, { side: RECT_SIDE.front, module: 0, product: DOOR }, 'bk')!;
  return { ...v, textiles: [{ id: 't1', wallId: 'side-back', from: 2, width: 4, motif: 'hoved', fit: true }] };
}

/** R3 · Island stand 8 × 6 m, beams only. */
export function r3(): Variant {
  return createVariant('A', { width: 8, depth: 6, type: 'island' });
}
