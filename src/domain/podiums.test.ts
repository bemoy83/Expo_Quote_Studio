// Disker og podier (Byggeregler K10–K12): sections on the 250 grid, built tight, drawn from one section by a drag.
import { describe, expect, it } from 'vitest';
import { counterBuildOf } from './counterShape';
import { drawPodium, dragSpan, innerCorners, podiumAt, podiumName, podiumSize, rebaseDrag, rectSections, runNodes, startDrag, type PodiumDrag } from './podiums';
import { objectBoxes, type PlaceContext } from './objects';
import { createVariant } from './variant';
import { RULES } from '../rules/rules';
import type { CounterSection, PlacedObject, Variant } from './types';

const ctx: PlaceContext = { rules: RULES, footprint: () => ({ w: 0.52, d: 0.52, h: 1.04 }), swings: () => false, isCounter: () => true };
const base: Variant = { ...createVariant('A', { width: 6, depth: 5, type: 'row' }), walls: [] };
const pen = { product: 'P' };
const sec = (x0: number, x1: number, z0: number, z1: number, h = 1000): CounterSection => ({ x: [x0, x1], z: [z0, z1], h });
const build = (sections: CounterSection[]) => counterBuildOf({ sections });
const count = (xs: string[]) => xs.reduce<Record<string, number>>((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {});

describe('sections on the 250 grid (K10)', () => {
  it('splits a length in whole metres first, the rest last, from the side it starts', () => {
    expect(runNodes(0, 1750)).toEqual([0, 1000, 1750]);
    expect(runNodes(0, 1750, 'hi')).toEqual([0, 750, 1750]);
    expect(runNodes(0, 1250)).toEqual([0, 1000, 1250]);
    expect(runNodes(0, 500)).toEqual([0, 500]);
  });

  it('cuts a rectangle into sections, at most 1000 each way', () => {
    const s = rectSections([0, 1500], [0, 1500], { x: 'lo', z: 'hi' });
    expect(s).toHaveLength(4);
    expect(s.map((x) => [x.x[1] - x.x[0], x.z[1] - x.z[0]])).toEqual(expect.arrayContaining([[1000, 1000], [500, 1000], [1000, 500], [500, 500]]));
    // The rest (500) is farthest from the side the drag started: z from hi, so the low z row is the narrow one
    expect(s.filter((x) => x.z[0] === 0).every((x) => x.z[1] === 500)).toBe(true);
  });
});

describe('tight build (K11)', () => {
  it('a podium 1000 × 1000: four 92L, four 93 on top, four 92 at the bottom, four plates and one top 976 × 976', () => {
    const b = build([sec(0, 1000, 0, 1000)]);
    expect([b.length, b.depth]).toEqual([1020, 1020]);
    const posts = b.profiles.filter((p) => p.role === 'post');
    expect(count(posts.map((p) => p.code))).toEqual({ '92L': 4 });
    expect(posts.every((p) => p.len === 1040)).toBe(true);
    expect(count(b.profiles.filter((p) => p.role === 'rail').map((p) => `${p.code}|${p.len}`))).toEqual({ '93|960': 4 });
    expect(count(b.profiles.filter((p) => p.role === 'bottomRail').map((p) => `${p.code}|${p.len}`))).toEqual({ '92|960': 4 });
    // No middle rail: the 93 sits at the top only
    expect(b.profiles.filter((p) => p.role === 'rail').every((p) => p.box.y[0] === 1000)).toBe(true);
    expect(b.plates.map((p) => `${p.w}×${p.h}|${p.level}`)).toEqual(Array(4).fill('976×976|full'));
    expect(b.boards.map((x) => `${x.role}|${x.w}×${x.d}`)).toEqual(['top|976×976']);
  });

  it('1500 × 500 in two sections: a 93 in each node where they meet, a 94 on top between them, no plate inside', () => {
    const b = build([sec(0, 1000, 0, 500), sec(1000, 1500, 0, 500)]);
    expect([b.length, b.depth]).toEqual([1520, 520]);
    expect(count(b.profiles.filter((p) => p.role === 'post').map((p) => p.code))).toEqual({ '92L': 4, '93': 2 });
    const inner = b.profiles.filter((p) => p.role === 'rail' && p.code === '94');
    expect(inner.map((p) => [p.len, p.box.y[0]])).toEqual([[460, 1000]]);
    expect(b.profiles.filter((p) => p.role === 'bottomRail')).toHaveLength(6);
    expect(b.plates).toHaveLength(6);
    expect(b.boards.map((x) => `${x.w}×${x.d}`).sort()).toEqual(['476×476', '976×476']);
  });

  it('an L of 500 × 500 with two legs of 1000 has a 94 in the inner corner', () => {
    const b = build([sec(0, 500, 0, 500), sec(500, 1500, 0, 500), sec(0, 500, 500, 1500)]);
    const inner = b.profiles.find((p) => p.role === 'post' && p.box.x[0] < 500 && p.box.x[1] > 500 && p.box.z[0] < 500 && p.box.z[1] > 500)!;
    expect(inner.code).toBe('94');
    expect(innerCorners([sec(0, 500, 0, 500), sec(500, 1500, 0, 500), sec(0, 500, 500, 1500)])).toBe(1);
  });

  it('a T joins three ways in its stem (K8): 93 where the stem meets the bar', () => {
    const t = [sec(0, 500, 0, 500), sec(500, 1000, 0, 500), sec(1000, 1500, 0, 500), sec(500, 1000, 500, 1500)];
    const b = build(t);
    expect(count(b.profiles.filter((p) => p.role === 'post').map((p) => p.code))).toEqual({ '92L': 6, '93': 2, '94': 2 });
    expect(innerCorners(t)).toBe(2);
  });

  it('is «Disk» when no deeper than 500 anywhere, else «Podium»', () => {
    expect(podiumName([sec(0, 1000, 0, 500), sec(1000, 1500, 0, 500)])).toBe('Disk');
    expect(podiumName([sec(0, 500, 0, 500), sec(500, 1500, 0, 500), sec(0, 500, 500, 1500)])).toBe('Disk');
    expect(podiumName([sec(0, 1000, 0, 1000)])).toBe('Podium');
    expect(podiumName([sec(0, 750, 0, 750)])).toBe('Podium');
  });
});

describe('the pen (PR 1)', () => {
  const at = (q: [number, number], v = base) => {
    const r = podiumAt(v, ctx, pen, q);
    if ('error' in r) throw new Error(r.error);
    return r.o;
  };
  const drawn = (start: PlacedObject, q: [number, number], v = base) => {
    const r = drawPodium(v, ctx, startDrag(start, [start.x, start.y], false), q);
    if ('error' in r) throw new Error(r.error);
    return r.o;
  };
  const size = (o: PlacedObject) => {
    const s = podiumSize(o);
    return [s.length, s.depth];
  };

  it('shows one section 500 × 500 round the pointer', () => {
    const o = at([2, 2]);
    expect([o.x, o.y, o.rot]).toEqual([2, 2, 0]);
    expect(size(o)).toEqual([520, 520]);
  });

  it('moves in against the stand edge within 10 cm, and stays inside it', () => {
    expect(at([0.33, 2]).x).toBe(0.26);
    expect(at([0.1, 4.9]).y).toBe(4.74);
    expect(at([0.45, 2]).x).toBe(0.45);
  });

  it('moves in against a counter within 10 cm, and shows nothing where it has no room', () => {
    const one = podiumAt(base, ctx, pen, [2, 2]);
    if ('error' in one) throw new Error(one.error);
    expect(at([2.6, 2], one.v).x).toBe(2.52);
    expect('error' in podiumAt(one.v, ctx, pen, [2.3, 2])).toBe(true);
  });

  it('a press in the middle dragged 1,2 m right gives 1500 × 500 (1 520 × 520) in two sections, 1000 + 500', () => {
    const start = at([2, 2]);
    const o = drawn(start, [3.2, 2]);
    expect(size(o)).toEqual([1520, 520]);
    expect(o.sections!.map((s) => s.x[1] - s.x[0])).toEqual([1000, 500]);
    // The section pressed stays put: its left edge where it was
    expect(Math.min(...objectBoxes(ctx, o).map((b) => b.x0))).toBeCloseTo(1.74, 6);
  });

  it('grows each way on its own in 500 steps; inside the section nothing changes', () => {
    const start = at([2, 2]);
    expect(size(drawn(start, [2.2, 2.2]))).toEqual([520, 520]);
    expect(size(drawn(start, [2.4, 2]))).toEqual([520, 520]);
    expect(size(drawn(start, [2.6, 2]))).toEqual([1020, 520]);
    expect(size(drawn(start, [1, 3]))).toEqual([1520, 1520]);
    // Left: the rest is farthest from the section pressed
    expect(drawn(start, [0.8, 2]).sections!.map((s) => s.x[1] - s.x[0])).toEqual([500, 1000]);
  });

  it('is refused where it has no room, with the reason', () => {
    const one = podiumAt(base, ctx, pen, [3, 2]);
    if ('error' in one) throw new Error(one.error);
    const r = drawPodium(one.v, ctx, startDrag(at([1, 2], one.v), [1, 2], false), [3, 2]);
    expect('error' in r && r.error).toBe('Ikke plass til disken her');
  });

  it('dragSpan follows the reference', () => {
    expect(dragSpan(-250, 250, 1200)).toEqual([-250, 1250]);
    expect(dragSpan(-250, 250, 400)).toEqual([-250, 250]);
    expect(dragSpan(-250, 250, -600)).toEqual([-750, 250]);
  });
});

describe('Shift: locked place and 250 steps (PR 2)', () => {
  // A section 500 × 500 round (2, 2), Shift held: what a press there and a move (mm) gives, c/c
  const start = (() => {
    const r = podiumAt(base, ctx, pen, [2, 2]);
    if ('error' in r) throw new Error(r.error);
    return r.o;
  })();
  const cc = (d: PodiumDrag, q: [number, number]) => {
    const r = drawPodium(base, ctx, d, q);
    if ('error' in r) throw new Error(r.error);
    const s = podiumSize(r.o);
    return [s.length - 20, s.depth - 20];
  };
  const left = (d: PodiumDrag, q: [number, number]) => {
    const r = drawPodium(base, ctx, d, q);
    if ('error' in r) throw new Error(r.error);
    return Math.round(Math.min(...objectBoxes(ctx, r.o).map((b) => b.x0)) * 1000) + 10;
  };
  const top = (d: PodiumDrag, q: [number, number]) => {
    const r = drawPodium(base, ctx, d, q);
    if ('error' in r) throw new Error(r.error);
    return Math.round(Math.min(...objectBoxes(ctx, r.o).map((b) => b.y0)) * 1000) + 10;
  };
  const press = (dx: number, dy: number) => startDrag(start, [2 + dx / 1000, 2 + dy / 1000], true);
  const move = (p: [number, number], dx: number, dy: number): [number, number] => [2 + (p[0] + dx) / 1000, 2 + (p[1] + dy) / 1000];

  it.each([
    ['right edge, 80 right', [240, 0], [80, 0], [500, 500]],
    ['right edge, 250 in', [240, 0], [-250, 0], [250, 500]],
    ['right edge, 600 in', [240, 0], [-600, 0], [250, 500]],
    ['right edge, 800 out', [240, 0], [800, 0], [1250, 500]],
    ['lower right corner, 500 out and 250 down', [240, 240], [500, 250], [1000, 750]],
    ['middle, 50 left', [0, 0], [-50, 0], [500, 500]],
    ['middle, 100 left', [0, 0], [-100, 0], [250, 500]],
    ['middle, 100 left and 100 up', [0, 0], [-100, -100], [250, 250]],
    ['middle, 400 left', [0, 0], [-400, 0], [500, 500]],
    ['middle, 650 left', [0, 0], [-650, 0], [750, 500]],
  ] as const)('%s', (_name, p, d, want) => {
    expect(cc(press(p[0], p[1]), move([p[0], p[1]], d[0], d[1]))).toEqual(want);
  });

  it('keeps the edge it does not hold: the right edge in leaves the left where it was', () => {
    expect(left(press(240, 0), move([240, 0], -250, 0))).toBe(1750);
  });

  it('from the middle, the half and the quarter toward the pointer', () => {
    expect(left(press(0, 0), move([0, 0], -100, 0))).toBe(1750);
    expect(top(press(0, 0), move([0, 0], -100, -100))).toBe(1750);
    expect(left(press(0, 0), move([0, 0], -400, 0))).toBe(1500);
  });

  it('Shift during a drag locks what is drawn and goes on from the pointer', () => {
    const p = (mm: number): [number, number] => [2 + mm / 1000, 2];
    let d = startDrag(start, p(0), false);
    expect(cc(d, p(1200))[0]).toBe(1500);
    d = rebaseDrag(d, p(1200), true);
    expect(cc(d, p(1200))[0]).toBe(1500);
    expect(cc(d, p(1280))[0]).toBe(1500);
    expect(cc(d, p(1350))[0]).toBe(1750);
    expect(cc(d, p(950))[0]).toBe(1250);
    d = rebaseDrag(d, p(950), false);
    expect(cc(d, p(950))[0]).toBe(1250);
    expect(cc(d, p(1600))[0]).toBe(1750);
  });
});
