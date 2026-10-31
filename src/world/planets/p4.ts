/**
 * Planeta Dwudziesta Szósta (Przekierowana), STORY 8.8: the clerk of its base, its three hand-written side tickets and the variant
 * of its boss. Its location types are data in `locations.ts` (miasto new, drawings in `render/locations/miasto.ts`; biuro reused);
 * its record (law pool, headline Godziny konsultanta, base layouts, the one-cut split: pages 1-3 miasto, the rest biuro, no gate) is
 * `PLANETS[3]` in world/campaign.ts; its texts are `story.p4.*`. Imported once through `planets/index.ts`.
 */
import { registerBossVariant } from '../../enemies/bosses';
import { registerNpc } from '../npc';
import { registerSideTickets, type QuestDef } from '../quests';

export const P4 = 3;

/** The clerk: Referent ds. Eskalacji (`story.p4.clerk.*`); look seed 4. */
registerNpc(P4, {
  id: 'p4-referent',
  nameKey: 'story.p4.clerk.name',
  roleKey: 'story.p4.clerk.role',
  lineKeys: ['story.p4.clerk.line0', 'story.p4.clerk.line1', 'story.p4.clerk.line2'],
  look: 4,
});

const ticket = (k: 'a' | 'b' | 'c', def: Omit<QuestDef, 'id' | 'planet' | 'titleKey' | 'textKey'>): QuestDef => ({
  id: `h:p4:${k}`,
  planet: P4,
  titleKey: `story.p4.ticket.${k}.title`,
  textKey: `story.p4.ticket.${k}.text`,
  ...def,
});

/** Odbiór powiadomień (kill 14 Powiadomienia), Instancja druga (reach page 5), Załączniki (fetch 4). */
export const P4_TICKETS: readonly QuestDef[] = [
  ticket('a', { kind: 'kill', n: 14, family: 'powiadomienia', reward: { stars: 40, permission: 'powiadomienia' } }),
  ticket('b', { kind: 'reach', n: 5, reward: { stars: 35, potwierdzenia: 1 } }),
  ticket('c', { kind: 'fetch', n: 4, reward: { stars: 30 } }),
];
registerSideTickets(P4_TICKETS);

/** Weryfikacja, instancja druga, formularz rozszerzony: racja 220 to 260, the hydrant grid and the summons as the family has them. */
registerBossVariant(P4, { boss: 'weryfikacja', hp: 260, lineKey: 'story.p4.boss.variant' });
