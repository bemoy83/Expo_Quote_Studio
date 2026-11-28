// Checks Byggeregler N1 og X18 (docs/byggeregler.md): over the standard wall top, near a parallel neighbour boundary.
import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { paintWalls } from './edit';
import { facesNeighbour, neighbourNotes, neighbourSides, neighbourText, whiteToNeighbour } from './neighbour';
import { addFoil, foilBlocked } from './decor';
import { setWallRaise } from './raise';
import { addTextile, updateTextile } from './textile/inFrame';
import { createVariant } from './variant';
import { setTextileSize, updateFace } from './textile/edit';
import { addFreeTextile } from './textile/free';

const row = () => createVariant('A', { width: 6, depth: 3, type: 'row' });

describe('N1 neighbour approval', () => {
  it('Byggeregel X18: a tall textile wall on foot plates near a neighbour needs approval too, neutral when white toward them', () => {
    const r = addFreeTextile(row(), RULES, [1, 0.5], [4, 0.5]);
    if ('error' in r) throw new Error(r.error);
    const tall = setTextileSize(r.v, RULES, r.id, { height: 3.04 });
    // Run (1,0.5) → (4,0.5): face A is the left normal (0, 1), into the stand; face B looks toward the back neighbour
    expect(neighbourNotes(tall, RULES).filter((n) => n.side === 'back')).toEqual([{ kind: 'textile', id: r.id, side: 'back', distance: 0.48, top: 3040, neutral: false, face: 'b' }]);
    expect(neighbourNotes(updateFace(tall, r.id, 'b', { fill: 'white' }), RULES).find((n) => n.side === 'back')?.neutral).toBe(true);
    // At full height: nothing to approve
    expect(neighbourNotes(r.v, RULES)).toEqual([]);
  });

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

  it('Byggeregel N1: a textile face toward a near neighbour turns white by itself, its motif kept; farther in it stays', () => {
    const r = addFreeTextile(row(), RULES, [1, 0.5], [4, 0.5]);
    if ('error' in r) throw new Error(r.error);
    const tall = updateFace(setTextileSize(r.v, RULES, r.id, { height: 3.04 }), r.id, 'b', { motif: 'm1' });
    const w = whiteToNeighbour(tall, RULES);
    expect(w.faces).toEqual([{ id: r.id, face: 'b' }]);
    expect(w.v.textiles.find((t) => t.id === r.id)?.b).toEqual({ fill: 'white', motif: 'm1' });
    // Face A looks into the stand: kept printed
    expect(w.v.textiles.find((t) => t.id === r.id)?.a?.fill).toBeUndefined();
    // Already neutral: nothing to do, the same sketch back
    expect(whiteToNeighbour(w.v, RULES).v).toBe(w.v);
    // A metre in from the boundary print may face the neighbour
    const f = addFreeTextile(row(), RULES, [1, 1.5], [4, 1.5]);
    if ('error' in f) throw new Error(f.error);
    expect(whiteToNeighbour(setTextileSize(f.v, RULES, f.id, { height: 3.04 }), RULES).faces).toEqual([]);
  });

  it('Byggeregel N1: no print or decal on an upper felt facing a near neighbour; a metre in it may', () => {
    const near = paintWalls(row(), [1, 0.5], [4, 0.5]);
    const far = paintWalls(row(), [1, 1.5], [4, 1.5]);
    const id = (v: ReturnType<typeof row>) => v.walls[v.walls.length - 1].id;
    const vn = setWallRaise(near, id(near), 540);
    const vf = setWallRaise(far, id(far), 540);
    // The wall from (1,0.5) to (4,0.5): face 1 is the left normal (0, 1), into the stand; face −1 looks to the back
    expect(facesNeighbour(vn, RULES, id(vn), -1)).toBe(true);
    expect(facesNeighbour(vn, RULES, id(vn), 1)).toBe(false);
    expect(foilBlocked(vn, RULES, id(vn), 0, -1, true, true)).toMatch(/naboen/);
    expect(foilBlocked(vn, RULES, id(vn), 0, 1, true, true)).toBeNull();
    expect('error' in addFoil(vn, RULES, id(vn), 0, -1, undefined, 0, true)).toBe(true);
    expect(foilBlocked(vf, RULES, id(vf), 0, -1, true, true)).toBeNull();
  });
});
