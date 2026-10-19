/**
 * The pure part of the ticket form and the cards: the campaign view the ticket reads and which card a base entry shows.
 * The priority table, the planets and the per-character campaign state are world/campaign.ts's; this file only adapts
 * them to what the form and the cards draw. No DOM here, so it is tested (ticketModel.test.ts).
 */
import { PLANET_COUNT, type CampaignState, type CardsSeen, type TicketPlan } from '../world/campaign';

export { noCardsSeen, type CardsSeen } from '../world/campaign';

/** What the ticket form and the cards need to know of the character's campaign (planet indices are 0..8). */
export interface CampaignView {
  /** The planet of the ticket on the desk. */
  planetIndex: number;
  /** Planets already closed, in order. */
  closed: number[];
  /** The case is closed: free travel and the extra tickets are offered. */
  caseClosed: boolean;
  /** The return ticket to planet 1 (the finale). */
  finale: boolean;
}

export function startOfCampaign(): CampaignView {
  return { planetIndex: 0, closed: [], caseClosed: false, finale: false };
}

/** The view of a campaign with the plan on the desk (the plan's planet wins: travel and extras go elsewhere than `current`). */
export function campaignViewOf(c: CampaignState, plan?: TicketPlan): CampaignView {
  return {
    planetIndex: plan ? plan.planet : c.current,
    closed: [...c.closed],
    caseClosed: c.caseClosed,
    finale: plan ? plan.kind === 'final' : c.finalTicket,
  };
}

export const actOf = (planetIndex: number): 1 | 2 | 3 => (planetIndex < 3 ? 1 : planetIndex < 6 ? 2 : 3);
export const ACT_ROMAN = ['I', 'II', 'III'] as const;

export type CardKind = 'opening' | 'chapter' | 'rewritten';

export interface CardSpec {
  kind: CardKind;
  planetIndex: number;
}

/**
 * The card a new ticket's base entry shows. The first ticket of a character gets the opening page; the first visit of a
 * planet its chapter card; a return to a closed planet (free travel) the same card rewritten in red. Null: nothing.
 */
export function cardToShow(view: CampaignView, seen: CardsSeen, ticketsFiled: number): CardSpec | null {
  const planetIndex = Math.min(Math.max(view.planetIndex, 0), PLANET_COUNT - 1);
  if (!seen.opening && ticketsFiled === 0) return { kind: 'opening', planetIndex };
  if (view.caseClosed && view.closed.includes(planetIndex)) {
    return seen.chapters.includes(-1 - planetIndex) ? null : { kind: 'rewritten', planetIndex };
  }
  if (!seen.chapters.includes(planetIndex)) return { kind: 'chapter', planetIndex };
  return null;
}

/** Record a card as shown. A rewritten card is remembered as -1 - planetIndex so it shows once per planet too. */
export function markShown(seen: CardsSeen, card: CardSpec): CardsSeen {
  if (card.kind === 'opening') return { opening: true, chapters: [...seen.chapters, ...(seen.chapters.includes(card.planetIndex) ? [] : [card.planetIndex])] };
  const key = card.kind === 'rewritten' ? -1 - card.planetIndex : card.planetIndex;
  return seen.chapters.includes(key) ? seen : { ...seen, chapters: [...seen.chapters, key] };
}
