import { t } from '../i18n';
import { BASES_BY_ID } from './bases';
import type { Player } from '../entities/types';
import { SLOTS, emptyStats, type Item, type ItemGrant, type Slot, type StatBlock, type Tag } from './types';

/** What a unique does for a hero's skill while it is worn (ITEMS 4.2, 12.2): +ranks, the skill unlocked, and the paragraph carried. */
export interface UniqueGrant {
  /** `SkillDef.id`: never a hero id; the hero it concerns is the one that owns the skill (heroes/grants.ts). */
  skill: string;
  /** Always an existing § 2 or § 3 (ITEMS 4.2): a unique adds no behaviour the paragraph system does not own. */
  para: 2 | 3;
  ranks: 1 | 2;
}

export interface UniqueDef {
  id: string;
  baseId: string;
  stats: Partial<StatBlock>;
  likes?: Tag;
  dislikes?: Tag;
  /** The ten paragraph uniques (S17); the six older ones have stats only. */
  grant?: UniqueGrant;
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
  // S17: one paragraph of one skill each (ITEMS 4.2), two per hero. Stats are roughly the rzadki budget plus 20%. Flat stats only:
  // makeUnique scales every number by the item level, which a percentage must not be.
  { id: 'program95', baseId: 'pilot', stats: { pewnosc: 14, crit: 4, resMechaniczny: 8, upor: 6 }, likes: 'porzadek', dislikes: 'chaos', grant: { skill: 'wirowanie', para: 3, ranks: 2 } },
  { id: 'pralnia', baseId: 'kombinezon', stats: { upor: 14, racja: 22, resMechaniczny: 10 }, likes: 'porzadek', dislikes: 'halas', grant: { skill: 'pranieWstepne', para: 2, ranks: 1 } },
  { id: 'oczekiwanie', baseId: 'zegarek', stats: { crit: 4, pewnosc: 12, resEgzystencjalny: 12, racja: 8 }, likes: 'halas', dislikes: 'porzadek', grant: { skill: 'prosze', para: 3, ranks: 2 } },
  { id: 'windykacja', baseId: 'daszek', stats: { crit: 8, pewnosc: 14, resRegulaminowy: 10, upor: 6 }, likes: 'halas', dislikes: 'watpliwosc', grant: { skill: 'rozlaczenie', para: 3, ranks: 2 } },
  { id: 'przedwykonaniem', baseId: 'faktura', stats: { resRegulaminowy: 16, pewnosc: 8, racja: 12, upor: 6 }, likes: 'papier', dislikes: 'chaos', grant: { skill: 'spor', para: 2, ranks: 1 } },
  { id: 'zapasowe', baseId: 'szelki', stats: { upor: 12, racja: 20, resRegulaminowy: 10, pewnosc: 6 }, likes: 'metal', dislikes: 'watpliwosc', grant: { skill: 'przybycie', para: 2, ranks: 1 } },
  { id: 'granica', baseId: 'wskaznik', stats: { dmgMin: 7, dmgMax: 12, pewnosc: 12, crit: 4, resRegulaminowy: 8 }, likes: 'papier', dislikes: 'chaos', grant: { skill: 'triangulacja', para: 3, ranks: 2 } },
  { id: 'bladpomiaru', baseId: 'polisa', stats: { racja: 24, resMechaniczny: 14, resRegulaminowy: 8, pewnosc: 8 }, likes: 'watpliwosc', dislikes: 'porzadek', grant: { skill: 'korekta', para: 2, ranks: 1 } },
  { id: 'masaplanety', baseId: 'liczydlo', stats: { pewnosc: 10, upor: 14, racja: 14, resMechaniczny: 8 }, likes: 'metal', dislikes: 'halas', grant: { skill: 'grawitacja', para: 2, ranks: 1 } },
  { id: 'atmosfera', baseId: 'czepek', stats: { upor: 14, resRegulaminowy: 12, resMechaniczny: 10, racja: 10 }, likes: 'porzadek', dislikes: 'halas', grant: { skill: 'ksiezyc', para: 3, ranks: 2 } },
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

/** What the worn uniques give the hero's skills: one grant per unique that is worn and not niekompatybilny (call after `refreshCompat`). */
export function grantsOf(eq: Player['equipment']): ItemGrant[] {
  const out: ItemGrant[] = [];
  for (const slot of SLOTS) {
    const item = eq[slot];
    const grant = item?.uniqueId ? UNIQUES_BY_ID.get(item.uniqueId)?.grant : undefined;
    if (!item || !grant || (item.blockedBy && !item.adapter)) continue;
    out.push({ uid: item.uid, uniqueId: item.uniqueId ?? '', ...grant });
  }
  return out;
}

/** The unique's grant, if the item is one of the ten paragraph uniques. */
export const grantOfItem = (item: Pick<Item, 'uniqueId'>): UniqueGrant | undefined => (item.uniqueId ? UNIQUES_BY_ID.get(item.uniqueId)?.grant : undefined);
