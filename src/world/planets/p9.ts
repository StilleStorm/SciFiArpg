/**
 * Planeta Trzydziesta Pierwsza (Niedostepna), STORY 8.15: the clerk of its base, its three hand-written side tickets and its gate. Its
 * location types are data in `locations.ts` (archiwum and biuro, both reused, with the observatory's props added to the shared specs and
 * drawings); its record (law pool, headline clause Czas wsteczny, base layouts, the split at page 3: pages 1-3 archiwum, the rest and the
 * boss page biuro, the teczka gate on page 3, the boss `wizualizacja`) is `PLANETS[8]` in world/campaign.ts; its texts are `story.p9.*`.
 * It hosts the set "Awaria" (`hostedSet`). Imported once through `planets/index.ts`.
 *
 * The boss is the Wizualizacja, a body of its own (enemies/bosses.ts): there is no variant to register and no `story.p9.boss.variant`
 * line. Its Spor comments are `combat/spor.ts` (STORY_ANSWERS[8]).
 *
 * The gate (page 3, 0-based page 2, the last archiwum page): the default hatched band across the exit corner with a Dyzurny at it. It
 * lifts when the one forced teczka of the page, the "akta wnioskodawcy" (`Teczka.key`, placed by `world/gate.ts placeKeyTeczka`), is opened.
 */
import { registerNpc } from '../npc';
import { registerSideTickets, type QuestDef } from '../quests';

export const P9 = 8;

/** The clerk: Koordynator ds. Awarii (`story.p9.clerk.*`); look seed 9. */
registerNpc(P9, {
  id: 'p9-koordynator',
  nameKey: 'story.p9.clerk.name',
  roleKey: 'story.p9.clerk.role',
  lineKeys: ['story.p9.clerk.line0', 'story.p9.clerk.line1', 'story.p9.clerk.line2'],
  look: 9,
});

const ticket = (k: 'a' | 'b' | 'c', def: Omit<QuestDef, 'id' | 'planet' | 'titleKey' | 'textKey'>): QuestDef => ({
  id: `h:p9:${k}`,
  planet: P9,
  titleKey: `story.p9.ticket.${k}.title`,
  textKey: `story.p9.ticket.${k}.text`,
  ...def,
});

/** Skutki awarii (kill 18 Wygenerowane), Zgloszenie awarii (reach page 4, the first biuro page), Klisze (fetch 6). No item ticket. */
export const P9_TICKETS: readonly QuestDef[] = [
  ticket('a', { kind: 'kill', n: 18, family: 'wygenerowane', reward: { stars: 50, permission: 'wygenerowane' } }),
  ticket('b', { kind: 'reach', n: 4, reward: { stars: 40, potwierdzenia: 1 } }),
  ticket('c', { kind: 'fetch', n: 6, reward: { stars: 40 } }),
];
registerSideTickets(P9_TICKETS);
