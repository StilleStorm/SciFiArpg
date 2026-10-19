import type { HeroId } from '../heroes';
import type { Theme } from '../render/stage';
import type { LawId } from '../world/laws';
import { toBookmark, type Bookmark } from './bookmark';
import type { Item } from '../items/types';
import { characterFromOldSave, emptyCharacter, isHeroId, toCharacter, type Character } from './character';

export const SAVE_KEY = 'zgloszenie.meta';
/**
 * 2: the character record replaced the stash and the top-level gwiazdki; the bookmark was added.
 * 3: a roster. `characters[]` each hold their own character, bookmark, Historia and personal archive; one `sharedArchive`;
 * `activeCharacterId`. In memory the active character is mirrored at the top level (`character`, `bookmark`, `history`,
 * `heroId`) so the run flow keeps working on `meta.character`; `syncActive` writes the mirror back into its record and
 * `toStored` (what goes to storage and into the Archiwum eksportowe) leaves the mirror out.
 */
export const SAVE_VERSION = 3;

/** Slots of a personal archive and of the shared one (ITEMS section 8). */
export const ARCHIVE_CAP = 40;
/** Most characters on one roster. */
export const MAX_CHARACTERS = 8;
/** Longest name of a character (a case number, typed or generated). */
export const NAME_MAX = 24;

/** One case file: everything that belongs to one character. */
export interface CharacterRecord {
  id: string;
  /** The case number as typed or generated ("0002"); the roster screen prints it after "nr sprawy". */
  name: string;
  character: Character;
  bookmark?: Bookmark;
  /** Historia zgloszen of this character, oldest first. */
  history: TicketEntry[];
  /** Personal archive, at most ARCHIVE_CAP. */
  archive: Item[];
}

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
  /** Text size step of footnotes, cards and forms: 0 = as printed, 1 = larger, 2 = largest. */
  textSize?: 0 | 1 | 2;
  /** Damage numbers in the margin beside a hit; off unless true. */
  damageNumbers?: boolean;
  /** The pause line "Zgłoś problem z grą"; on unless false. */
  bugButton?: boolean;
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
  /** The roster (SAVE_VERSION 3). The active record is stale until `syncActive`; read the active character through the mirror above. */
  characters: CharacterRecord[];
  /** The Archiwum shared by every character, at most ARCHIVE_CAP. */
  sharedArchive: Item[];
  /** Id of the character in `characters` that the mirror above shows; absent on an empty roster. */
  activeCharacterId?: string;
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
    characters: [],
    sharedArchive: [],
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

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function toItems(raw: unknown, cap: number): Item[] {
  return Array.isArray(raw) ? raw.filter((i) => isRecord(i) && !Array.isArray(i)).slice(0, cap).map((i) => clone(i) as Item) : [];
}

function toHistory(raw: unknown): TicketEntry[] {
  return Array.isArray(raw) ? raw.map(toEntry).filter((e): e is TicketEntry => e !== null).slice(-HISTORY_MAX) : [];
}

/** The next free `c<n>` id. */
export function nextCharacterId(records: readonly { id: string }[]): string {
  let top = 0;
  for (const r of records) {
    const m = /^c(\d+)$/.exec(r.id);
    if (m) top = Math.max(top, Number(m[1]));
  }
  return `c${Math.max(top, records.length) + 1}`;
}

/** The next unused case number as a name: "0001", "0002"... (the screens add the words). */
export function nextCaseName(records: readonly { name: string }[]): string {
  const used = new Set(records.map((r) => r.name));
  for (let n = records.length + 1; ; n++) {
    const name = String(n).padStart(4, '0');
    if (!used.has(name)) return name;
  }
}

function toRecord(raw: unknown, taken: readonly CharacterRecord[]): CharacterRecord | null {
  if (!isRecord(raw)) return null;
  const character = toCharacter(raw['character']);
  if (!character) return null;
  const rawId = raw['id'];
  const id = typeof rawId === 'string' && rawId !== '' && !taken.some((r) => r.id === rawId) ? rawId : nextCharacterId(taken);
  const rawName = typeof raw['name'] === 'string' ? raw['name'].trim().slice(0, NAME_MAX) : '';
  const name = rawName !== '' && !taken.some((r) => r.name === rawName) ? rawName : nextCaseName(taken);
  const bookmark = toBookmark(raw['bookmark']);
  return { id, name, character, ...(bookmark ? { bookmark } : {}), history: toHistory(raw['history']), archive: toItems(raw['archive'], ARCHIVE_CAP) };
}

/** Fields that are the roster's or the mirror's, so `migrate` does not carry them over as unknown extras. */
const MIRRORED = ['heroId', 'character', 'bookmark', 'history', 'stash', 'gwiazdki'] as const;
const OWN = ['version', 'stamps', 'runsCompleted', 'settings', 'characters', 'sharedArchive', 'activeCharacterId', ...MIRRORED] as const;

/** Put the active record on the top level (the mirror). The record is the truth for what `migrate` returns. */
export function withMirror(meta: MetaState): MetaState {
  const next: MetaState = { ...meta };
  for (const k of MIRRORED) delete next[k];
  const rec = meta.characters.find((r) => r.id === meta.activeCharacterId);
  if (!rec) {
    delete next.activeCharacterId;
    next.history = [];
    return next;
  }
  next.activeCharacterId = rec.id;
  next.heroId = rec.character.heroId;
  next.character = rec.character;
  if (rec.bookmark) next.bookmark = rec.bookmark;
  next.history = rec.history;
  return next;
}

/**
 * Write the mirror (`character`, `bookmark`, `history`) back into the active record. With no active record but a
 * character on the mirror (the run flow before the roster screen existed), a record is made for it and made active.
 */
export function syncActive(meta: MetaState): MetaState {
  const rec = meta.characters.find((r) => r.id === meta.activeCharacterId);
  if (!rec) {
    const hero = isHeroId(meta.heroId) ? meta.heroId : undefined;
    const character = meta.character ?? (hero || meta.history.length > 0 || meta.bookmark ? emptyCharacter(hero) : null);
    if (!character) return meta;
    const made: CharacterRecord = {
      id: nextCharacterId(meta.characters),
      name: nextCaseName(meta.characters),
      character,
      ...(meta.bookmark ? { bookmark: meta.bookmark } : {}),
      history: meta.history,
      archive: [],
    };
    return { ...meta, characters: [...meta.characters, made], activeCharacterId: made.id };
  }
  const synced: CharacterRecord = { id: rec.id, name: rec.name, character: meta.character ?? rec.character, history: meta.history, archive: rec.archive };
  if (meta.bookmark) synced.bookmark = meta.bookmark;
  // Key order is fixed (id, name, character, bookmark, history, archive) so a file read back writes the same bytes.
  const ordered: CharacterRecord = { id: synced.id, name: synced.name, character: synced.character, ...(synced.bookmark ? { bookmark: synced.bookmark } : {}), history: synced.history, archive: synced.archive };
  return { ...meta, characters: meta.characters.map((r) => (r === rec ? ordered : r)) };
}

/** Validate and migrate whatever was stored; unknown shapes fall back to defaults. v2 (one character) becomes a roster of one. */
export function migrate(raw: unknown): MetaState {
  const base = defaultMeta();
  if (!isRecord(raw) || Array.isArray(raw)) return base;
  const rawSettings = isRecord(raw['settings']) ? raw['settings'] : {};
  const theme = rawSettings['theme'];
  const orientation = rawSettings['orientation'];
  const steering = rawSettings['steering'];
  const out: MetaState = {
    ...raw,
    version: SAVE_VERSION,
    stamps: typeof raw['stamps'] === 'number' ? raw['stamps'] : base.stamps,
    runsCompleted: typeof raw['runsCompleted'] === 'number' ? raw['runsCompleted'] : base.runsCompleted,
    history: [],
    characters: [],
    sharedArchive: toItems(raw['sharedArchive'], ARCHIVE_CAP),
    settings: {
      theme: theme === 'day' || theme === 'night' || theme === 'auto' ? theme : base.settings.theme,
      leftHanded: rawSettings['leftHanded'] === true,
      musicVolume: toVolume(rawSettings['musicVolume'], DEFAULT_MUSIC_VOLUME),
      sfxVolume: toVolume(rawSettings['sfxVolume'], DEFAULT_SFX_VOLUME),
      ...(orientation === 'landscape' || orientation === 'portrait' ? { orientation } : {}),
      ...(steering === 'joystick' || steering === 'tap' ? { steering } : {}),
      ...(rawSettings['steeringTouched'] === true ? { steeringTouched: true } : {}),
      ...(rawSettings['textSize'] === 1 || rawSettings['textSize'] === 2 ? { textSize: rawSettings['textSize'] } : {}),
      ...(rawSettings['damageNumbers'] === true ? { damageNumbers: true } : {}),
      ...(rawSettings['bugButton'] === false ? { bugButton: false } : {}),
    },
  };
  for (const k of MIRRORED) delete out[k];
  delete out.activeCharacterId;
  const records: CharacterRecord[] = [];
  if (Array.isArray(raw['characters'])) {
    for (const r of raw['characters'].slice(0, MAX_CHARACTERS)) {
      const rec = toRecord(r, records);
      if (rec) records.push(rec);
    }
  }
  if (records.length === 0) {
    // v2 (or a mirror without a roster): the single character, its bookmark and its Historia become the first record.
    const character = toCharacter(raw['character']) ?? characterFromOldSave(raw);
    const hero = raw['heroId'];
    const legacyHistory = toHistory(raw['history']);
    const only = character ?? (isHeroId(hero) || legacyHistory.length > 0 || toBookmark(raw['bookmark']) ? emptyCharacter(isHeroId(hero) ? hero : undefined) : null);
    if (only) {
      const rec = toRecord({ character: only, bookmark: raw['bookmark'], history: legacyHistory, archive: [] }, records);
      if (rec) records.push(rec);
    }
  }
  out.characters = records;
  const active = raw['activeCharacterId'];
  const chosen = records.find((r) => r.id === active) ?? records[0];
  if (chosen) out.activeCharacterId = chosen.id;
  return withMirror(out);
}

/** What goes to storage and into the archive file: the roster without the mirror, written as `migrate` reads it. */
export function toStored(meta: MetaState): Record<string, unknown> {
  const m = migrate(syncStored(meta));
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(m)) if (!(OWN as readonly string[]).includes(k)) out[k] = m[k];
  out['version'] = m.version;
  out['stamps'] = m.stamps;
  out['runsCompleted'] = m.runsCompleted;
  out['settings'] = m.settings;
  out['characters'] = m.characters;
  out['sharedArchive'] = m.sharedArchive;
  if (m.activeCharacterId) out['activeCharacterId'] = m.activeCharacterId;
  return out;
}

/** The meta state as plain data with the mirror folded into its record, ready for `migrate`. */
function syncStored(meta: MetaState): Record<string, unknown> {
  const synced = syncActive(meta);
  const plain = clone(synced) as Record<string, unknown>;
  for (const k of MIRRORED) delete plain[k];
  return plain;
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
    store.setItem(SAVE_KEY, JSON.stringify(toStored(meta)));
    return true;
  } catch {
    return false;
  }
}
