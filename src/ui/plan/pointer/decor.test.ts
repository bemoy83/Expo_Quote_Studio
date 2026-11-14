// Print and Dekal are each their own pen of Profilering (Bjørn 14.11.2026): on a wall felt only, a textile wall is
// printed with Tekstil.
import { describe, expect, it } from 'vitest';
import type { Variant } from '../../../domain/types';
import { builtModules } from '../../../domain/walls';
import { parse } from '../../../persistence/file';
import { planScale } from '../planScale';
import { feltDecor, printTextile, TEXTILE_NOT, textileUnder } from './decor';
import { planHits } from './hits';

const TEXTS = import.meta.glob<string>('../../../test/fixtures/*.json', { query: '?raw', import: 'default', eager: true });
const sketch = (name: string): Variant => {
  const f = Object.keys(TEXTS).find((k) => k.includes(name))!;
  const r = parse(TEXTS[f]);
  if (!r.ok) throw new Error(r.error);
  return r.sketch.variants[0];
};
const hitsOf = (v: Variant) => planHits(v, builtModules(v), {}, () => planScale(100, {}));

// 08-tekstil: the back wall carries textile t1 from 1 to 5 m on its front face
describe('Profilering pens on the plan', () => {
  const v = sketch('08-tekstil');
  const hits = hitsOf(v);
  it('Print and Dekal refuse a textile wall', () => {
    const h = hits.faceHit({ x: 3, y: 0.1 })!;
    expect(feltDecor(v, h, { kind: 'motif', motif: 'm', pen: 'print' }, 1)).toEqual({ error: TEXTILE_NOT });
    expect(feltDecor(v, h, { kind: 'motif', motif: 'm', pen: 'decal' }, 1)).toEqual({ error: TEXTILE_NOT });
  });
  it('Print prints the whole felt, the same motif again does nothing', () => {
    const h = hits.faceHit({ x: 0.5, y: 0.1 })!;
    const r = feltDecor(v, h, { kind: 'motif', motif: 'm', pen: 'print' }, 1);
    if ('error' in r) throw new Error(r.error);
    const added = r.v.foils.filter((f) => !v.foils.includes(f));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ full: true, motif: 'm', module: h.module });
    const again = feltDecor(r.v, h, { kind: 'motif', motif: 'm', pen: 'print' }, 1);
    expect('v' in again && again.v).toBe(r.v);
  });
  it('Dekal puts a decal on the felt', () => {
    const h = hits.faceHit({ x: 0.5, y: 0.1 })!;
    const r = feltDecor(v, h, { kind: 'motif', motif: 'm', pen: 'decal' }, 1);
    if ('error' in r) throw new Error(r.error);
    expect(r.v.foils.filter((f) => !v.foils.includes(f))[0]).toMatchObject({ full: false, motif: 'm' });
  });
  it('Tekstil with a motif prints the textile clicked', () => {
    const u = textileUnder(v, hits, { x: 3, y: 0.1 });
    expect(u).toEqual({ mounted: 't1' });
    expect(printTextile(v, u!, 'm').textiles.find((t) => t.id === 't1')?.motif).toBe('m');
  });
});
