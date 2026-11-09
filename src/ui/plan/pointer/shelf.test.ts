// The shelf pen in the plan, and Velg, Tøm and Delete on a shelf: on a row stand 6 × 3 whose back wall runs from (0,0)
// to (6,0) with its face toward the stand at y > 0.
import { describe, expect, it, vi } from 'vitest';
import { addShelf, addShelfRow } from '../../../domain/shelves/edit';
import { shelvesOf } from '../../../domain/shelves/model';
import type { Variant } from '../../../domain/types';
import { createVariant } from '../../../domain/variant';
import { builtModules, standWallKeys } from '../../../domain/walls';
import { RULES } from '../../../rules/rules';
import { planScale } from '../planScale';
import { deleteSelection } from '../selection';
import { eraseTargetAt } from './erase';
import { planHits } from './hits';
import { startSelect } from './select';
import { shelf, startShelf } from './shelf';
import { shelfMove } from './shelfMove';
import type { PointerCtx } from './types';

const row = (): Variant => createVariant('A', { width: 6, depth: 3, type: 'row' });
const withShelf = () => {
  const r = addShelf(row(), RULES, 'side-back', 2, 1);
  if ('error' in r) throw new Error(r.error);
  return r;
};
const ctx = (v: Variant) => {
  const c = {
    v,
    selection: {},
    hits: planHits(v, builtModules(v), {}, () => planScale(100, {})),
    onEdit: vi.fn(),
    onToast: vi.fn(),
    onSelect: vi.fn(),
    onCheckpoint: vi.fn(),
  };
  return c as unknown as PointerCtx & typeof c;
};
const edited = (c: ReturnType<typeof ctx>) => (c.onEdit.mock.calls.at(-1)![0] as (v: Variant) => Variant)(c.v);

describe('the shelf pen', () => {
  it('a click in a free felt lays one shelf at 1300 mm', () => {
    const c = ctx(row());
    const d = startShelf(c, { x: 2.5, y: 0.2 })!;
    shelf.up!(c, d as never, { x: 2.5, y: 0.2 });
    expect(shelvesOf(edited(c))).toMatchObject([{ wallId: 'side-back', module: 2, side: 1, y: 1.3 }]);
  });

  it('a row drawn on from a shelf takes its height, so it stays one row (H2)', () => {
    const r = addShelf(row(), RULES, 'side-back', 2, 1, 0.9);
    if ('error' in r) throw new Error(r.error);
    const c = ctx(r.v);
    const d = startShelf(c, { x: 3.5, y: 0.2 })!;
    shelf.move!(c, d as never, { x: 4.5, y: 0.25 });
    shelf.up!(c, d as never, { x: 4.5, y: 0.25 });
    expect(shelvesOf(edited(c)).map((x) => [x.module, x.y])).toEqual([[2, 0.9], [3, 0.9], [4, 0.9]]);
  });

  it('a drag along the wall lays a row, skipping the felts by the corner posts (H6)', () => {
    const c = ctx(row());
    const d = startShelf(c, { x: 0.5, y: 0.2 })!;
    shelf.move!(c, d as never, { x: 3.5, y: 0.25 });
    shelf.up!(c, d as never, { x: 3.5, y: 0.25 });
    expect(shelvesOf(edited(c)).map((x) => x.module)).toEqual([1, 2, 3]);
  });

  it('a click in a felt with a shelf selects it and adds nothing', () => {
    const { v, id } = withShelf();
    const c = ctx(v);
    const d = startShelf(c, { x: 2.5, y: 0.2 })!;
    shelf.up!(c, d as never, { x: 2.5, y: 0.2 });
    expect(c.onEdit).not.toHaveBeenCalled();
    expect(c.onSelect).toHaveBeenCalledWith({ wallId: 'side-back', side: 1, shelfId: id });
  });

  it('a click by a corner post says why', () => {
    const c = ctx(row());
    const d = startShelf(c, { x: 0.5, y: 0.2 })!;
    shelf.up!(c, d as never, { x: 0.5, y: 0.2 });
    expect(c.onEdit).not.toHaveBeenCalled();
    expect(c.onToast.mock.calls[0][0]).toMatch(/kanal/);
  });
});

describe('a shelf in Velg, Tøm and Delete', () => {
  it('Velg on the board picks the shelf on its face', () => {
    const { v, id } = withShelf();
    const d = startSelect(ctx(v), { x: 2.5, y: 0.2 });
    expect('select' in d && d.select).toEqual({ wallId: 'side-back', side: 1, shelfId: id });
  });

  it('Velg drags a shelf with its row along the wall, and Alt leaves a copy (Bjørn 9.11.2026)', () => {
    const v = addShelfRow(row(), RULES, 'side-back', 1, 2, 1, 1.3).v;
    const c = ctx(v);
    const d = startSelect(c, { x: 1.5, y: 0.2 }) as Extract<ReturnType<typeof startSelect>, { kind: 'shelfMove' }>;
    expect(d).toMatchObject({ kind: 'shelfMove', ids: ['h1', 'h2'] });
    shelfMove.move!(c, d, { x: 3.5, y: 0.2 });
    expect(shelvesOf(edited(c)).map((x) => x.module)).toEqual([3, 4]);
    const e = startSelect(c, { x: 1.5, y: 0.2 }) as typeof d;
    e.copy = true;
    shelfMove.move!(c, e, { x: 3.5, y: 0.2 });
    expect(shelvesOf(edited(c)).map((x) => x.module)).toEqual([1, 2, 3, 4]);
  });

  it('Velg on the wall band picks the wall, on the board in front of it the shelf (zones as a textile wall)', () => {
    const { v, id } = withShelf();
    expect((startSelect(ctx(v), { x: 2.5, y: 0.01 }) as { select: object }).select).not.toHaveProperty('shelfId');
    expect((startSelect(ctx(v), { x: 2.5, y: 0.25 }) as { select: object }).select).toMatchObject({ shelfId: id });
  });

  it('Tøm takes the shelf before the wall behind it', () => {
    const { v, id } = withShelf();
    const t = eraseTargetAt(v, ctx(v).hits, standWallKeys(v), { x: 2.5, y: 0.2 })!;
    expect(t).toMatchObject({ group: 'shelf', id });
    expect(shelvesOf(t.erase(v))).toEqual([]);
  });

  it('Delete removes the shelf and keeps its wall drawer', () => {
    const { v, id } = withShelf();
    const d = deleteSelection(v, { wallId: 'side-back', side: 1, shelfId: id })!;
    expect(shelvesOf(d.edit(v))).toEqual([]);
    expect(d.select).toEqual({ wallId: 'side-back', side: 1 });
  });
});
