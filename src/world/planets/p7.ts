/**
 * Planeta Dwudziesta Dziewiata (Ewentualna), STORY 8.13: the clerk of its base, its three hand-written side tickets and the variant of
 * its boss. Its location types are data in `locations.ts` (jaskinia and rownina, both new, drawings in `render/locations/jaskinia.ts`
 * and `rownina.ts`; planet 8 reuses them); its record (law pool, headline clause Nie przeszkadzac, base layouts, the split at page 3:
 * pages 1-3 jaskinia on the `rooms` layout, the rest and the boss page rownina on `rows`, no gate, no hosted set) is `PLANETS[6]` in
 * world/campaign.ts; its texts are `story.p7.*`. Imported once through `planets/index.ts`.
 */
import { registerBossVariant } from '../../enemies/bosses';
import { registerNpc } from '../npc';
import { registerSideTickets, type QuestDef } from '../quests';

export const P7 = 6;

/** The clerk: Inspektor ds. Weryfikacji (`story.p7.clerk.*`); look seed 7. */
registerNpc(P7, {
  id: 'p7-inspektor',
  nameKey: 'story.p7.clerk.name',
  roleKey: 'story.p7.clerk.role',
  lineKeys: ['story.p7.clerk.line0', 'story.p7.clerk.line1', 'story.p7.clerk.line2'],
  look: 7,
});

const ticket = (k: 'a' | 'b' | 'c', def: Omit<QuestDef, 'id' | 'planet' | 'titleKey' | 'textKey'>): QuestDef => ({
  id: `h:p7:${k}`,
  planet: P7,
  titleKey: `story.p7.ticket.${k}.title`,
  textKey: `story.p7.ticket.${k}.text`,
  ...def,
});

/** Weryfikacja negatywna (kill 16 Wygenerowane), Ogledziny wyjscia (reach page 4), Polubienia (fetch 5). */
export const P7_TICKETS: readonly QuestDef[] = [
  ticket('a', { kind: 'kill', n: 16, family: 'wygenerowane', reward: { stars: 45, permission: 'wygenerowane' } }),
  ticket('b', { kind: 'reach', n: 4, reward: { stars: 40, potwierdzenia: 1 } }),
  ticket('c', { kind: 'fetch', n: 5, reward: { stars: 35 } }),
];
registerSideTickets(P7_TICKETS);

/** Hipoteza, wersja robocza, uzupelniona: racja 260 to 300, the supplements; the outline, the 0.3 and the confirmation stay the family's. */
registerBossVariant(P7, { boss: 'hipoteza', hp: 300, lineKey: 'story.p7.boss.variant' });
