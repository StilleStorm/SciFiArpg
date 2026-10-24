/**
 * Planeta Dwudziesta Piąta (Zaktualizowana), STORY 8.3: the clerk of its base, its three hand-written side tickets, the variant of its
 * boss and its gate. Its location types are data in `locations.ts` (przedmiescie, serwerownia reused; biuro new) with drawings in
 * `render/locations/`; its record (law pool, headline clause Parzystość, base layouts, location list and the two-cut split, the gate on
 * page 4) is `PLANETS[2]` in world/campaign.ts; its texts are `story.p3.*`. Imported once through `planets/index.ts`.
 *
 * The gate (page 4, 0-based page 3): the exit corner stands behind a turnstile with a Portier. The page always spawns one named
 * elite titled `story.p3.gate.elite` ("Ochrona Obiektu", enemies/spawn.ts `spawnGateElite`); the gate holds until it is slain
 * (`PageGate.slain`, set by `bindGates` on `elite:slain`).
 */
import { BOSSES, registerBossVariant } from '../../enemies/bosses';
import { registerNpc } from '../npc';
import { registerSideTickets, type QuestDef } from '../quests';

export const P3 = 2;

/** The clerk: Pełnomocnik ds. Aktualizacji (`story.p3.clerk.*`); look seed 3. */
registerNpc(P3, {
  id: 'p3-pelnomocnik',
  nameKey: 'story.p3.clerk.name',
  roleKey: 'story.p3.clerk.role',
  lineKeys: ['story.p3.clerk.line0', 'story.p3.clerk.line1', 'story.p3.clerk.line2'],
  look: 3,
});

const ticket = (k: 'a' | 'b' | 'c', def: Omit<QuestDef, 'id' | 'planet' | 'titleKey' | 'textKey'>): QuestDef => ({
  id: `h:p3:${k}`,
  planet: P3,
  titleKey: `story.p3.ticket.${k}.title`,
  textKey: `story.p3.ticket.${k}.text`,
  ...def,
});

/**
 * Przegląd okresowy (kill 10 Urządzenia), Stawiennictwo (reach page 4), Dwa egzemplarze (fetch 2).
 * Ticket c must stay n = 2: its title and the line "Zgłoszenie składa się w {count} egzemplarzach" say two copies.
 */
export const P3_TICKETS: readonly QuestDef[] = [
  ticket('a', { kind: 'kill', n: 10, family: 'urzadzenia', reward: { stars: 35, permission: 'urzadzenia' } }),
  ticket('b', { kind: 'reach', n: 4, reward: { stars: 30, potwierdzenia: 1 } }),
  ticket('c', { kind: 'fetch', n: 2, reward: { stars: 25 } }),
];
registerSideTickets(P3_TICKETS);

/**
 * Prototyp, seria 3, wersja biurowa: racja as the family has it, one data change: attackRange 44 to 60 (an arm with a stapler; the
 * drawing adds that one part, the body stays). Its Spór comments are `combat/spor.ts` (STORY_ANSWERS).
 */
registerBossVariant(P3, { boss: 'prototyp', hp: BOSSES.prototyp.hp, attackRange: 60, arm: 'stapler', lineKey: 'story.p3.boss.variant' });
