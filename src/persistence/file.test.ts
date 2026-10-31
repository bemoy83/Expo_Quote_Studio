import { describe, expect, it } from 'vitest';
import { r2, r3 } from '../calc/referenceStands';
import { createProject, fillFloor } from '../domain/variant';
import { newSketch, parse, serialize, VERSION, type Sketch } from './file';

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
  it('a sketch saved before free-standing textile walls has none', () => {
    const f = JSON.parse(serialize(sketch()));
    for (const v of f.varianter) delete v.freeTextiles;
    const res = parse(JSON.stringify(f));
    expect(res.ok && res.sketch.variants.map((v) => v.freeTextiles)).toEqual([[], []]);
  });
  it('refuses a newer version with an explanation', () => {
    const f = JSON.parse(serialize(sketch()));
    const res = parse(JSON.stringify({ ...f, versjon: VERSION + 1 }));
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

describe('version 1 files', () => {
  it('rectangle rooms become outlines; doors and frames on the turned sides keep their place', () => {
    const v2 = r2();
    // R2 as version 1 wrote it: room bk {0, 0, 2 × 2}, door in its front module 1 (x 1..2), sides named
    const v1 = {
      ...v2,
      rooms: [{ id: 'bk', x: 0, y: 0, w: 2, d: 2, gaps: [{ face: 'left', module: 0 }] }],
      walls: v2.walls.filter((w) => !w.room),
      openings: [{ id: 'o1', wallId: 'bk.front', module: 1, product: v2.openings[0].product }],
      textiles: [...v2.textiles, { id: 't9', wallId: 'bk.front', from: 0, width: 1, side: 1 }],
    };
    const res = parse(JSON.stringify({ format: 'standskisse', versjon: 1, prosjekt: createProject(), varianter: [v1], egneMotiver: [] }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [v] = res.sketch.variants;
    expect(v.rooms[0]).toEqual({ id: 'bk', outline: [[0, 0], [2, 0], [2, 2], [0, 2]], gaps: [{ side: 3, module: 1 }] });
    expect(v.openings).toEqual([{ id: 'o1', wallId: 'bk.2', module: 0, product: v2.openings[0].product }]);
    expect(v.textiles.at(-1)).toEqual({ id: 't9', wallId: 'bk.2', from: 1, width: 1, side: -1 });
    expect(v.walls.filter((w) => w.room).map((w) => w.id)).toEqual(['bk.0', 'bk.1', 'bk.2', 'bk.3']);
  });
});

describe('new sketch', () => {
  it('is one empty variant A with blank customer fields and no own motifs', () => {
    const s = newSketch();
    expect(s.variants.map((v) => v.name)).toEqual(['A']);
    const [v] = s.variants;
    expect([v.objects, v.textiles, v.foils, v.rooms, v.openings]).toEqual([[], [], [], [], []]);
    expect(v.floor.cells).toEqual({});
    expect(s.project.fields.every((f) => f.value === '')).toBe(true);
    expect(s.motifs).toEqual([]);
  });
  it('round-trips through the file format', () => {
    const s = newSketch();
    expect(parse(serialize(s))).toEqual({ ok: true, sketch: s });
  });
});
