// Velg on a wall with a textile wall on its face: the wall's own band picks the wall, outside it the textile.
import { describe, expect, it } from 'vitest';
import type { Variant } from '../../../domain/types';
import { builtModules } from '../../../domain/walls';
import { parse } from '../../../persistence/file';
import { planScale } from '../planScale';
import { planHits } from './hits';
import { startSelect } from './select';
import type { PointerCtx } from './types';

const TEXTS = import.meta.glob<string>('../../../test/fixtures/*.json', { query: '?raw', import: 'default', eager: true });
const sketch = (name: string): Variant => {
  const f = Object.keys(TEXTS).find((k) => k.includes(name))!;
  const r = parse(TEXTS[f]);
  if (!r.ok) throw new Error(r.error);
  return r.sketch.variants[0];
};
const picked = (v: Variant, x: number, y: number) => {
  // 100 px per metre: the wall's band is 5 px (5 cm) either side of its line
  const hits = planHits(v, builtModules(v), {}, () => planScale(100, {}));
  const d = startSelect({ v, selection: {}, hits } as unknown as PointerCtx, { x, y });
  return 'select' in d ? d.select : null;
};

describe('Velg on a wall with a textile wall', () => {
  // 08-tekstil: the back wall carries textile t1 from 1 to 5 m on its front face
  it('the middle of the wall picks the wall', () => {
    expect(picked(sketch('08-tekstil'), 3, 0.03)).toMatchObject({ wallId: 'side-back' });
    expect(picked(sketch('08-tekstil'), 3, 0.03)?.textileId).toBeUndefined();
  });
  it('outside the wall on the textile face picks the textile', () => {
    expect(picked(sketch('08-tekstil'), 3, 0.1)).toMatchObject({ wallId: 'side-back', textileId: 't1' });
  });
  it('behind the wall, away from the textile face, picks the wall', () => {
    expect(picked(sketch('08-tekstil'), 3, -0.1)?.textileId).toBeUndefined();
    expect(picked(sketch('08-tekstil'), 3, -0.1)).toMatchObject({ wallId: 'side-back' });
  });
});
