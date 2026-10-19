/**
 * The character record (DESIGN 4.1, save like Diablo 3): the one place where what a hero keeps between runs lives.
 * Level, reputacja, the taken updates, permissions, gear, bag and gwiazdki. It replaces the old `stash` and the old
 * top-level `gwiazdki` of the meta state, so there is one source of truth. The world is never in it (see bookmark.ts).
 * Serialising reads a run state; applying puts the record on a fresh run state before the first step.
 */
import type { HeroId } from '../heroes';
import { DEFAULT_HERO_ID, HERO_IDS } from '../heroes/registry';
import { specializationOf, ultimatesOf } from '../heroes/specializations';
import { ultRun } from '../heroes/ultimate';
import { recomputeStats } from '../items/stats';
import { SLOTS, type Item, type Slot } from '../items/types';
import { applyParagraphs, activeParagraphsOf, paragraphsOf, type ParagraphNo } from '../progression/paragraphs';
import { applyProgress, padsFrom, serializeProgress, type ProgressData } from '../progression/persist';
import type { RunState } from '../world/run';
import { HELD_CAP } from '../systems/recovery';

export const CHARACTER_VERSION = 1;

export { HERO_IDS };

export interface Character extends ProgressData {
  version: number;
  heroId: HeroId;
  /** The purse: carried into a run and back, spent in the Sklep at the base and at the kiosk. */
  gwiazdki: number;
  equipment: Partial<Record<Slot, Item>>;
  inventory: Item[];
  /** Active paragraph per skill id (S2); absent or a missing skill = paragraph 1, so saves from before load with § 1 active. */
  paragraphs?: Record<string, ParagraphNo>;
  /** Loadout (S4): the ultimate id and the specialization whose capstone is wanted; absent = the hero's first ultimate / none. Old saves load without them. */
  ultimate?: string;
  specialization?: string;
  /** The ultimate's active paragraph (2 or 3); absent = § 1. */
  ultParagraph?: ParagraphNo;
  /** Potwierdzenia held (0..5, systems/recovery.ts); absent = none, so older saves load. */
  potwierdzenia?: number;
}

export function isHeroId(v: unknown): v is HeroId {
  return typeof v === 'string' && (HERO_IDS as readonly string[]).includes(v);
}

export function emptyCharacter(heroId: HeroId = DEFAULT_HERO_ID): Character {
  return {
    version: CHARACTER_VERSION,
    heroId,
    level: 1,
    xp: 0,
    upgrades: {},
    permissions: [],
    pendingLevels: 0,
    pads: [0, 1, 2],
    gwiazdki: 0,
    equipment: {},
    inventory: [],
  };
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const num = (v: unknown, fallback: number, min = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : fallback);

/** Read what a hero keeps from a run state. The result is plain data and shares nothing with the state. */
export function serializeCharacter(s: RunState): Character {
  const p = s.player;
  const paragraphs = activeParagraphsOf(s);
  return {
    ...((p.potwierdzenia ?? 0) > 0 ? { potwierdzenia: p.potwierdzenia } : {}),
    ...(s.hero.ultimateId ? { ultimate: s.hero.ultimateId } : {}),
    ...(s.hero.spec ? { specialization: s.hero.spec } : {}),
    ...(s.hero.ult && s.hero.ult.para !== 1 ? { ultParagraph: s.hero.ult.para } : {}),
    ...(Object.keys(paragraphs).length > 0 ? { paragraphs } : {}),
    ...serializeProgress(s),
    version: CHARACTER_VERSION,
    heroId: p.heroId,
    gwiazdki: p.gwiazdki,
    equipment: clone(p.equipment),
    inventory: clone(p.inventory),
  };
}

/** Highest plate number among the carried items (the next pickup continues after it). */
export function highestNumber(c: Pick<Character, 'inventory' | 'equipment'>): number {
  let top = 0;
  for (const i of c.inventory) top = Math.max(top, i.number);
  for (const slot of SLOTS) top = Math.max(top, c.equipment[slot]?.number ?? 0);
  return top;
}

/**
 * Put the record on a fresh run state, before the first step. Gear and purse always come along; level, reputacja,
 * updates and permissions only when the hero is the same (they belong to the hero). Stats are recomputed from the gear
 * first, then the progress goes on top, and racja is full. The next plate number continues after the highest carried.
 */
export function applyCharacter(s: RunState, c: Character): void {
  const p = s.player;
  p.inventory = clone(c.inventory);
  p.equipment = clone(c.equipment);
  p.gwiazdki = c.gwiazdki;
  recomputeStats(p);
  if (c.potwierdzenia) p.potwierdzenia = Math.min(HELD_CAP, Math.max(0, Math.floor(c.potwierdzenia)));
  if (c.heroId === p.heroId) {
    applyProgress(s, c);
    applyParagraphs(s, c.paragraphs); // what is not open (an old or damaged save) stays on paragraph 1
    if (c.ultimate) s.hero.ultimateId = c.ultimate;
    if (c.specialization) s.hero.spec = c.specialization;
    if (c.ultParagraph) ultRun(s).para = c.ultParagraph;
  }
  p.hp = p.hpMax;
  s.nextItemNumber = Math.max(s.nextItemNumber, highestNumber(c) + 1);
}

/** Validate whatever was stored; null when it is not a character at all. Nothing here throws. */
export function toCharacter(raw: unknown): Character | null {
  if (!isRecord(raw) || !isHeroId(raw['heroId'])) return null;
  const rawEq = isRecord(raw['equipment']) ? raw['equipment'] : {};
  const equipment: Partial<Record<Slot, Item>> = {};
  for (const slot of SLOTS) {
    const it = rawEq[slot];
    if (isRecord(it)) equipment[slot] = clone(it) as unknown as Item;
  }
  const inv = Array.isArray(raw['inventory']) ? raw['inventory'].filter(isRecord).map((i) => clone(i) as unknown as Item) : [];
  const rawUp = isRecord(raw['upgrades']) ? raw['upgrades'] : {};
  const upgrades: Record<string, number> = {};
  for (const [id, rank] of Object.entries(rawUp)) if (typeof rank === 'number' && rank > 0) upgrades[id] = Math.floor(rank);
  const rawPara = isRecord(raw['paragraphs']) ? raw['paragraphs'] : {};
  const paragraphs: Record<string, ParagraphNo> = {};
  for (const [skill, n] of Object.entries(rawPara)) {
    if ((n === 2 || n === 3) && paragraphsOf(raw['heroId'], skill).length > 0) paragraphs[skill] = n;
  }
  const ultimate = typeof raw['ultimate'] === 'string' && ultimatesOf(raw['heroId']).includes(raw['ultimate']) ? raw['ultimate'] : undefined;
  const specialization = typeof raw['specialization'] === 'string' && specializationOf(raw['heroId'], raw['specialization']) ? raw['specialization'] : undefined;
  const rawUltPara = raw['ultParagraph'];
  const ultParagraph = rawUltPara === 2 || rawUltPara === 3 ? rawUltPara : undefined;
  const held = Math.min(HELD_CAP, Math.floor(num(raw['potwierdzenia'], 0)));
  const perms = Array.isArray(raw['permissions']) ? raw['permissions'].filter((x): x is string => typeof x === 'string') : [];
  return {
    version: CHARACTER_VERSION,
    heroId: raw['heroId'],
    level: Math.max(1, Math.floor(num(raw['level'], 1, 1))),
    xp: num(raw['xp'], 0),
    upgrades,
    permissions: perms,
    pendingLevels: Math.floor(num(raw['pendingLevels'], 0)),
    pads: padsFrom(raw['pads']),
    gwiazdki: Math.floor(num(raw['gwiazdki'], 0)),
    equipment,
    inventory: inv,
    ...(Object.keys(paragraphs).length > 0 ? { paragraphs } : {}),
    ...(ultimate ? { ultimate } : {}),
    ...(specialization ? { specialization } : {}),
    ...(ultParagraph ? { ultParagraph } : {}),
    ...(held > 0 ? { potwierdzenia: held } : {}),
  };
}

/**
 * The record that an old save implies: the stash (bag and gear) and the top-level gwiazdki of the meta state before
 * the character existed. Level, reputacja and updates did not persist then, so they start fresh. Null when the old
 * save had nothing of the sort.
 */
export function characterFromOldSave(raw: Record<string, unknown>): Character | null {
  const stash = isRecord(raw['stash']) ? raw['stash'] : null;
  const gwiazdki = typeof raw['gwiazdki'] === 'number' && Number.isFinite(raw['gwiazdki']) ? Math.max(0, Math.floor(raw['gwiazdki'])) : 0;
  if (!stash && gwiazdki === 0) return null;
  const hero = isHeroId(raw['heroId']) ? raw['heroId'] : DEFAULT_HERO_ID;
  return toCharacter({ ...emptyCharacter(hero), ...(stash ? { inventory: stash['inventory'], equipment: stash['equipment'] } : {}), gwiazdki });
}
