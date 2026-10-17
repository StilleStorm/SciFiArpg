import { createRng } from '../core/rng';
import { FAMILY_IDS, type FamilyId } from '../enemies/ids';
import { t } from '../i18n';
import { LAWS, type LawId } from './laws';

/** Everything the ticket header says about a run. A pure function of the seed. */
export interface TicketInfo {
  /** The ticket number printed on the header (TICKET_BASE + tickets filed before). */
  number: number;
  lawId: LawId;
  /** The dominant enemy family of the mission. */
  family: FamilyId;
  pageCount: number;
  /** "Planeta Dwudziesta Trzecia (Nieprzyjemna)" */
  planet: string;
  /** "Planecie Dwudziestej Trzeciej" (locative, for the regulamin header). */
  planetLoc: string;
}

/** Ticket numbers start here; the nth filed ticket is TICKET_BASE + n. */
export const TICKET_BASE = 48213;

const list = (key: string): string[] => t(key).split('|');

/** Feminine ordinal for 1..59 in the nominative or the locative. */
export function ordinal(n: number, form: 'nom' | 'loc'): string {
  const units = list(`screens.planet.units_${form}`);
  const tens = list(`screens.planet.tens_${form}`);
  if (n < 20) return units[n - 1] ?? String(n);
  const ten = tens[Math.floor(n / 10) - 2] ?? '';
  const unit = n % 10 === 0 ? '' : ` ${units[(n % 10) - 1] ?? ''}`;
  return `${ten}${unit}`;
}

export function ticketForSeed(seed: number, number = TICKET_BASE): TicketInfo {
  const r = createRng(seed).fork('ticket');
  const lawId = r.pick(LAWS).id;
  const family = r.pick(FAMILY_IDS);
  const pageCount = r.int(4, 6);
  const n = r.int(2, 57);
  const adjectives = list('screens.planet.adjectives');
  const adj = r.pick(adjectives);
  return {
    number,
    lawId,
    family,
    pageCount,
    planet: t('screens.planet.name', { ordinal: ordinal(n, 'nom'), adjective: adj }),
    planetLoc: t('screens.planet.loc', { ordinal: ordinal(n, 'loc') }),
  };
}
