/**
 * The roster (S6): several characters, each with their own progress, bag, bookmark, Historia and personal archive, and
 * one Archiwum shared by all. Pure functions on the meta state: each returns the next state (or a typed error code the
 * screens map to text); storage is written by the caller (`saveMeta`). The active character is mirrored on the top level
 * of the meta state (`meta.character`, `meta.bookmark`, `meta.history`, `meta.heroId`), which is what the run flow reads
 * and writes; every function here folds that mirror into its record first (`syncActive`).
 */
import type { HeroId } from '../heroes';
import { INVENTORY_CAP } from '../items/inventory';
import { SLOTS, type Item } from '../items/types';
import { emptyCharacter, isHeroId } from './character';
import {
  ARCHIVE_CAP,
  MAX_CHARACTERS,
  NAME_MAX,
  nextCaseName,
  nextCharacterId,
  syncActive,
  withMirror,
  type CharacterRecord,
  type MetaState,
} from './save';

export { ARCHIVE_CAP, MAX_CHARACTERS, NAME_MAX };

/** Where an item lives: the active character's bag, the active character's personal archive, the shared archive. */
export type Zone = 'bag' | 'personal' | 'shared';
export const ZONES: readonly Zone[] = ['bag', 'personal', 'shared'];
export interface ItemPlace {
  zone: Zone;
  index: number;
}

export type RosterError = 'unknown' | 'hero' | 'full' | 'duplicate';
export type MoveError = 'noCharacter' | 'missing' | 'full' | 'same';

export type CreateResult = { ok: true; meta: MetaState; id: string } | { ok: false; error: 'hero' | 'full' | 'duplicate' };
export type RosterResult = { ok: true; meta: MetaState } | { ok: false; error: 'unknown' };
export type MoveResult = { ok: true; meta: MetaState; item: Item } | { ok: false; error: MoveError };

/** The roster, in the order the characters were made. */
export const rosterOf = (meta: MetaState): readonly CharacterRecord[] => syncActive(meta).characters;

/** The active character's record, folded up to date (its archive is the personal archive). Undefined on an empty roster. */
export function activeRecord(meta: MetaState): CharacterRecord | undefined {
  const m = syncActive(meta);
  return m.characters.find((r) => r.id === m.activeCharacterId);
}

/** Items in a zone of the active character (the shared archive needs no character). A copy of the list. */
export function itemsIn(meta: MetaState, zone: Zone): Item[] {
  if (zone === 'shared') return [...meta.sharedArchive];
  if (zone === 'bag') return [...(meta.character?.inventory ?? [])];
  return [...(activeRecord(meta)?.archive ?? [])];
}

/** Room for one more in a zone. */
export function zoneCap(zone: Zone): number {
  return zone === 'bag' ? INVENTORY_CAP : ARCHIVE_CAP;
}

/** A name as stored: trimmed, at most NAME_MAX characters; empty if nothing is left. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
}

/**
 * A new case file for a hero, made the active character. An empty name is generated (the next free case number as
 * "0003"). Errors: `hero` (not a hero id), `full` (MAX_CHARACTERS reached), `duplicate` (the name is taken).
 */
export function createCharacter(meta: MetaState, heroId: HeroId, name = ''): CreateResult {
  if (!isHeroId(heroId)) return { ok: false, error: 'hero' };
  const m = syncActive(meta);
  if (m.characters.length >= MAX_CHARACTERS) return { ok: false, error: 'full' };
  const typed = cleanName(name);
  if (typed !== '' && m.characters.some((r) => r.name === typed)) return { ok: false, error: 'duplicate' };
  const rec: CharacterRecord = {
    id: nextCharacterId(m.characters),
    name: typed !== '' ? typed : nextCaseName(m.characters),
    character: emptyCharacter(heroId),
    history: [],
    archive: [],
  };
  return { ok: true, id: rec.id, meta: withMirror({ ...m, characters: [...m.characters, rec], activeCharacterId: rec.id }) };
}

/** Make a character the active one (the mirror now shows it). Error: `unknown` id. */
export function selectCharacter(meta: MetaState, id: string): RosterResult {
  const m = syncActive(meta);
  if (!m.characters.some((r) => r.id === id)) return { ok: false, error: 'unknown' };
  return { ok: true, meta: withMirror({ ...m, activeCharacterId: id }) };
}

/**
 * Delete a character with their bag, equipment, bookmark, Historia and personal archive (the shared archive stays).
 * When it was the active one, the first remaining becomes active, or none on an empty roster. Error: `unknown` id.
 */
export function deleteCharacter(meta: MetaState, id: string): RosterResult {
  const m = syncActive(meta);
  if (!m.characters.some((r) => r.id === id)) return { ok: false, error: 'unknown' };
  const characters = m.characters.filter((r) => r.id !== id);
  const next: MetaState = { ...m, characters };
  if (m.activeCharacterId === id) {
    const first = characters[0];
    if (first) next.activeCharacterId = first.id;
    else delete next.activeCharacterId;
  }
  return { ok: true, meta: withMirror(next) };
}

function plateNumbers(c: { inventory: Item[]; equipment: Partial<Record<(typeof SLOTS)[number], Item>> }): Set<number> {
  const out = new Set<number>();
  for (const i of c.inventory) out.add(i.number);
  for (const s of SLOTS) {
    const e = c.equipment[s];
    if (e) out.add(e.number);
  }
  return out;
}

/**
 * Move one item from a place to another zone (it is appended). The bag holds INVENTORY_CAP (20), each archive
 * ARCHIVE_CAP (40). Errors: `noCharacter` (bag or personal archive with an empty roster), `missing` (nothing at that
 * index), `full` (the destination has no room), `same` (same zone). An item that enters a bag with a plate number the
 * bag or the gear already uses gets the next free number there.
 */
export function moveItem(meta: MetaState, from: ItemPlace, to: Zone): MoveResult {
  const m = syncActive(meta);
  const rec = m.characters.find((r) => r.id === m.activeCharacterId);
  if (!rec) return { ok: false, error: 'noCharacter' };
  if (from.zone === to) return { ok: false, error: 'same' };
  const lists: Record<Zone, Item[]> = { bag: [...rec.character.inventory], personal: [...rec.archive], shared: [...m.sharedArchive] };
  const item = lists[from.zone][from.index];
  if (!item || !Number.isInteger(from.index) || from.index < 0) return { ok: false, error: 'missing' };
  if (lists[to].length >= zoneCap(to)) return { ok: false, error: 'full' };
  lists[from.zone].splice(from.index, 1);
  let moved = item;
  if (to === 'bag') {
    const used = plateNumbers({ inventory: lists.bag, equipment: rec.character.equipment });
    if (moved.number > 0 && used.has(moved.number)) {
      let top = 0;
      for (const n of used) top = Math.max(top, n);
      moved = { ...moved, number: top + 1 };
    }
  }
  lists[to].push(moved);
  const character = { ...rec.character, inventory: lists.bag };
  const record: CharacterRecord = { ...rec, character, archive: lists.personal };
  const next: MetaState = { ...m, characters: m.characters.map((r) => (r.id === rec.id ? record : r)), sharedArchive: lists.shared };
  return { ok: true, item: moved, meta: withMirror(next) };
}
