import type { HeroId } from '../heroes';
import type { Item, Slot } from '../items/types';
import type { Theme } from '../render/stage';
import type { LawId } from '../world/laws';

export const SAVE_KEY = 'zgloszenie.meta';
export const SAVE_VERSION = 1;

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
}

export const DEFAULT_MUSIC_VOLUME = 80;
export const DEFAULT_SFX_VOLUME = 100;

/** A saved volume: a whole number 0..100, or the default when it is missing or nonsense. */
export function toVolume(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : fallback;
}

/** What the player carries between runs (the Sklep at the base spends gwiazdki and fills it). */
export interface Stash {
  inventory: Item[];
  equipment: Partial<Record<Slot, Item>>;
}

export interface MetaState {
  version: number;
  heroId?: HeroId;
  stamps: number;
  /** Tickets closed (runs that ended, won or lost). */
  runsCompleted: number;
  /** Total gwiazdki carried back from runs (the Sklep spends them). */
  gwiazdki: number;
  /** Past runs, oldest first. */
  history: TicketEntry[];
  /** Items carried between runs; absent until the first run ends. */
  stash?: Stash;
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
    gwiazdki: 0,
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
  const out: MetaState = {
    ...raw,
    version: SAVE_VERSION,
    stamps: typeof raw['stamps'] === 'number' ? raw['stamps'] : base.stamps,
    runsCompleted: typeof raw['runsCompleted'] === 'number' ? raw['runsCompleted'] : base.runsCompleted,
    gwiazdki: typeof raw['gwiazdki'] === 'number' ? raw['gwiazdki'] : base.gwiazdki,
    history: history.slice(-HISTORY_MAX),
    settings: {
      theme: theme === 'day' || theme === 'night' || theme === 'auto' ? theme : base.settings.theme,
      leftHanded: rawSettings['leftHanded'] === true,
      musicVolume: toVolume(rawSettings['musicVolume'], DEFAULT_MUSIC_VOLUME),
      sfxVolume: toVolume(rawSettings['sfxVolume'], DEFAULT_SFX_VOLUME),
    },
  };
  delete out.heroId;
  delete out.stash;
  const rawStash = raw['stash'];
  if (isRecord(rawStash) && !Array.isArray(rawStash)) {
    const inv = rawStash['inventory'];
    const eq = rawStash['equipment'];
    out.stash = {
      inventory: Array.isArray(inv) ? (inv.filter(isRecord) as unknown as Item[]) : [],
      equipment: isRecord(eq) && !Array.isArray(eq) ? (eq as Partial<Record<Slot, Item>>) : {},
    };
  }
  const hero = raw['heroId'];
  if (hero === 'pralka' || hero === 'konsultant' || hero === 'petlowiec' || hero === 'kartograf') out.heroId = hero;
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
