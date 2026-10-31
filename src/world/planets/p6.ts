/**
 * Planeta Dwudziesta Osma (Nagrywana), STORY 8.10: the clerk of its base, its three hand-written side tickets and its gate. Its location
 * types are data in `locations.ts` (centrum and serwerownia reused, archiwum new with drawings in `render/locations/archiwum.ts`); its
 * record (law pool, headline clause Weryfikacja dwuetapowa, base layouts, the split [2, 3], the gate on page 4, the boss `ankieta`) is
 * `PLANETS[5]` in world/campaign.ts; its texts are `story.p6.*`. It hosts the set "Infolinia" (`hostedSet`). Imported once through
 * `planets/index.ts`.
 *
 * The boss is the Ankieta, a body of its own (enemies/bosses.ts): there is no variant to register and no `story.p6.boss.variant` line. Its
 * Spor comments are `combat/spor.ts` (STORY_ANSWERS[5]).
 *
 * The gate (page 4, 0-based page 3, archiwum): the default hatched band across the exit corner with an Archiwista at it. It lifts when the
 * one forced teczka of the page, the "nagranie rozmowy" (`Teczka.key`, placed by `world/gate.ts placeKeyTeczka`), is opened.
 */
import { registerNpc } from '../npc';
import { registerSideTickets, type QuestDef } from '../quests';

export const P6 = 5;

/** The clerk: Pracownik Infolinii, stanowisko 28 (`story.p6.clerk.*`); look seed 6. */
registerNpc(P6, {
  id: 'p6-infolinia',
  nameKey: 'story.p6.clerk.name',
  roleKey: 'story.p6.clerk.role',
  lineKeys: ['story.p6.clerk.line0', 'story.p6.clerk.line1', 'story.p6.clerk.line2'],
  look: 6,
});

const ticket = (k: 'a' | 'b' | 'c', def: Omit<QuestDef, 'id' | 'planet' | 'titleKey' | 'textKey'>): QuestDef => ({
  id: `h:p6:${k}`,
  planet: P6,
  titleKey: `story.p6.ticket.${k}.title`,
  textKey: `story.p6.ticket.${k}.text`,
  ...def,
});

/** Rozmowcy niezweryfikowani (kill 6 Wygenerowane), Odsluch nagrania (reach page 4), Numery w kolejce (fetch 5). */
export const P6_TICKETS: readonly QuestDef[] = [
  ticket('a', { kind: 'kill', n: 6, family: 'wygenerowane', reward: { stars: 40, permission: 'wygenerowane' } }),
  ticket('b', { kind: 'reach', n: 4, reward: { stars: 35, potwierdzenia: 1 } }),
  ticket('c', { kind: 'fetch', n: 5, reward: { stars: 35 } }),
];
registerSideTickets(P6_TICKETS);
