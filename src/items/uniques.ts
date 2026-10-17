import { t } from '../i18n';
import { BASES_BY_ID } from './bases';
import { emptyStats, type Item, type Slot, type StatBlock, type Tag } from './types';

export interface UniqueDef {
  id: string;
  baseId: string;
  stats: Partial<StatBlock>;
  likes?: Tag;
  dislikes?: Tag;
}

/**
 * Hand-written uniques. Texts in i18n: items.unique.<id>.{name,desc,story,note}
 * (story = 2-3 sentences shown on the card, note = one line used as the pickup footnote).
 */
export const UNIQUES: readonly UniqueDef[] = [
  { id: 'odmowa', baseId: 'pieczatka', stats: { dmgMin: 8, dmgMax: 14, pewnosc: 12, crit: 4, resRegulaminowy: 10 }, likes: 'papier', dislikes: 'chaos' },
  { id: 'kabelrozny', baseId: 'kabel', stats: { dmgMin: 7, dmgMax: 13, pewnosc: 8, crit: 6 }, likes: 'metal', dislikes: 'porzadek' },
  { id: 'regulamin43', baseId: 'regulamin', stats: { resRegulaminowy: 25, upor: 14, racja: 12 }, likes: 'papier', dislikes: 'watpliwosc' },
  { id: 'kaskmili', baseId: 'kask', stats: { upor: 18, racja: 20, resMechaniczny: 10 }, likes: 'metal', dislikes: 'halas' },
  { id: 'cisza', baseId: 'sluchawki', stats: { resEgzystencjalny: 22, pewnosc: 14, upor: 6 }, likes: 'watpliwosc', dislikes: 'halas' },
  { id: 'istnienie', baseId: 'zaswiadczenie', stats: { resEgzystencjalny: 18, racja: 24, resMechaniczny: 8 }, likes: 'papier', dislikes: 'chaos' },
];

export const UNIQUES_BY_ID: ReadonlyMap<string, UniqueDef> = new Map(UNIQUES.map((u) => [u.id, u]));

export function uniquesForSlot(slot?: Slot): UniqueDef[] {
  if (!slot) return [...UNIQUES];
  return UNIQUES.filter((u) => BASES_BY_ID.get(u.baseId)?.slot === slot);
}

export const uniqueName = (id: string): string => t(`items.unique.${id}.name`);
export const uniqueStory = (id: string): string => t(`items.unique.${id}.story`);
export const uniqueNote = (id: string): string => t(`items.unique.${id}.note`);

/** Build a unique. No reviews: what the card says is what it does. */
export function makeUnique(def: UniqueDef, uid: number, level: number): Item | null {
  const base = BASES_BY_ID.get(def.baseId);
  if (!base) return null;
  const scale = 1 + 0.06 * (Math.max(1, level) - 1);
  const stats = emptyStats();
  for (const [k, v] of Object.entries({ ...base.stats, ...def.stats }) as [keyof StatBlock, number][]) {
    stats[k] = Math.round(v * scale);
  }
  const item: Item = {
    uid,
    number: 0,
    name: uniqueName(def.id),
    slot: base.slot,
    baseId: base.id,
    gender: base.gender,
    tier: 'unikatowy',
    level,
    affixes: [],
    drawing: base.drawing,
    claimed: stats,
    actual: { ...stats },
    revealed: true,
    trialKills: 0,
    trialTarget: 0,
    uniqueId: def.id,
  };
  if (def.likes) item.likes = def.likes;
  if (def.dislikes) item.dislikes = def.dislikes;
  if (base.damageType) item.damageType = base.damageType;
  if (base.range !== undefined) item.range = base.range;
  if (base.cooldownMul !== undefined) item.cooldownMul = base.cooldownMul;
  return item;
}
