import { describe, expect, it } from 'vitest';
import { r1 } from '../calc/referenceStands';
import { setStand } from '../domain/edit';
import { createProject } from '../domain/variant';
import { newSketch } from '../persistence/file';
import { initState, reduce } from './history';

const start = () => initState({ project: createProject(), variants: [r1()], motifs: [] });

describe('sketch history', () => {
  it('undo and redo an edit', () => {
    const s0 = start();
    const s1 = reduce(s0, { type: 'edit', fn: (v) => setStand(v, { ...v.stand, width: 5 }) });
    expect(s1.sketch.variants[0].stand.width).toBe(5);
    const s2 = reduce(s1, { type: 'undo' });
    expect(s2.sketch).toBe(s0.sketch);
    const s3 = reduce(s2, { type: 'redo' });
    expect(s3.sketch).toBe(s1.sketch);
  });
  it('a drag is one undo step: checkpoint, then edits without history', () => {
    let s = reduce(start(), { type: 'checkpoint' });
    for (const w of [4, 5, 6]) s = reduce(s, { type: 'edit', fn: (v) => setStand(v, { ...v.stand, width: w }), history: false });
    expect(s.past).toHaveLength(1);
    expect(reduce(s, { type: 'undo' }).sketch.variants[0].stand.width).toBe(3);
  });
  it('variants: duplicate up to D, remove keeps one', () => {
    let s = start();
    for (let i = 0; i < 5; i++) s = reduce(s, { type: 'duplicate' });
    expect(s.sketch.variants.map((v) => v.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(s.current).toBe(3);
    for (let i = 0; i < 5; i++) s = reduce(s, { type: 'remove', index: 0 });
    expect(s.sketch.variants).toHaveLength(1);
  });
  it('a no-op edit adds no undo step', () => {
    const s = start();
    expect(reduce(s, { type: 'edit', fn: (v) => v })).toBe(s);
  });
  it('Ny replaces everything in one undo step and starts at variant A', () => {
    let s = reduce(start(), { type: 'duplicate' });
    const before = s.sketch;
    s = reduce(s, { type: 'load', sketch: newSketch() });
    expect(s.current).toBe(0);
    expect(s.sketch.variants).toHaveLength(1);
    s = reduce(s, { type: 'undo' });
    expect(s.sketch).toBe(before);
    expect(s.current).toBe(1);
  });
});
