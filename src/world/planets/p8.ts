/**
 * Planeta Trzydziesta (Wygenerowana), STORY 8.14: the clerk of its base, its three hand-written side tickets, the variant of its boss and
 * its gate. Its location types are data in `locations.ts` (rownina and jaskinia reused from planet 7, wyzyna new with drawings in
 * `render/locations/wyzyna.ts`); its record (law pool, headline clause Grawitacja, base layouts, the order rownina, jaskinia, wyzyna with
 * the cuts at pages 3 and 5, the gate on page 4) is `PLANETS[7]` in world/campaign.ts; its texts are `story.p8.*`. It hosts the set
 * "Domniemanie" (`hostedSet`). Imported once through `planets/index.ts`.
 *
 * The gate (page 4, 0-based page 3, the last jaskinia page): the exit corner is closed by the hatched band and a Rachmistrz stands at
 * it. The page always spawns one named elite titled `story.p8.gate.elite` ("Uzytkownik Potwierdzajacy", enemies/spawn.ts
 * `spawnGateElite`); the gate holds until it is slain.
 */
import { BOSSES, registerBossVariant } from '../../enemies/bosses';
import { registerNpc } from '../npc';
import { registerSideTickets, type QuestDef } from '../quests';

export const P8 = 7;

/** The clerk: Rzeczoznawca ds. Domniemań (`story.p8.clerk.*`); look seed 8. */
registerNpc(P8, {
  id: 'p8-rzeczoznawca',
  nameKey: 'story.p8.clerk.name',
  roleKey: 'story.p8.clerk.role',
  lineKeys: ['story.p8.clerk.line0', 'story.p8.clerk.line1', 'story.p8.clerk.line2'],
  look: 8,
});

const ticket = (k: 'a' | 'b' | 'c', def: Omit<QuestDef, 'id' | 'planet' | 'titleKey' | 'textKey'>): QuestDef => ({
  id: `h:p8:${k}`,
  planet: P8,
  titleKey: `story.p8.ticket.${k}.title`,
  textKey: `story.p8.ticket.${k}.text`,
  ...def,
});

/**
 * Zaświadczenie o istnieniu (deliver 1, the planet's one item ticket), Dowód przeciwny (kill 16 Wygenerowane), Punkt najwyższy (reach
 * page 5, the first highland page). Ticket a pays one piece of the set "Domniemanie" through `QuestReward.item`: no piece is named, so
 * the piece is rolled from the character's seed when the reward is sent and arrives as an awizo at the base paczkomat.
 */
export const P8_TICKETS: readonly QuestDef[] = [
  ticket('a', { kind: 'deliver', n: 1, reward: { stars: 45, item: { set: 'domniemanie' } } }),
  ticket('b', { kind: 'kill', n: 16, family: 'wygenerowane', reward: { stars: 45, permission: 'wygenerowane' } }),
  ticket('c', { kind: 'reach', n: 5, reward: { stars: 40, potwierdzenia: 1 } }),
];
registerSideTickets(P8_TICKETS);

/**
 * Hipoteza, wygenerowana ponownie, anatomia poprawiona: the family's racja; the one change is a part, a long arm ending in a hand with
 * seven fingers (`arm: 'dlon'`, render/enemyFigures.ts) and the reach 42 to 60 (planet 3's rule: the reach is the part). No `hintKey`
 * or `solvedKey`: no family footnote names the hand. Its Spor comments are `combat/spor.ts` (STORY_ANSWERS).
 */
registerBossVariant(P8, { boss: 'hipoteza', hp: BOSSES.hipoteza.hp, attackRange: 60, arm: 'dlon', lineKey: 'story.p8.boss.variant' });
