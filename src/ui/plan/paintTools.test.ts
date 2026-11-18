import { describe, expect, it } from 'vitest';
import { brushTo } from './paintTools';

describe('the brush, the same in the wall and the counter drawer', () => {
  it('lays its colour, and on the press gives a plate that has it its own again', () => {
    expect(brushTo('9010', '3020', '9010', false, true)).toBe('3020');
    expect(brushTo('3020', '3020', '9010', false, true)).toBe('9010');
  });
  it('a plate swept over that has the colour is left, a printed one is coloured (the last stroke wins)', () => {
    expect(brushTo('3020', '3020', '9010', false, false)).toBeNull();
    expect(brushTo('3020', '3020', '9010', true, false)).toBe('3020');
    expect(brushTo('3020', '3020', '9010', true, true)).toBe('3020');
  });
});
