/**
 * The bookmark (DESIGN 4.1): the only trace of the world that is saved. Planet seed, page index, clause, clock.
 * Resuming regenerates the pages from the seed and jumps to the page: enemies back, floor loot gone, racja full.
 * The exact-state return (enemies, loot, statuses) belongs to the service tunnel inside one session, not here.
 */
import { toPlan, type TicketPlan } from '../world/campaign';
import { LAWS, type LawId } from '../world/laws';
import type { RunState } from '../world/run';

export const BOOKMARK_VERSION = 1;

export interface Bookmark {
  version: number;
  ticketNumber: number;
  seed: number;
  /** 0-based index of the page the player stood on. */
  pageIndex: number;
  lawId: LawId;
  /** The run clock in seconds (it drives office hours, bot hours and the like). */
  clockS: number;
  /** "Planeta Dwudziesta Trzecia (Nieprzyjemna)" as it was printed on the ticket. */
  planetName: string;
  /** How many pages the planet had: page generation depends on it, so it is kept even when the seed alone would say. */
  pageCount: number;
  /** The campaign plan of the ticket (planet, priority, clause); absent for the older random tickets and older saves. */
  plan?: TicketPlan;
}

const isLaw = (v: unknown): v is LawId => typeof v === 'string' && LAWS.some((l) => l.id === v);

/** Take a bookmark of the run as it stands. */
export function bookmarkOf(s: RunState): Bookmark {
  return {
    version: BOOKMARK_VERSION,
    ticketNumber: s.ticket.number,
    seed: s.seed,
    pageIndex: s.pageIndex,
    lawId: s.ticket.lawId,
    clockS: Math.round(s.time * 100) / 100,
    planetName: s.ticket.planet,
    pageCount: s.pageCount,
    ...(s.plan ? { plan: { ...s.plan } } : {}),
  };
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validate whatever was stored; null when it cannot be used to resume (so the base offers nothing). */
export function toBookmark(raw: unknown): Bookmark | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const lawId = r['lawId'];
  if (!finite(r['ticketNumber']) || !finite(r['seed']) || !finite(r['pageIndex']) || !finite(r['clockS'])) return null;
  if (typeof lawId !== 'string' || !LAWS.some((l) => l.id === lawId)) return null;
  if (!finite(r['pageCount']) || r['pageCount'] < 1) return null;
  const pageCount = Math.floor(r['pageCount']);
  const plan = toPlan(r['plan'], isLaw);
  return {
    version: BOOKMARK_VERSION,
    ticketNumber: Math.floor(r['ticketNumber']),
    seed: r['seed'] >>> 0,
    pageIndex: Math.min(pageCount - 1, Math.max(0, Math.floor(r['pageIndex']))),
    lawId: lawId as LawId,
    clockS: Math.max(0, r['clockS']),
    planetName: typeof r['planetName'] === 'string' ? r['planetName'] : '',
    pageCount,
    ...(plan ? { plan } : {}),
  };
}

/**
 * Jump a freshly created run to the bookmarked page: the page is the one the seed makes, the player stands at its
 * entry, the clock is restored, and the page fills with enemies on the first step (`populate` is already set).
 */
export function applyBookmark(s: RunState, b: Bookmark): void {
  const index = Math.min(s.pages.length - 1, Math.max(0, b.pageIndex));
  const page = s.pages[index];
  if (!page) return;
  s.pageIndex = index;
  s.page = page;
  if (index > 0) {
    s.player.x = page.entry.x;
    s.player.y = page.entry.y;
  }
  s.time = b.clockS;
  s.populate = true;
}
