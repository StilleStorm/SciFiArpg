/**
 * Planeta Dwudziesta Siodma (Pilna), STORY 8.9: the clerk of its base, its three hand-written side tickets, the variant of its boss and
 * its gate. Its location types are data in `locations.ts` (miasto reused from planet 4, centrum new with drawings in
 * `render/locations/centrum.ts`); its record (law pool, headline clause Oplata serwisowa, base layouts, the order miasto then centrum
 * with the split at page 3, the gate on page 3) is `PLANETS[4]` in world/campaign.ts; its texts are `story.p5.*`. It hosts the set
 * "Ostatnia mila" (`hostedSet`). Imported once through `planets/index.ts`.
 *
 * The gate (page 3, 0-based page 2): the exit corner is walled with parcels and a Dyspozytor stands at the gap. The page always spawns one
 * named elite titled `story.p5.gate.elite` ("Doreczyciel", enemies/spawn.ts `spawnGateElite`); the gate holds until it is slain.
 */
import { BOSSES, registerBossVariant } from '../../enemies/bosses';
import { registerNpc } from '../npc';
import { registerSideTickets, type QuestDef } from '../quests';

export const P5 = 4;

/** The clerk: Specjalista ds. Doreczen (`story.p5.clerk.*`); look seed 5. */
registerNpc(P5, {
  id: 'p5-specjalista',
  nameKey: 'story.p5.clerk.name',
  roleKey: 'story.p5.clerk.role',
  lineKeys: ['story.p5.clerk.line0', 'story.p5.clerk.line1', 'story.p5.clerk.line2'],
  look: 5,
});

const ticket = (k: 'a' | 'b' | 'c', def: Omit<QuestDef, 'id' | 'planet' | 'titleKey' | 'textKey'>): QuestDef => ({
  id: `h:p5:${k}`,
  planet: P5,
  titleKey: `story.p5.ticket.${k}.title`,
  textKey: `story.p5.ticket.${k}.text`,
  ...def,
});

/**
 * Ostatnia mila (deliver 1, the planet's one item ticket), Ostatnia szansa (kill 16 Powiadomienia), Koszyk (fetch 3).
 * Ticket a pays one piece of the set "Ostatnia mila" through `QuestReward.item`: no piece is named, so the piece (kask, kamizelka or
 * powerbank) is rolled from the character's seed when the reward is sent, and the piece arrives as an awizo at the base paczkomat.
 */
export const P5_TICKETS: readonly QuestDef[] = [
  ticket('a', { kind: 'deliver', n: 1, reward: { stars: 40, item: { set: 'ostatnia-mila' } } }),
  ticket('b', { kind: 'kill', n: 16, family: 'powiadomienia', reward: { stars: 40, permission: 'powiadomienia' } }),
  ticket('c', { kind: 'fetch', n: 3, reward: { stars: 30, potwierdzenia: 1 } }),
];
registerSideTickets(P5_TICKETS);

/**
 * Weryfikacja, wersja sklepowa: the family's racja; the one change is a part, the hydrants of the grid squares drawn as shopping carts
 * (`grid: 'koszyk'`, render/enemyFigures.ts) and the captcha hint read from `story.p5.boss.hint`. Its Spor comments are
 * `combat/spor.ts` (STORY_ANSWERS).
 */
registerBossVariant(P5, { boss: 'weryfikacja', hp: BOSSES.weryfikacja.hp, lineKey: 'story.p5.boss.variant', grid: 'koszyk', hintKey: 'story.p5.boss.hint' });
