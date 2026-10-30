import { describe, expect, it } from 'vitest';
import { toCsvText } from './csv';

describe('toCsvText', () => {
  it('joins with semicolons, starts with a BOM and quotes only where needed', () => {
    expect(toCsvText([['Varenr', 'Navn'], [5276, 'Ståbord; sort'], ['x', 'si "hei"']])).toBe('﻿Varenr;Navn\n5276;"Ståbord; sort"\nx;"si ""hei"""');
  });
});
