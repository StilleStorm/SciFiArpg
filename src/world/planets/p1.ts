/**
 * Planeta Dwudziesta Trzecia (Przydzielona), STORY 8.1: the clerk of its base, its three hand-written side tickets and the variant of
 * its boss. Its location types are data in `locations.ts` (przedmiescie, magazyn) with drawings in `render/locations/`; its record
 * (law pool, mix, base layouts, location list) is `PLANETS[0]` in world/campaign.ts; its texts are `story.p1.*`. Imported once through
 * `planets/index.ts`. Planet 1 has no gate (STORY 8.1): the first planet flows from the base to the boss.
 */
import { registerBossVariant } from '../../enemies/bosses';
import { registerNpc } from '../npc';
import { registerSideTickets, type QuestDef } from '../quests';

export const P1 = 0;

/** The clerk: a name, a role and three sheet lines (`story.p1.clerk.*`); look seed 1. */
registerNpc(P1, {
  id: 'p1-referent',
  nameKey: 'story.p1.clerk.name',
  roleKey: 'story.p1.clerk.role',
  lineKeys: ['story.p1.clerk.line0', 'story.p1.clerk.line1', 'story.p1.clerk.line2'],
  look: 1,
});

const ticket = (k: 'a' | 'b' | 'c', def: Omit<QuestDef, 'id' | 'planet' | 'titleKey' | 'textKey'>): QuestDef => ({
  id: `h:p1:${k}`,
  planet: P1,
  titleKey: `story.p1.ticket.${k}.title`,
  textKey: `story.p1.ticket.${k}.text`,
  ...def,
});

/** Spis z natury (kill 12 Urzadzenia), Rzeczy pozostawione (fetch 3), Potwierdzenie obecnosci (reach page 3). */
export const P1_TICKETS: readonly QuestDef[] = [
  ticket('a', { kind: 'kill', n: 12, family: 'urzadzenia', reward: { stars: 30, permission: 'urzadzenia' } }),
  ticket('b', { kind: 'fetch', n: 3, reward: { stars: 20, potwierdzenia: 1 } }),
  ticket('c', { kind: 'reach', n: 3, reward: { stars: 20 } }),
];
registerSideTickets(P1_TICKETS);

/** Prototyp, seria 1, egzemplarz pokazowy: the demo unit has 260 racja instead of 300; its Spor comments are `combat/spor.ts` (STORY_ANSWERS). */
registerBossVariant(P1, { boss: 'prototyp', hp: 260, lineKey: 'story.p1.boss.variant' });
