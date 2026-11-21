// Test helper: textile walls written as before, mounted ones as spans along their walls, put into a variant as the runs
// it stores (Byggeregel X13). The walls must be there first.
import { runOnWall } from '../domain/textile/mounts';
import type { FreeTextile, TextileWall, Variant } from '../domain/types';

export const withTextiles = <V extends Pick<Variant, 'walls' | 'textiles' | 'stand'>>(v: V, list: readonly (TextileWall | FreeTextile)[]): V => ({
  ...v,
  textiles: list.flatMap((t) => ('wallId' in t ? (runOnWall(v, t) ?? []) : [t])),
});
