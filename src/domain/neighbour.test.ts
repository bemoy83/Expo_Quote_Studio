// Checks Byggeregel N1 (docs/byggeregler.md): over the standard wall top, near a parallel neighbour boundary.
import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { paintWalls } from './edit';
import { neighbourNotes, neighbourSides, neighbourText } from './neighbour';
import { setWallRaise } from './raise';
import { addTextile, updateTextile } from './textile/inFrame';
import { createVariant } from './variant';

const row = () => createVariant('A', { width: 6, depth: 3, type: 'row' });

describe('N1 neighbour approval', () => {
  it('the neighbours are the sides not on an aisle', () => {
    expect(neighbourSides(row())).toEqual(['back', 'left', 'right']);
    expect(neighbourSides(createVariant('A', { width: 6, depth: 6, type: 'island' }))).toEqual([]);
  });

  it('a raised stand wall on the boundary needs approval; neutral in the organiser colour', () => {
    const v = setWallRaise(row(), 'side-back', 540);
    const [n] = neighbourNotes(v, RULES);
    expect(n).toMatchObject({ kind: 'wall', id: 'side-back', side: 'back', distance: 0, top: 3080, neutral: true });
    expect(neighbourText(n)).toBe('Krever godkjenning fra nabo');
    // Nothing over the standard top: no note
    expect(neighbourNotes(row(), RULES)).toEqual([]);
  });

  it('Byggeregel V20: a coloured upper felt stays neutral, the organiser’s plate stands back to back with it', () => {
    const v = setWallRaise(row(), 'side-back', 540);
    const coloured = { ...v, walls: v.walls.map((w) => (w.id === 'side-back' ? { ...w, plate: '3020' } : w)) };
    expect(neighbourNotes(coloured, RULES)[0]).toMatchObject({ neutral: true });
  });

  it('only closer than the distance, and only parallel to the boundary', () => {
    const near = paintWalls(row(), [1, 0.5], [4, 0.5]);
    const far = paintWalls(row(), [1, 2], [4, 2]);
    const id = (v: ReturnType<typeof row>) => v.walls[v.walls.length - 1].id;
    expect(neighbourNotes(setWallRaise(near, id(near), 540), RULES).map((n) => n.side)).toContain('back');
    expect(neighbourNotes(setWallRaise(far, id(far), 540), RULES).filter((n) => n.side === 'back')).toEqual([]);
    // A wall across the back boundary is not parallel to it: its end does not count
    const across = paintWalls(row(), [2, 0], [2, 2]);
    expect(neighbourNotes(setWallRaise(across, id(across), 540), RULES).filter((n) => n.side === 'back')).toEqual([]);
    // The distance is a value: another one needs no code
    const wide = { ...RULES, neighbour: { distance: 2.5 } };
    expect(neighbourNotes(setWallRaise(far, id(far), 540), wide).some((n) => n.side === 'back')).toBe(true);
  });

  it('a tall textile on the stand wall: its back over the wall is seen, hidden once the wall is raised as high', () => {
    const r = addTextile(row(), RULES, 'side-back', 1, 1)!;
    const tall = updateTextile(r.v, RULES, r.id, { height: 3.04 });
    const t = neighbourNotes(tall, RULES).find((n) => n.kind === 'textile')!;
    expect(t).toMatchObject({ side: 'back', top: 3040, neutral: false });
    expect(neighbourText(t)).toBe('Krever godkjenning fra nabo og nøytral side mot naboen');
    // Raised to 3080 the wall hides it: approval still needed, but neutral
    const raised = setWallRaise(tall, 'side-back', 540);
    expect(neighbourNotes(raised, RULES).find((n) => n.kind === 'textile')).toMatchObject({ neutral: true });
  });
});
