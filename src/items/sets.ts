/**
 * Sets (zestawy, ITEMS 4.1): six, each on one compatibility tag. A piece is a rzadki item with a fixed base, the set's tag as its like,
 * two fixed affixes and one random (items/setPieces.ts builds them). Two worn pieces give the set's stat bonus, three give the named
 * effect on top. Data and pure counting only, so items/stats.ts may import it; nothing here rolls or builds an item.
 */
import type { ParagraphPatch } from '../heroes/paragraphs';
import type { Player } from '../entities/types';
import { SLOTS, emptyStats, type Item, type SetId, type StatBlock, type Tag } from './types';

export type { SetId };
export const SET_IDS: readonly SetId[] = ['obieg', 'ostatnia-mila', 'serwis', 'infolinia', 'domniemanie', 'awaria'];

/** Pieces a set has, and how many of them each bonus needs. */
export const SET_PIECES = 3;
export const SET_BONUS_PIECES = [2, 3] as const;

export interface SetPieceDef {
  baseId: string;
  /** The two fixed affixes (ids in items/affixes.ts); the third is rolled. */
  affixes: readonly [string, string];
  /** A piece likes the set's tag and dislikes this one (never the set's own). */
  dislikes: Tag;
}

/** The named effect of three pieces that is not a stat or a skill patch: checked by id in items/setFx.ts and the hero quirks. */
export type SetEffect = 'zgloszony-na-odparcie' | 'krytyk-podstawowej' | 'do-weryfikacji-pierwsze' | 'regula-podwojona' | 'ruchliwosc' | 'jedna-umiejetnosc';

export interface SetDef {
  id: SetId;
  tag: Tag;
  pieces: readonly [SetPieceDef, SetPieceDef, SetPieceDef];
  /** Two pieces: stats. */
  bonus2: Partial<StatBlock>;
  /** Two pieces: walking speed, as a fraction. */
  speed2?: number;
  /** Three pieces: the effect. */
  effect3: SetEffect;
  /** Three pieces: patches laid on named skills of whichever hero owns them (skill id -> patch). Ids a hero does not have are ignored. */
  skills3?: Readonly<Record<string, ParagraphPatch>>;
}

export const SETS: readonly SetDef[] = [
  {
    id: 'obieg',
    tag: 'papier',
    pieces: [
      { baseId: 'segregator', affixes: ['zgodny', 'zweryfikowany'], dislikes: 'chaos' },
      { baseId: 'fartuch', affixes: ['zgodny', 'odnowiony'], dislikes: 'halas' },
      { baseId: 'upowaznienie', affixes: ['podpisany', 'zweryfikowany'], dislikes: 'chaos' },
    ],
    bonus2: { resRegulaminowy: 12, pewnosc: 8 },
    effect3: 'zgloszony-na-odparcie',
  },
  {
    id: 'ostatnia-mila',
    tag: 'metal',
    pieces: [
      { baseId: 'kask', affixes: ['gwarancyjny', 'uzywany'], dislikes: 'porzadek' },
      { baseId: 'kamizelka', affixes: ['przemyslowy', 'wzmocniony'], dislikes: 'watpliwosc' },
      { baseId: 'powerbank', affixes: ['gwarancyjny', 'odnowiony'], dislikes: 'porzadek' },
    ],
    bonus2: { upor: 10 },
    speed2: 0.08,
    effect3: 'ruchliwosc',
    // the lvl 3 mobility gets more (SKILLS: Odwirowanie, Przerwa techniczna, Pętla, Korekta, Orbita)
    skills3: {
      odwirowanie: { reach: 1.3 },
      przerwaTechniczna: { reach: 1.35 },
      petla: { dur: 4 / 3 },
      korekta: { dur: 1.4 },
      orbita: { reach: 1.25 },
    },
  },
  {
    id: 'serwis',
    tag: 'porzadek',
    pieces: [
      { baseId: 'zszywacz', affixes: ['serwisowy', 'zweryfikowany'], dislikes: 'chaos' },
      { baseId: 'rekawiczki', affixes: ['gwarancyjny', 'uzywany'], dislikes: 'metal' },
      { baseId: 'pilot', affixes: ['serwisowy', 'zgodny'], dislikes: 'chaos' },
    ],
    bonus2: { tempo: -8 },
    effect3: 'krytyk-podstawowej',
  },
  {
    id: 'infolinia',
    tag: 'halas',
    pieces: [
      { baseId: 'sluchawki', affixes: ['udokumentowany', 'zweryfikowany'], dislikes: 'papier' },
      { baseId: 'koszulka', affixes: ['odnowiony', 'zgodny'], dislikes: 'watpliwosc' },
      { baseId: 'zegarek', affixes: ['kolekcjonerski', 'testowany'], dislikes: 'papier' },
    ],
    bonus2: { crit: 4, resEgzystencjalny: 6 },
    effect3: 'jedna-umiejetnosc',
    // one skill per hero (SKILLS: Wirowanie, Muzyka w słuchawce, Uwaga, Pomiar, Księżyc)
    skills3: {
      wirowanie: { area: 1.5 },
      muzyka: { area: 180 / 150 },
      uwaga: { count: 1 },
      pomiar: { cd: -2 },
      ksiezyc: { count: 1 },
    },
  },
  {
    id: 'domniemanie',
    tag: 'watpliwosc',
    pieces: [
      { baseId: 'lupa', affixes: ['dalekosiezny', 'zweryfikowany'], dislikes: 'halas' },
      { baseId: 'okulary', affixes: ['udokumentowany', 'zweryfikowany'], dislikes: 'chaos' },
      { baseId: 'certyfikat', affixes: ['udokumentowany', 'kolekcjonerski'], dislikes: 'halas' },
    ],
    bonus2: { resEgzystencjalny: 10 },
    effect3: 'do-weryfikacji-pierwsze',
  },
  {
    id: 'awaria',
    tag: 'chaos',
    pieces: [
      { baseId: 'kabel', affixes: ['markowy', 'zweryfikowany'], dislikes: 'porzadek' },
      { baseId: 'kaptur', affixes: ['odnowiony', 'gwarancyjny'], dislikes: 'papier' },
      { baseId: 'paragon', affixes: ['kolekcjonerski', 'oceniany'], dislikes: 'porzadek' },
    ],
    bonus2: { dmgMin: 2, dmgMax: 4 },
    effect3: 'regula-podwojona',
  },
];

export const SETS_BY_ID: ReadonlyMap<SetId, SetDef> = new Map(SETS.map((d) => [d.id, d]));

/** The set of a piece, if it is one. */
export const setOf = (item: Pick<Item, 'setId'>): SetDef | undefined => (item.setId ? SETS_BY_ID.get(item.setId) : undefined);

/** Worn pieces that count: the item is not niekompatybilny (call after `refreshCompat`). */
export type SetCounts = Partial<Record<SetId, number>>;

export function wornSetCounts(eq: Player['equipment']): SetCounts {
  const out: SetCounts = {};
  for (const slot of SLOTS) {
    const item = eq[slot];
    if (!item?.setId || (item.blockedBy && !item.adapter)) continue;
    out[item.setId] = (out[item.setId] ?? 0) + 1;
  }
  return out;
}

/** How many pieces of `id` this player wears (0 when none). */
export const piecesOf = (p: Pick<Player, 'sets'>, id: SetId): number => p.sets?.[id] ?? 0;

/** Set effect `id` is on: all three pieces of its set are worn. */
export const hasEffect = (p: Pick<Player, 'sets'>, effect: SetEffect): boolean => {
  const def = SETS.find((d) => d.effect3 === effect);
  return def !== undefined && piecesOf(p, def.id) >= SET_BONUS_PIECES[1];
};

/** The stat bonus of every set with two or more pieces worn. */
export function setBonusStats(counts: SetCounts): StatBlock {
  const sum = emptyStats();
  for (const def of SETS) {
    if ((counts[def.id] ?? 0) < SET_BONUS_PIECES[0]) continue;
    for (const [k, v] of Object.entries(def.bonus2) as [keyof StatBlock, number][]) sum[k] += v;
  }
  return sum;
}

/** Walking speed from sets, as a fraction on top of 1. */
export function setSpeedBonus(counts: SetCounts): number {
  let sum = 0;
  for (const def of SETS) if ((counts[def.id] ?? 0) >= SET_BONUS_PIECES[0]) sum += def.speed2 ?? 0;
  return sum;
}

/** The bonus line a card prints for the sets: which tier of each set a count reaches (0, 2 or 3). */
export const setLevel = (count: number): 0 | 2 | 3 => (count >= SET_BONUS_PIECES[1] ? 3 : count >= SET_BONUS_PIECES[0] ? 2 : 0);

/** Patches the worn three-piece sets lay on the skill `skillId`, in set order (empty when none). */
export function setSkillPatches(p: Pick<Player, 'sets'>, skillId: string): ParagraphPatch[] {
  const out: ParagraphPatch[] = [];
  for (const def of SETS) {
    if (piecesOf(p, def.id) < SET_BONUS_PIECES[1]) continue;
    const patch = def.skills3?.[skillId];
    if (patch) out.push(patch);
  }
  return out;
}
