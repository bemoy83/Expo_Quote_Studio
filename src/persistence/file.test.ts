import { describe, expect, it } from 'vitest';
import { r2, r3 } from '../calc/referenceStands';
import { createProject, fillFloor } from '../domain/variant';
import { parse, serialize, type Sketch } from './file';

const sketch = (): Sketch => {
  const project = createProject();
  project.fields[0].value = 'Nordlys AS';
  project.fields.push({ id: 'x1', name: 'Kontakt', value: 'Kari' });
  return {
    project,
    variants: [fillFloor(r2(), '5901'), { ...r3(), name: 'B' }],
    motifs: [{ id: 'm1', name: 'Logo', ratio: 3, src: 'data:image/png;base64,AAAA' }],
  };
};

describe('sketch file', () => {
  it('save then open gives the same sketch (acceptance criterion 2)', () => {
    const s = sketch();
    const res = parse(serialize(s));
    expect(res).toEqual({ ok: true, sketch: s });
  });
  it('refuses a newer version with an explanation', () => {
    const f = JSON.parse(serialize(sketch()));
    const res = parse(JSON.stringify({ ...f, versjon: 2 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/nyere versjon/);
  });
  it.each([
    ['not JSON', '{'],
    ['wrong format', JSON.stringify({ format: 'annet', versjon: 1 })],
    ['no variants', JSON.stringify({ format: 'standskisse', versjon: 1, prosjekt: { fields: [] }, varianter: [] })],
    ['broken variant', JSON.stringify({ format: 'standskisse', versjon: 1, prosjekt: { fields: [] }, varianter: [{ name: 'A' }] })],
  ])('refuses %s', (_, text) => {
    expect(parse(text).ok).toBe(false);
  });
});
