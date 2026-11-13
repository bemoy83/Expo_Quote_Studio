// Hylle i disk (Byggeregel K19) and the light openings it makes (K16, K17), trinn 2 PR 4: the table of the order, one
// part of 1000 c/c at CC 1000, and how the choices follow a shelf put in, moved and taken out.
import { describe, expect, it } from 'vitest';
import { counterBuildOf } from './counterShape';
import { lightOf, lightsOf, podiumHas, podiumParts, setLight } from './podiumFaces';
import { joined } from './podiumGrips';
import { setSectionHeight } from './podiums';
import { lowered, movedShelf, shelfStop, withoutShelf, withShelf } from './podiumShelves';
import type { CounterSection, PlacedObject, Variant } from './types';
import { createVariant } from './variant';

const sec = (x0: number, x1: number, z0: number, z1: number, h = 1000, shelves?: number[]): CounterSection => ({ x: [x0, x1], z: [z0, z1], h, ...(shelves && { shelves }) });
const one = (shelves?: number[]) => [sec(-500, 500, -250, 250, 1000, shelves)];
const front = (sections: CounterSection[]) => podiumParts(sections).filter((p) => p.axis === 'z' && p.out === 1);
const build = (sections: CounterSection[]) => counterBuildOf({ sections });
const plates = (sections: CounterSection[]) => build(sections).plates.map((p) => `${p.level}:${p.w}×${p.h}`).sort();
const rails = (sections: CounterSection[]) =>
  build(sections)
    .profiles.filter((p) => p.role === 'rail')
    .map((p) => `${p.code}|${p.len}`)
    .sort();
const boards = (sections: CounterSection[]) =>
  build(sections)
    .boards.map((b) => `${b.role}:${Math.max(b.w, b.d)}×${Math.min(b.w, b.d)}`)
    .sort();
const bottoms = (sections: CounterSection[]) => build(sections).profiles.filter((p) => p.role === 'bottomRail').length;
const minus = (a: string[], b: string[]) => {
  const left = [...a];
  for (const x of b) if (left.includes(x)) left.splice(left.indexOf(x), 1);
  return left;
};

describe('the table of the order (K16, K17, K19)', () => {
  it('shelf at 500 in 1000 × 500, closed sides: +2 rails 960, +2 at 460, +1 MDF 976 × 476; each plate two of 476', () => {
    const added = minus(rails(one([500])), rails(one()));
    expect(added.map((r) => r.split('|')[1]).sort()).toEqual(['460', '460', '960', '960']);
    expect(minus(boards(one([500])), boards(one()))).toEqual(['shelf:976×476']);
    expect(plates(one([500]))).toEqual(['full:476×476', 'full:476×476', 'full:476×476', 'full:476×476', 'full:976×476', 'full:976×476', 'full:976×476', 'full:976×476']);
  });

  it('shelf at 750 and a sliding door under it: the plate 976 × 226 over the rail, two leaves 500 × 726 under', () => {
    const s = setLight(one([750]), front(one([750])), 'door', 0);
    expect(plates(s).filter((p) => p.startsWith('door'))).toEqual(['door:500×726', 'door:500×726']);
    expect(minus(plates(one([750])), plates(s))).toEqual(['full:976×726']);
  });

  it('shelf at 750 and open over it: the plate 976 × 726 under the rail, none over; the bottom rail stands', () => {
    const s = setLight(one([750]), front(one([750])), 'open', 1);
    expect(minus(plates(one([750])), plates(s))).toEqual(['full:976×226']);
    expect(bottoms(s)).toBe(bottoms(one([750])));
  });

  it('as 6560: a shelf at 750 gives plates of 726 and 226 (K4)', () => {
    expect([...new Set(plates(one([750])).map((p) => p.split('×')[1]))].sort()).toEqual(['226', '726']);
  });

  it('open under the shelf: no bottom rail; open in every light opening is open as in PR 1', () => {
    const low = setLight(one([500]), front(one([500])), 'open', 0);
    expect(bottoms(low)).toBe(bottoms(one([500])) - 1);
    const all = setLight(one([500]), front(one([500])), 'open');
    expect(lightsOf(all, front(all)[0])).toEqual(['open', 'open']);
    expect(build(all).plates.filter((p) => p.w === 976)).toHaveLength(2);
  });

  it('two neighbours with a shelf at the same height share the 94 between them; the shelf rail stands on an open part', () => {
    const pair = [sec(-500, 500, -250, 250, 1000, [500]), sec(500, 1000, -250, 250, 1000, [500])];
    const inner = (s: CounterSection[]) => build(s).profiles.filter((p) => p.code === '94' && p.box.y[0] === 500).length;
    expect(inner(pair)).toBe(1);
    const open = setLight(pair, front(pair), 'open');
    expect(rails(open).length).toBe(rails(pair).length);
  });

  it('a shelf above the low top on a step: a 93 facing the low part, and the step plate split at it', () => {
    const step = [sec(-500, 500, -250, 250, 1000, [750]), sec(500, 1000, -250, 250, 500)];
    const sp = build(step).plates.filter((p) => p.level === 'step').map((p) => p.h).sort();
    expect(sp).toEqual([226, 226]);
  });
});

describe('the choice follows the light opening', () => {
  const door = (s: CounterSection[]) => setLight(s, front(s), 'door', 0);
  it('a new shelf splits a light opening in two, both keeping its choice', () => {
    const s = withShelf(door(one())[0], 500);
    expect(s.shelves).toEqual([500]);
    expect(s.sides?.['z+']?.lights).toEqual(['door', 'door']);
  });

  it('a shelf taken out joins the two round it into the lower one, which keeps its choice', () => {
    const s = setLight(one([500]), front(one([500])), 'open', 1);
    expect(withoutShelf(s[0], 500).sides).toBeUndefined();
    const d = door(one([500]));
    expect(withoutShelf(d[0], 500).sides?.['z+']?.lights).toEqual(['door']);
  });

  it('only at 250, 500 and 750, below the section; moved, it stops at a neighbour and the top', () => {
    expect(withShelf(sec(0, 500, 0, 500, 500), 500).shelves).toBeUndefined();
    expect(withShelf(one()[0], 600).shelves).toBeUndefined();
    const s = one([250, 500])[0];
    expect(shelfStop(s, 250, 750)).toBe(250);
    expect(shelfStop(s, 500, 1000)).toBe(750);
    expect(movedShelf(s, 500, 750).shelves).toEqual([250, 750]);
    expect(movedShelf(s, 250, 500)).toBe(s);
  });

  it('a lower height takes away the shelves in or above it (K18)', () => {
    const { section, gone } = lowered(one([250, 500, 750])[0], 500);
    expect(section.shelves).toEqual([250]);
    expect(gone).toBe(2);
    const o: PlacedObject = { id: 'a', product: 'P', x: 3, y: 2.5, rot: 0, sections: one([750]) };
    const v: Variant = { ...createVariant('A', { width: 6, depth: 5, type: 'row' }), walls: [], objects: [o] };
    expect(setSectionHeight(v, 'a', [0], 750).objects[0].sections![0].shelves).toBeUndefined();
  });

  it('joins sections only with the same shelves', () => {
    expect(joined([sec(-500, 0, -250, 250, 1000, [500]), sec(0, 500, -250, 250)])).toHaveLength(2);
    expect(joined([sec(-500, 0, -250, 250, 1000, [500]), sec(0, 500, -250, 250, 1000, [500])])).toHaveLength(1);
  });

  it('the quote line counts the shelves', () => {
    expect(podiumHas(one([250, 750]))).toEqual(['2 hyller']);
    expect(lightOf(one([250]), front(one([250]))[0], 1)).toBeNull();
  });
});
