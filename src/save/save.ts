import type { HeroId } from '../heroes';

export const SAVE_KEY = 'zgloszenie.meta';
export const SAVE_VERSION = 1;

export interface MetaState {
  version: number;
  heroId?: HeroId;
  stamps: number;
  runsCompleted: number;
}

export function defaultMeta(): MetaState {
  return { version: SAVE_VERSION, stamps: 0, runsCompleted: 0 };
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
  if (!isRecord(raw)) return base;
  const out: MetaState = {
    version: SAVE_VERSION,
    stamps: typeof raw['stamps'] === 'number' ? raw['stamps'] : base.stamps,
    runsCompleted: typeof raw['runsCompleted'] === 'number' ? raw['runsCompleted'] : base.runsCompleted,
  };
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
