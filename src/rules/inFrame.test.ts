import { describe, expect, it } from 'vitest';
import { ownInFrame, RULES } from './rules';

describe('InFrame assumptions kept in the browser', () => {
  const def = RULES.textile.inFrame;
  it('keeps only what differs from the default', () => {
    expect(ownInFrame({ ...def })).toEqual({});
    expect(ownInFrame({ ...def, bleed: 14 })).toEqual({ bleed: 14 });
  });
  it('a stored old default gives way to today’s', () => {
    expect(ownInFrame({ ...def, stag: 1000, bleed: 14 }, true)).toEqual({ bleed: 14 });
    // Set on Kostgrunnlag now, it is a choice
    expect(ownInFrame({ ...def, stag: 1000 })).toEqual({ stag: 1000 });
  });
  it('reads nothing from what is not an object', () => {
    expect(ownInFrame(null, true)).toEqual({});
  });
});
