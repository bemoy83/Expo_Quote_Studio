// One drawing tool for straight runs (Bjørn 14.11.2026): the module shown stays put; with Shift it is 250 and grows in 250.
import { describe, expect, it } from 'vitest';
import { BEAM_UNIT, RUN_UNIT, TEXTILE_UNIT, rebaseRun, runTo, shownModule, startRun } from './runDraw';
import type { Point, Stand } from './types';

const stand: Stand = { width: 6, depth: 3, type: 'row' };
const press = (q: Point, fine = false) => startRun(stand, shownModule(stand, { x: q[0], y: q[1] }, fine), q, fine);

describe('run drawing', () => {
  it('without Shift the module shown stays and grows in whole metres', () => {
    const d = press([2.5, 1.05]);
    expect(runTo(d, [2.6, 1.05])).toEqual([[2, 1], [3, 1]]);
    expect(runTo(d, [4.7, 1.1])).toEqual([[2, 1], [5, 1]]);
    // The other way: laid from the end that stood still
    expect(runTo(d, [0.4, 1])).toEqual([[3, 1], [0, 1]]);
  });

  it('with Shift the pen shows the 250 edge nearest on the 250 grid (V9)', () => {
    expect(shownModule(stand, { x: 2.6, y: 1.05 }, true)).toMatchObject({ a: [2.5, 1], b: [2.75, 1] });
    expect(shownModule(stand, { x: 5.9, y: 1.02 }, true)).toMatchObject({ a: [5.75, 1], b: [6, 1] });
    // Off the metre lines: y = 1.25, and x = 2.5 upright
    expect(shownModule(stand, { x: 2.6, y: 1.27 }, true)).toMatchObject({ a: [2.5, 1.25], b: [2.75, 1.25] });
    expect(shownModule(stand, { x: 2.52, y: 1.6 }, true)).toMatchObject({ a: [2.5, 1.5], b: [2.5, 1.75] });
  });

  it('with Shift a wall can be drawn off the metre lines, and turns at a 250 node', () => {
    const d = press([2.6, 1.27], true);
    expect(runTo(d, [3.6, 1.27])).toEqual([[2.5, 1.25], [3.5, 1.25]]);
    const f = press([2.7, 1.27], true);
    expect(runTo(f, [2.8, 2.1])).toEqual([[2.75, 1.25], [2.75, 2]]);
  });

  it('with Shift a drag grows the 250 shown in 250 steps, the piece shown staying put', () => {
    const d = press([2.6, 1], true);
    expect(runTo(d, [2.7, 1])).toEqual([[2.5, 1], [2.75, 1]]);
    expect(runTo(d, [3.55, 1])).toEqual([[2.5, 1], [3.5, 1]]);
    expect(runTo(d, [1.7, 1])).toEqual([[2.75, 1], [1.75, 1]]);
  });

  it('dragged across, it turns at the end of the module nearest the press', () => {
    const d = press([2.8, 1]);
    expect(runTo(d, [2.9, 2.6])).toEqual([[3, 1], [3, 3]]);
    expect(runTo(d, [2.9, 0.4])).toEqual([[3, 1], [3, 0]]);
    // With Shift: the 250 shown turns at its end nearest the press, in 250 steps
    const f = press([2.8, 1], true);
    expect(runTo(f, [2.8, 1.8])).toEqual([[2.75, 1], [2.75, 1.75]]);
  });

  it('stays in the stand, at least one step', () => {
    const d = press([5.5, 1]);
    expect(runTo(d, [9, 1])).toEqual([[5, 1], [6, 1]]);
    const f = press([5.9, 1], true);
    expect(runTo(f, [9, 1])).toEqual([[5.75, 1], [6, 1]]);
  });

  it('Shift pressed or let go goes on from what is drawn; the key alone changes nothing', () => {
    let d = press([2.5, 1]);
    expect(runTo(d, [4.2, 1])).toEqual([[2, 1], [4, 1]]);
    d = rebaseRun(d, [4.2, 1], true);
    expect(runTo(d, [4.2, 1])).toEqual([[2, 1], [4, 1]]);
    expect(runTo(d, [4.7, 1])).toEqual([[2, 1], [4.5, 1]]);
    d = rebaseRun(d, [4.7, 1], false);
    expect(runTo(d, [4.7, 1])).toEqual([[2, 1], [4.5, 1]]);
    expect(runTo(d, [5.6, 1])).toEqual([[2, 1], [5.5, 1]]);
  });
});

describe('Takdrager in half metres (Byggeregel T8)', () => {
  const beamPress = (q: Point, fine = false) => startRun(stand, shownModule(stand, { x: q[0], y: q[1] }, fine, BEAM_UNIT), q, fine, BEAM_UNIT);
  it('without Shift whole metres as the other pens', () => {
    expect(runTo(beamPress([2.5, 1.05]), [4.7, 1.1])).toEqual([[2, 1], [5, 1]]);
  });
  it('with Shift or Fin it shows 500 on the 500 grid and grows in 500 steps', () => {
    expect(shownModule(stand, { x: 2.6, y: 1.05 }, true, BEAM_UNIT)).toMatchObject({ a: [2.5, 1], b: [3, 1] });
    const d = beamPress([2.6, 1.05], true);
    expect(runTo(d, [3.3, 1])).toEqual([[2.5, 1], [3.5, 1]]);
    expect(runTo(d, [4.8, 1])).toEqual([[2.5, 1], [5, 1]]);
  });
});

describe('Byggeregel X9: the textile pen with Fin draws in 10 mm (Bjørn 28.11.2026)', () => {
  // As pointer/run.ts: the module shown on the 250 grid, its shortest frame 250, the step 10 mm
  const textile = (q: Point) => startRun(stand, shownModule(stand, { x: q[0], y: q[1] }, true, RUN_UNIT), q, true, TEXTILE_UNIT, 25);
  it('X9 starts from 250 on the 250 grid and grows in 10 mm', () => {
    const d = textile([2.6, 1.05]);
    expect(runTo(d, [2.6, 1.05])).toEqual([[2.5, 1], [2.75, 1]]);
    expect(runTo(d, [3.734, 1.05])).toEqual([[2.5, 1], [3.73, 1]]);
  });
  it('X9 never shorter than the shortest frame', () => {
    const d = textile([2.6, 1.05]);
    expect(runTo(d, [2.55, 1.05])).toEqual([[2.5, 1], [2.75, 1]]);
  });
});
