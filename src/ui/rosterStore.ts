/**
 * The roster as the screens see it: case files, one active, and the three places an item can stand (bag, personal archive,
 * shared archive). A thin adapter over save/roster.ts (pure functions on the meta state) and storage: every call reads the
 * stored meta state, applies one change and writes it back; main.ts saves the live run before it calls and reloads after.
 * The only place the UI touches the save API, and the only place that turns its error codes into the screens' own.
 */
import type { HeroId } from '../heroes';
import type { Item } from '../items/types';
import { createCharacter, deleteCharacter, itemsIn, moveItem, rosterOf, selectCharacter, type MoveError, type Zone } from '../save/roster';
import type { Character } from '../save/character';
import { loadMeta, saveMeta, nextCaseName, type MetaState } from '../save/save';
import { checkName, ROSTER_LIMIT, type ArchivePlace } from './rosterModel';

export interface CaseFile {
  id: string;
  /** The case number as stored ("0003"); the screens print it after "Sprawa nr". */
  name: string;
  heroId: HeroId;
  level: number;
  /** The planet of the ticket left open, if any. */
  planet: string | null;
  tickets: number;
  active: boolean;
}

/** `error` is a code (`rosterModel.ts RosterError`); the text is `errorText(code)`. */
export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

export type Places = Record<ArchivePlace, Item[]>;

export interface RosterStore {
  limit: number;
  /** The case files in the order they were opened. */
  files(): CaseFile[];
  /** The case number a new file gets unless the player types one. */
  nextName(): string;
  create(heroId: HeroId, name: string): Result<string>;
  /** Make this file the active one: the meta state then mirrors its character, bookmark and history. */
  select(id: string): Result;
  remove(id: string): Result;
  characterOf(id: string): Character | null;
  /** The active character's bag and personal archive and the shared archive, as they stand in storage now. */
  places(): Places;
  move(uid: number, from: ArchivePlace, to: ArchivePlace): Result<Item>;
  activeName(): string | null;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

function browserStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const moveError = (e: MoveError, to: Zone): string => {
  switch (e) {
    case 'noCharacter':
      return 'noCharacter';
    case 'missing':
      return 'noItem';
    case 'same':
      return 'samePlace';
    case 'full':
      return to === 'bag' ? 'bagFull' : 'archiveFull';
  }
};

export function createRosterStore(storage: Store | null = browserStore()): RosterStore {
  const load = (): MetaState => loadMeta(storage);
  const write = (meta: MetaState): boolean => saveMeta(meta, storage);
  const names = (meta: MetaState): string[] => rosterOf(meta).map((r) => r.name);

  return {
    limit: ROSTER_LIMIT,
    files() {
      const meta = load();
      return rosterOf(meta).map((r) => ({
        id: r.id,
        name: r.name,
        heroId: r.character.heroId,
        level: r.character.level,
        planet: r.bookmark?.planetName ?? null,
        tickets: r.history.length,
        active: r.id === meta.activeCharacterId,
      }));
    },
    nextName() {
      return nextCaseName(rosterOf(load()));
    },
    create(heroId, rawName) {
      const meta = load();
      if (rosterOf(meta).length >= ROSTER_LIMIT) return fail('rosterFull');
      const named = checkName(rawName, names(meta));
      if (!named.ok) return fail(named.error);
      const res = createCharacter(meta, heroId, named.name);
      if (!res.ok) return fail(res.error === 'full' ? 'rosterFull' : res.error === 'duplicate' ? 'nameTaken' : 'unknown');
      return write(res.meta) ? ok(res.id) : fail('writeFailed');
    },
    select(id) {
      const res = selectCharacter(load(), id);
      if (!res.ok) return fail('noCharacter');
      return write(res.meta) ? ok(undefined) : fail('writeFailed');
    },
    remove(id) {
      const res = deleteCharacter(load(), id);
      if (!res.ok) return fail('noCharacter');
      return write(res.meta) ? ok(undefined) : fail('writeFailed');
    },
    characterOf(id) {
      return rosterOf(load()).find((r) => r.id === id)?.character ?? null;
    },
    places() {
      const meta = load();
      return { bag: itemsIn(meta, 'bag'), personal: itemsIn(meta, 'personal'), shared: itemsIn(meta, 'shared') };
    },
    move(uid, from, to) {
      const meta = load();
      const index = itemsIn(meta, from).findIndex((i) => i.uid === uid);
      const res = moveItem(meta, { zone: from, index }, to);
      if (!res.ok) return fail(moveError(res.error, to));
      return write(res.meta) ? ok(res.item) : fail('writeFailed');
    },
    activeName() {
      const meta = load();
      return rosterOf(meta).find((r) => r.id === meta.activeCharacterId)?.name ?? null;
    },
  };
}

let current: RosterStore | null = null;
/** The store the screens use. */
export function rosterStore(): RosterStore {
  current ??= createRosterStore();
  return current;
}
