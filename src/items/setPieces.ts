/**
 * Building a set piece (ITEMS 4.1): fixed base, the set's tag as its like, two fixed affixes and one rolled, reviews and trial as any
 * rzadki. The rolled affix is never "w wersji próbnej" or "wycofany z obiegu" (a set piece must stay wearable and sellable), nor the free
 * version. Kept apart from items/sets.ts so that stats.ts can import the data without pulling in the generator.
 */
import type { Rng } from '../core/rng';
import { AFFIXES_BY_ID, randomAffixPool, type Affix } from './affixes';
import { BASES_BY_ID } from './bases';
import { buildItem } from './generate';
import { SETS_BY_ID, type SetId } from './sets';
import type { Item } from './types';

const NEVER: ReadonlySet<string> = new Set(['probny', 'wycofany', 'darmowy']);

function pickWeighted(rng: Rng, pool: readonly Affix[]): Affix | null {
  const total = pool.reduce((s, a) => s + a.weight, 0);
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (const a of pool) {
    r -= a.weight;
    if (r < 0) return a;
  }
  return pool[pool.length - 1] ?? null;
}

/** One piece of a set at an item level. `index` picks the piece (0..2); absent = one of the three at random. */
export function makeSetPiece(rng: Rng, setId: SetId, level: number, index?: 0 | 1 | 2): Item | null {
  const def = SETS_BY_ID.get(setId);
  if (!def) return null;
  const piece = def.pieces[index ?? (rng.int(0, 2) as 0 | 1 | 2)];
  const base = BASES_BY_ID.get(piece.baseId);
  if (!base) return null;
  const fixed = piece.affixes.map((id) => AFFIXES_BY_ID.get(id)).filter((a): a is Affix => a !== undefined);
  const pool = randomAffixPool(3, base.slot, fixed, base.excludeAffixes).filter((a) => !NEVER.has(a.id));
  const rolled = pickWeighted(rng, pool);
  const ids = [...piece.affixes, ...(rolled ? [rolled.id] : [])];
  const item = buildItem(rng, base, 'rzadki', Math.max(1, Math.round(level)), ids);
  item.setId = def.id;
  item.likes = def.tag;
  item.dislikes = piece.dislikes;
  return item;
}
