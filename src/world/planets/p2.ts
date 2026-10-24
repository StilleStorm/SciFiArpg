/**
 * Planeta Dwudziesta Czwarta (Zaległa), STORY 8.2: the clerk of its base, its three hand-written side tickets, the variant of its boss
 * and its gate. Its location types are data in `locations.ts` (magazyn, serwerownia) with drawings in `render/locations/`; its record
 * (law pool, headline clause, base layouts, location list and split, the gate on page 2) is `PLANETS[1]` in world/campaign.ts; its
 * texts are `story.p2.*`. Imported once through `planets/index.ts`.
 *
 * The gate (page 2, 0-based page 1): the exit corner is walled with parcels and a Magazynier stands at the gap. It lifts when the
 * one forced teczka of the page, the "list przewozowy" (`Teczka.key`, placed by `world/gate.ts placeKeyTeczka`), is opened.
 */
import { registerBossVariant } from '../../enemies/bosses';
import { registerNpc } from '../npc';
import { registerSideTickets, type QuestDef } from '../quests';

export const P2 = 1;

/** The clerk: Starszy Referent ds. Zaległości (`story.p2.clerk.*`); look seed 2. */
registerNpc(P2, {
  id: 'p2-referent',
  nameKey: 'story.p2.clerk.name',
  roleKey: 'story.p2.clerk.role',
  lineKeys: ['story.p2.clerk.line0', 'story.p2.clerk.line1', 'story.p2.clerk.line2'],
  look: 2,
});

const ticket = (k: 'a' | 'b' | 'c', def: Omit<QuestDef, 'id' | 'planet' | 'titleKey' | 'textKey'>): QuestDef => ({
  id: `h:p2:${k}`,
  planet: P2,
  titleKey: `story.p2.ticket.${k}.title`,
  textKey: `story.p2.ticket.${k}.text`,
  ...def,
});

/** Awizo zwrotne (deliver 1), Wyciszenie (kill 8 Powiadomienia), Kopie zapasowe (fetch 4). */
export const P2_TICKETS: readonly QuestDef[] = [
  ticket('a', { kind: 'deliver', n: 1, reward: { stars: 35, permission: 'urzadzenia' } }),
  ticket('b', { kind: 'kill', n: 8, family: 'powiadomienia', reward: { stars: 25, potwierdzenia: 1 } }),
  ticket('c', { kind: 'fetch', n: 4, reward: { stars: 25 } }),
];
registerSideTickets(P2_TICKETS);

/** Prototyp, seria 2, aktualizacja zaległa: racja 360 instead of 300 (it stores the backlog in itself); its Spór comments are `combat/spor.ts` (STORY_ANSWERS). */
registerBossVariant(P2, { boss: 'prototyp', hp: 360, lineKey: 'story.p2.boss.variant' });
