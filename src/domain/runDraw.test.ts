// One drawing tool for straight runs (Bjørn 14.11.2026): the module shown stays put, Shift takes the end pressed by.
import { describe, expect, it } from 'vitest';
import { rebaseRun, runTo, shownModule, startRun } from './runDraw';
import type { Point, Stand } from './types';

const stand: Stand = { width: 6, depth: 3, type: 'row' };
const press = (q: Point, fine = false) => startRun(stand, shownModule(stand, { x: q[0], y: q[1] }), q, fine);

describe('run drawing', () => {
  it('without Shift the module shown stays and grows in whole metres', () => {
    const d = press([2.5, 1.05]);
    expect(runTo(d, [2.6, 1.05])).toEqual([[2, 1], [3, 1]]);
    expect(runTo(d, [4.7, 1.1])).toEqual([[2, 1], [5, 1]]);
    // The other way: laid from the end that stood still
    expect(runTo(d, [0.4, 1])).toEqual([[3, 1], [0, 1]]);
  });

  it('with Shift a press by an end takes that end, in 250 steps', () => {
    // By the high end of [2, 3]: the end moves, 2 stands
    const d = press([2.9, 1], true);
    expect(runTo(d, [3.75, 1])).toEqual([[2, 1], [3.75, 1]]);
    expect(runTo(d, [2.6, 1])).toEqual([[2, 1], [2.75, 1]]);
    // By the low end: 3 stands, laid from there
    const e = press([2.1, 1], true);
    expect(runTo(e, [1.35, 1])).toEqual([[3, 1], [1.25, 1]]);
  });

  it('dragged across, it turns at the end of the module nearest the press', () => {
    const d = press([2.8, 1]);
    expect(runTo(d, [2.9, 2.6])).toEqual([[3, 1], [3, 3]]);
    expect(runTo(d, [2.9, 0.4])).toEqual([[3, 1], [3, 0]]);
    // With Shift in 250 steps from the corner
    const f = press([2.8, 1], true);
    expect(runTo(f, [2.9, 1.8])).toEqual([[3, 1], [3, 1.75]]);
  });

  it('stays in the stand, at least one step', () => {
    const d = press([5.5, 1]);
    expect(runTo(d, [9, 1])).toEqual([[5, 1], [6, 1]]);
    const f = press([5.9, 1], true);
    expect(runTo(f, [3, 1])).toEqual([[5, 1], [5.25, 1]]);
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
