/** Pure rules of the roster screens: names typed as case numbers, the error words, the three places an item can stand. */
import { t } from '../i18n';
import { ARCHIVE_CAP, MAX_CHARACTERS, NAME_MAX } from '../save/save';
import { ZONES, zoneCap, type Zone } from '../save/roster';

export { ARCHIVE_CAP, NAME_MAX };
export type ArchivePlace = Zone;
export const ARCHIVE_PLACES: readonly ArchivePlace[] = ZONES;
export const ROSTER_LIMIT = MAX_CHARACTERS;
export const capacityOf = (place: ArchivePlace): number => zoneCap(place);

/** Codes the screens understand; the text is `screens.error.<code>` and an unknown code gets `screens.error.unknown`. */
export type RosterError = 'nameEmpty' | 'nameLong' | 'nameTaken' | 'rosterFull' | 'noCharacter' | 'writeFailed' | 'archiveFull' | 'bagFull' | 'noItem' | 'samePlace';
const KNOWN_ERRORS: readonly string[] = ['nameEmpty', 'nameLong', 'nameTaken', 'rosterFull', 'noCharacter', 'writeFailed', 'archiveFull', 'bagFull', 'noItem', 'samePlace'];

export function errorText(code: string): string {
  return KNOWN_ERRORS.includes(code) ? t(`screens.error.${code}`, { max: NAME_MAX }) : t('screens.error.unknown');
}

const sameName = (a: string, b: string): boolean => a.trim().toLocaleLowerCase('pl') === b.trim().toLocaleLowerCase('pl');

/** A typed case number: trimmed, one to NAME_MAX characters, not the number of another case file. */
export function checkName(raw: string, existing: readonly string[]): { ok: true; name: string } | { ok: false; error: RosterError } {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length === 0) return { ok: false, error: 'nameEmpty' };
  if (name.length > NAME_MAX) return { ok: false, error: 'nameLong' };
  if (existing.some((e) => sameName(e, name))) return { ok: false, error: 'nameTaken' };
  return { ok: true, name };
}

/** How a stored case number is printed: "Sprawa nr 0003". */
export const caseTitle = (name: string): string => t('screens.roster.caseTitle', { name });
