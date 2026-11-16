// Built-on-site counters for tests, as sections (Byggeregler K10–K13): parts 500 deep, CC 1000, a shelf at CC 750,
// open in both light openings at the back. mm in the counter's own frame, front toward +z.
import type { CounterLight, CounterSection } from '../domain/types';

const OPEN = { lights: ['open', 'open'] as CounterLight[] };
const part = (x: [number, number], z: [number, number], side: 'x+' | 'x-' | 'z+' | 'z-'): CounterSection => ({ x, z, h: 1000, shelves: [750], sides: { [side]: OPEN } });

/** A straight counter `mm` c/c long, centred: whole metres from its left end, a half last, open at the back (z−). */
export function straightCounter(mm: number): CounterSection[] {
  const nodes = [-mm / 2];
  while (nodes.at(-1)! + 1000 < mm / 2) nodes.push(nodes.at(-1)! + 1000);
  nodes.push(mm / 2);
  return nodes.slice(1).map((b, i) => part([nodes[i], b], [-250, 250], 'z-'));
}

/** An L of two parts of 1000 c/c, the second's short side against the first's long side, open at the back and the inside. */
export const ellCounter = (): CounterSection[] => [part([-500, 500], [-250, 250], 'z-'), part([-500, 0], [-1250, -250], 'x+')];
