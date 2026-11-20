// One list of textile walls, read and written by how they are mounted (Byggeregel X13).
import { describe, expect, it } from 'vitest';
import type { FreeTextile, TextileWall } from '../types';
import { freeTextiles, wallTextiles, withOnFeet, withOnWall } from './mounts';

const onWall: TextileWall = { mount: 'wall', id: 't1', wallId: 'w', from: 0, width: 2 };
const onFeet: FreeTextile = { mount: 'feet', id: 'ft1', from: [0, 1], to: [2, 1] };

describe('one list of textile walls (X13)', () => {
  it('reads each mount by itself, the same array while the list is the same', () => {
    const v = { textiles: [onFeet, onWall] };
    expect(wallTextiles(v)).toEqual([onWall]);
    expect(freeTextiles(v)).toEqual([onFeet]);
    expect(wallTextiles(v)).toBe(wallTextiles({ textiles: v.textiles }));
  });

  it('writes one mount and keeps the other', () => {
    const v = { textiles: [onFeet, onWall] };
    expect(withOnWall(v, []).textiles).toEqual([onFeet]);
    expect(withOnFeet(v, []).textiles).toEqual([onWall]);
  });
});
