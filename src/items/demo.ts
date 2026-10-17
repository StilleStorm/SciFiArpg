import { createRng } from '../core/rng';
import type { Player } from '../entities/types';
import { BASES_BY_ID } from './bases';
import { buildItem, rollItem } from './generate';
import { equipItem } from './inventory';
import { revealItem } from './reviews';
import { recomputeStats } from './stats';
import { UNIQUES_BY_ID, makeUnique } from './uniques';
import { renameItem } from './rename';
import type { Item, ItemTier, Slot, Tag } from './types';

function make(baseId: string, tier: ItemTier, affixes: string[], number: number, level: number, tags?: [Tag, Tag]): Item {
  const base = BASES_BY_ID.get(baseId);
  if (!base) throw new Error(`demo base ${baseId}`);
  const item = buildItem(createRng(1000 + number), base, tier, level, affixes);
  item.number = number;
  if (tags) {
    item.likes = tags[0];
    item.dislikes = tags[1];
  }
  renameItem(item);
  return item;
}

/**
 * A fixed set of six items for screenshots and manual poking: two worn (the second clashes with
 * the first), a unique, a free version, a revealed liar and a plain one.
 */
export function fillDemoInventory(p: Player, level = 3): void {
  p.inventory.length = 0;
  for (const slot of Object.keys(p.equipment) as Slot[]) delete p.equipment[slot];
  const weapon = make('pieczatka', 'rzadki', ['zweryfikowany', 'sponsorowany'], 7, level, ['papier', 'halas']);
  const doc = make('certyfikat', 'rzadki', ['domniemany', 'gwarancyjny'], 14, level, ['chaos', 'papier']);
  const uniqueDef = UNIQUES_BY_ID.get('odmowa');
  const unique = uniqueDef ? makeUnique(uniqueDef, 4242, level) : null;
  const free = make('wskaznik', 'rzadki', ['ewentualny', 'darmowy'], 9, level, ['metal', 'chaos']);
  const liar = make('kask', 'nietypowy', ['odnowiony'], 3, level);
  const plain = make('kamizelka', 'zwykly', [], 11, level);
  liar.review = { truth: 'bought', rating: 4.9, count: 1873 };
  for (const k of Object.keys(liar.actual) as (keyof typeof liar.actual)[]) liar.actual[k] = Math.round(liar.claimed[k] * 0.65);
  revealItem(liar);
  if (unique) unique.number = 5;
  p.inventory.push(weapon, doc, ...(unique ? [unique] : []), free, liar, plain);
  equipItem(p, weapon);
  equipItem(p, doc);
  recomputeStats(p);
}

/** One random item for tests/hooks: `tier` may be any ItemTier. */
export function giveRandomItem(p: Player, number: number, tier: ItemTier, level: number, slot?: Slot): Item | null {
  const rng = createRng(0x51f15e ^ number ^ (p.inventory.length << 8));
  const item = rollItem(rng, slot ? { tier, level, slot } : { tier, level });
  item.number = number;
  if (p.inventory.length >= 20) return null;
  p.inventory.push(item);
  return item;
}
