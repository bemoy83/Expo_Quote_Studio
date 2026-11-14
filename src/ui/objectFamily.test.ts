import { describe, expect, it } from 'vitest';
import { objectFamily } from './objectFamily';

describe('objectFamily', () => {
  it('a counter of Disker og podier has none, so its heights never show as swatches (K13, K22)', () => {
    for (const a of ['6571', '6572', '6560', '5450-1']) expect(objectFamily(a)).toEqual([]);
  });

  it('furniture of the same group and footprint is one family', () => {
    expect(objectFamily('5276').map((x) => x.artnr)).toEqual(['5276', '5275']);
  });
});
