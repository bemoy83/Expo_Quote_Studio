import { describe, expect, it } from 'vitest';
import { count, fmt, mm } from './format';

describe('format', () => {
  it('uses decimal comma, thin-space thousands and a real minus', () => {
    expect(fmt(1234.56)).toBe('1 234,6');
    expect(fmt(-2.5)).toBe('−2,5');
  });
  it('shows metres as whole millimetres', () => {
    expect(mm(0.08)).toBe('80');
    expect(mm(2.49)).toBe('2 490');
  });
  it('counts with singular or plural noun', () => {
    expect(count(1, 'plate', 'plater')).toBe('1 plate');
    expect(count(0, 'plate', 'plater')).toBe('0 plater');
    expect(count(3, 'plate', 'plater')).toBe('3 plater');
  });
});
