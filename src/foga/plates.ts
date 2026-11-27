// The plates of everything built of Foga profiles and wall plates, in one place (felles plateregel, trinn A1, Bjørn
// 18.11.2026): a wall module, the header over a door or curtain, a counter's light openings. What a plate is cut to,
// and how the picking list counts it. A product (6120, 6560, 6570) is a combination of plates and profiles; the plate
// is the same HDF 3 mm, cut to size (Byggeregler V1, V5, K4, K11, K16, K17).
import { fogaPart } from './parts';
import type { Recipes } from './recipes';
import type { BomSizes } from './engine';
import type { ModuleSpec, RaiseSpec } from './structure';

/** Where the picking list puts a plate: with the walls, with the doors (a header), or with the counters built on site. */
export type PlateGroup = 'wall' | 'header' | 'counter';

/** One plate to pick: its colour and its cut size, mm. `note` is what the picking list says beside it. */
export interface PlateSpec {
  group: PlateGroup;
  ral: string;
  w: number;
  h: number;
  note?: string;
}

/** Height a rail takes up in the wall: the long side of its section (92: 40, 91: 30). */
export const railHeight = (code: string) => Math.max(...(fogaPart(code).section ?? [0]));

/**
 * The plate of a wall module: a full plate (V5), cut narrower for a shorter module (V1), or the header plate over a door
 * or curtain (D2), as tall as the header between its rails plus what the plate goes into them.
 */
export function modulePlate(m: ModuleSpec, r: Recipes, z: BomSizes): PlateSpec {
  const plate = r.wall.plate;
  const cc = m.cc ?? z.cc;
  if (!m.opening) return { group: 'wall', ral: m.plate, w: plate.w - (z.cc - cc), h: plate.h };
  const railsH = railHeight(r.wall.topRail) + railHeight(r.wall.bottomRail);
  const plateExtra = plate.h - (z.postLength - railsH);
  const header = z.postLength - r.door.floorGap - r.door.leaf - r.door.topGap;
  const bottom = m.curtain ? r.door.curtainBottomRail : r.wall.bottomRail;
  return { group: 'header', ral: m.plate, w: plate.w, h: header - railHeight(r.wall.topRail) - railHeight(bottom) + plateExtra, note: ' · overstykke' };
}

/**
 * The plate of a raised module's upper felt (Byggeregler V18, V20): between the old top rail (now the middle rail) and the new
 * top rail, as tall as the 94 joined on less the new rail, plus what a plate goes into its rails (the same as the wall
 * plate's: 2440 in 2420). A shorter module's is narrower, as its wall plate (V1).
 */
export function raisePlate(m: RaiseSpec, r: Recipes, z: BomSizes): PlateSpec {
  const plate = r.wall.plate;
  const railsH = railHeight(r.wall.topRail) + railHeight(r.wall.bottomRail);
  const into = plate.h - (z.postLength - railsH);
  return { group: 'wall', ral: m.plate, w: plate.w - (z.cc - (m.cc ?? z.cc)), h: m.len - railHeight(r.wall.raise.topRail) + into, note: ' · øvre felt' };
}

/** A plate swapped into a stand wall the organiser builds: the full plate in the exhibitor's colour. */
export const swapPlate = (ral: string, r: Recipes): PlateSpec => ({ group: 'wall', ral, w: r.wall.plate.w, h: r.wall.plate.h, note: ' · platebytte i standvegg' });
