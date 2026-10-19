import type { HeroId } from '../heroes';
import type { Theme } from '../render/stage';
import type { LawId } from '../world/laws';
import { toBookmark, type Bookmark } from './bookmark';
import { characterFromOldSave, isHeroId, toCharacter, type Character } from './character';

export const SAVE_KEY = 'zgloszenie.meta';
/** 2: the character record replaced the stash and the top-level gwiazdki; the bookmark was added. */
export const SAVE_VERSION = 2;

export type RunOutcome = 'zgloszenie' | 'petla' | 'zawieszenie' | 'ukonczono';

/** One line of the Historia zgloszen. */
export interface TicketEntry {
  number: number;
  /** "Planeta Dwudziesta Trzecia (Nieprzyjemna)" */
  planet: string;
  clause: LawId;
  outcome: RunOutcome;
  kills: number;
  /** Pages reached. */
  pages: number;
  /** Pages the planet had. */
  total?: number;
  /** The base screen already showed the "corrected" version of a lost run. */
  rewritten?: boolean;
}

export interface Settings {
  theme: Theme;
  leftHanded: boolean;
  /** Music volume 0..100 (default 80). */
  musicVolume: number;
  /** SFX volume 0..100 (default 100). */
  sfxVolume: number;
  /** Layout and lock the player asked for; absent = landscape (DESIGN 2). */
  orientation?: 'landscape' | 'portrait';
  /** Joystick or tap; only honoured once `steeringTouched`, until then the orientation decides (ui/layout.ts). */
  steering?: 'joystick' | 'tap';
  /** The player picked a steering mode himself, so it no longer follows the orientation. */
  steeringTouched?: boolean;
}

export const DEFAULT_MUSIC_VOLUME = 80;
export const DEFAULT_SFX_VOLUME = 100;

/** A saved volume: a whole number 0..100, or the default when it is missing or nonsense. */
export function toVolume(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : fallback;
}

export interface MetaState {
  version: number;
  heroId?: HeroId;
  stamps: number;
  /** Tickets closed (runs that ended, won or lost). */
  runsCompleted: number;
  /** Past runs, oldest first. */
  history: TicketEntry[];
  /** What the hero keeps between runs: level, updates, gear, bag, purse (save/character.ts). Absent until the first save. */
  character?: Character;
  /** The ticket in progress, if one was left unfinished (save/bookmark.ts); cleared when the ticket ends. */
  bookmark?: Bookmark;
  settings: Settings;
  /** Fields added by other domains are kept as they are. */
  [extra: string]: unknown;
}

export const OUTCOMES: readonly RunOutcome[] = ['zgloszenie', 'petla', 'zawieszenie', 'ukonczono'];
export const HISTORY_MAX = 40;

export function defaultMeta(): MetaState {
  return {
    version: SAVE_VERSION,
    stamps: 0,
    runsCompleted: 0,
    history: [],
    settings: { theme: 'auto', leftHanded: false, musicVolume: DEFAULT_MUSIC_VOLUME, sfxVolume: DEFAULT_SFX_VOLUME },
  };
}

function toEntry(raw: unknown): TicketEntry | null {
  if (!isRecord(raw)) return null;
  const outcome = raw['outcome'];
  const clause = raw['clause'];
  if (typeof raw['number'] !== 'number' || typeof raw['planet'] !== 'string' || typeof clause !== 'string') return null;
  if (typeof outcome !== 'string' || !OUTCOMES.includes(outcome as RunOutcome)) return null;
  const entry: TicketEntry = {
    number: raw['number'],
    planet: raw['planet'],
    clause: clause as LawId,
    outcome: outcome as RunOutcome,
    kills: typeof raw['kills'] === 'number' ? raw['kills'] : 0,
    pages: typeof raw['pages'] === 'number' ? raw['pages'] : 1,
  };
  if (typeof raw['total'] === 'number') entry.total = raw['total'];
  if (raw['rewritten'] === true) entry.rewritten = true;
  return entry;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function browserStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Validate and migrate whatever was stored; unknown shapes fall back to defaults. */
export function migrate(raw: unknown): MetaState {
  const base = defaultMeta();
  if (!isRecord(raw) || Array.isArray(raw)) return base;
  const rawSettings = isRecord(raw['settings']) ? raw['settings'] : {};
  const theme = rawSettings['theme'];
  const history = Array.isArray(raw['history']) ? raw['history'].map(toEntry).filter((e): e is TicketEntry => e !== null) : [];
  const orientation = rawSettings['orientation'];
  const steering = rawSettings['steering'];
  const out: MetaState = {
    ...raw,
    version: SAVE_VERSION,
    stamps: typeof raw['stamps'] === 'number' ? raw['stamps'] : base.stamps,
    runsCompleted: typeof raw['runsCompleted'] === 'number' ? raw['runsCompleted'] : base.runsCompleted,
    history: history.slice(-HISTORY_MAX),
    settings: {
      theme: theme === 'day' || theme === 'night' || theme === 'auto' ? theme : base.settings.theme,
      leftHanded: rawSettings['leftHanded'] === true,
      musicVolume: toVolume(rawSettings['musicVolume'], DEFAULT_MUSIC_VOLUME),
      sfxVolume: toVolume(rawSettings['sfxVolume'], DEFAULT_SFX_VOLUME),
      ...(orientation === 'landscape' || orientation === 'portrait' ? { orientation } : {}),
      ...(steering === 'joystick' || steering === 'tap' ? { steering } : {}),
      ...(rawSettings['steeringTouched'] === true ? { steeringTouched: true } : {}),
    },
  };
  delete out.heroId;
  delete out.stash;
  delete out.gwiazdki;
  delete out.character;
  delete out.bookmark;
  // The character: the new record, or the one an older save implies (its stash and its top-level gwiazdki).
  const character = toCharacter(raw['character']) ?? characterFromOldSave(raw);
  if (character) out.character = character;
  const bookmark = toBookmark(raw['bookmark']);
  if (bookmark) out.bookmark = bookmark;
  const hero = raw['heroId'];
  if (isHeroId(hero)) out.heroId = hero;
  return out;
}

export function loadMeta(store: Store | null = browserStore()): MetaState {
  try {
    const text = store?.getItem(SAVE_KEY);
    return text ? migrate(JSON.parse(text)) : defaultMeta();
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(meta: MetaState, store: Store | null = browserStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(SAVE_KEY, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}
