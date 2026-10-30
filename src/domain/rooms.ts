// Backroom shortcut: a 1 × 1 room with one door in a free corner. Afterwards it is plain walls and an opening.
import { moduleKey } from './grid';
import type { Point, Variant } from './types';
import { addRoom, builtModules, type RectFace } from './walls';

interface Corner {
  x: number;
  y: number;
  back: boolean;
  /** Inner face toward the stand's width, and toward its depth. */
  across: RectFace;
  along: RectFace;
  walls: [Point, Point][];
}

/**
 * Corner with the most stand wall wins (back corners win ties); skipped when a room already sits there.
 * The door goes on the inner face that opens along the stand's longest dimension.
 * Null when every corner is taken.
 */
export function addDefaultRoom(v: Variant, doorProduct: string): Variant | null {
  const { width: W, depth: D } = v.stand;
  if (W < 2 || D < 2) return null;
  const keys = new Set(builtModules(v).map((m) => m.key));
  const has = (a: Point, b: Point) => keys.has(moduleKey(a, b));
  const corners: Corner[] = [
    { x: 0, y: 0, back: true, across: 'right', along: 'front', walls: [[[0, 0], [1, 0]], [[0, 0], [0, 1]]] },
    { x: W - 1, y: 0, back: true, across: 'left', along: 'front', walls: [[[W - 1, 0], [W, 0]], [[W, 0], [W, 1]]] },
    { x: 0, y: D - 1, back: false, across: 'right', along: 'back', walls: [[[0, D], [1, D]], [[0, D - 1], [0, D]]] },
    { x: W - 1, y: D - 1, back: false, across: 'left', along: 'back', walls: [[[W - 1, D], [W, D]], [[W, D - 1], [W, D]]] },
  ];
  const inner = (c: Corner): [Point, Point][] => [
    c.across === 'right' ? [[c.x + 1, c.y], [c.x + 1, c.y + 1]] : [[c.x, c.y], [c.x, c.y + 1]],
    c.along === 'front' ? [[c.x, c.y + 1], [c.x + 1, c.y + 1]] : [[c.x, c.y], [c.x + 1, c.y]],
  ];
  const score = (c: Corner) => c.walls.filter(([a, b]) => has(a, b)).length * 2 + (c.back ? 1 : 0);
  const free = corners.filter((c) => !inner(c).some(([a, b]) => has(a, b))).sort((a, b) => score(b) - score(a));
  const c = free[0];
  if (!c) return null;
  const face = W >= D ? c.across : c.along;
  return addRoom(v, { x: c.x, y: c.y, w: 1, d: 1 }, { face, module: 0, product: doorProduct }, roomPrefix(v));
}

function roomPrefix(v: Variant): string {
  let n = 1;
  while (v.walls.some((w) => w.id.startsWith(`rom${n}-`))) n++;
  return `rom${n}`;
}
