/**
 * The campaign as data (PLAN 3.1, 3.2, 7; STORY 4): nine planets in three acts, the priority of a ticket (difficulty),
 * the per-character campaign state and the rules that move it. Everything here is pure: no run state is read except
 * through the small `RunState`-shaped arguments named in each signature, and nothing is rendered.
 *
 * Planet indices are 0-based (0..8) everywhere in code; the player-facing number is index + 1.
 * Names are placeholders until S11 (see src/i18n/pl/planets.json).
 */
import type { Bus } from '../core/events';
import { createRng } from '../core/rng';
import { BOSS_OF, type BossId, type FamilyId } from '../enemies/ids';
import type { BaseLayout } from './base';
import type { LawId } from './laws';
import type { MissionMix } from '../enemies/families';

// ---------- priority ----------

export type PriorityId = 'niski' | 'normalny' | 'wysoki' | 'krytyczny';
export const PRIORITY_IDS: readonly PriorityId[] = ['niski', 'normalny', 'wysoki', 'krytyczny'];
export const DEFAULT_PRIORITY: PriorityId = 'normalny';

/** What a priority does. Multipliers are factors; `lootTier` is added to the rolled item tier, `ilvl` to the item level (ITEMS 5.1). */
export interface PriorityDef {
  id: PriorityId;
  /** i18n keys: the word and the Asystent's comment on the choice. */
  nameKey: string;
  hintKey: string;
  /** Character level from which the priority may be chosen. */
  unlockLevel: number;
  hp: number;
  dmg: number;
  /** Added to the tier of Urzadzenia and Wygenerowane enemies (their stats rise with it). */
  tierShift: number;
  /** Factor on the share of elites among spawns. */
  eliteMul: number;
  xp: number;
  stars: number;
  lootTier: number;
  ilvl: number;
}

const P = (id: PriorityId, unlockLevel: number, hp: number, dmg: number, tierShift: number, eliteMul: number, xp: number, stars: number, lootTier: number, ilvl: number): PriorityDef => ({
  id,
  nameKey: `planets.priority.${id}.name`,
  hintKey: `planets.priority.${id}.hint`,
  unlockLevel,
  hp,
  dmg,
  tierShift,
  eliteMul,
  xp,
  stars,
  lootTier,
  ilvl,
});

export const PRIORITIES: Record<PriorityId, PriorityDef> = {
  niski: P('niski', 1, 0.8, 0.75, 0, 0.6, 0.8, 0.8, 0, -2),
  normalny: P('normalny', 1, 1, 1, 0, 1, 1, 1, 0, 0),
  wysoki: P('wysoki', 8, 1.35, 1.25, 0, 1.5, 1.4, 1.4, 1, 3),
  krytyczny: P('krytyczny', 18, 1.8, 1.55, 1, 2.2, 2, 2, 1, 6),
};

export const priorityDef = (id: PriorityId): PriorityDef => PRIORITIES[id];
export const isPriorityId = (v: unknown): v is PriorityId => typeof v === 'string' && (PRIORITY_IDS as readonly string[]).includes(v);

export function priorityUnlocked(id: PriorityId, level: number): boolean {
  return level >= PRIORITIES[id].unlockLevel;
}

/** The priorities a character of `level` may pick, mildest first. */
export function availablePriorities(level: number): PriorityId[] {
  return PRIORITY_IDS.filter((id) => priorityUnlocked(id, level));
}

/** The priority a request falls back to when the one asked for is still locked (the highest unlocked not above it). */
export function clampPriority(id: PriorityId, level: number): PriorityId {
  if (priorityUnlocked(id, level)) return id;
  const list = availablePriorities(level);
  return list[list.length - 1] ?? DEFAULT_PRIORITY;
}

// ---------- planets ----------

export const PLANET_COUNT = 9;
export type Act = 1 | 2 | 3;
export type LocationType = 'miasto' | 'przedmiescie' | 'magazyn' | 'serwerownia' | 'jaskinia' | 'rownina' | 'wyzyna' | 'biuro' | 'centrum' | 'archiwum';
/** Sets hosted by a planet (ITEMS 4.1); null while a planet hosts none. Placeholder assignment until the set slice. */
export type SetId = 'obieg' | 'ostatnia-mila' | 'serwis' | 'infolinia' | 'domniemanie' | 'awaria';

export interface PlanetDef {
  /** 0-based index; the player-facing number is index + 1. */
  index: number;
  id: string;
  act: Act;
  /** i18n keys: the printed name with epithet ("Planeta Czterdziesta Siódma (Zaktualizowana)") and its locative ("Planecie ..."). */
  nameKey: string;
  locKey: string;
  /** The family that carries the mission and its mix weights (the three sum to 1). */
  dominant: FamilyId;
  mix: Record<FamilyId, number>;
  /** The clauses this planet may print on a ticket. */
  lawPool: readonly LawId[];
  /** Base layouts the planet may use (stub: the base generator still picks by seed). */
  baseLayouts: readonly BaseLayout[];
  /** Two or three location types (stub list; STORY 4 leaves the real ones to S11). */
  locations: readonly LocationType[];
  /** The boss of the last page. Only the three family bosses exist; new ones come with the story slices. */
  boss: BossId;
  hostedSet: SetId | null;
  /** Page count range of a run here. */
  pages: readonly [number, number];
  /** The character level the planet is balanced for at Normalny. */
  levelHint: number;
}

const mix = (urzadzenia: number, powiadomienia: number, wygenerowane: number): Record<FamilyId, number> => ({ urzadzenia, powiadomienia, wygenerowane });

const planet = (
  index: number,
  act: Act,
  dominant: FamilyId,
  weights: Record<FamilyId, number>,
  lawPool: readonly LawId[],
  baseLayouts: readonly BaseLayout[],
  locations: readonly LocationType[],
  hostedSet: SetId | null,
  pages: readonly [number, number],
): PlanetDef => ({
  index,
  id: `p${index + 1}`,
  act,
  nameKey: `planets.p${index + 1}.name`,
  locKey: `planets.p${index + 1}.loc`,
  dominant,
  mix: weights,
  lawPool,
  baseLayouts,
  locations,
  boss: BOSS_OF[dominant],
  hostedSet,
  pages,
  levelHint: 1 + index * 4,
});

/** Akt I: updates and cookies. Akt II: hours and two-factor. Akt III: existence and the rest (STORY 4). */
export const PLANETS: readonly PlanetDef[] = [
  planet(0, 1, 'urzadzenia', mix(0.6, 0.25, 0.15), ['wymagana-aktualizacja', 'ciasteczka', 'parzystosc'], ['ladowisko', 'wioska'], ['przedmiescie', 'magazyn'], null, [4, 5]),
  planet(1, 1, 'urzadzenia', mix(0.55, 0.3, 0.15), ['wymagana-aktualizacja', 'ciasteczka', 'grawitacja'], ['wioska', 'miasteczko'], ['magazyn', 'serwerownia'], 'obieg', [4, 5]),
  planet(2, 1, 'urzadzenia', mix(0.5, 0.2, 0.3), ['ciasteczka', 'parzystosc', 'grawitacja', 'wymagana-aktualizacja'], ['miasteczko', 'wioska'], ['serwerownia', 'przedmiescie', 'biuro'], 'serwis', [5, 5]),
  planet(3, 2, 'powiadomienia', mix(0.3, 0.55, 0.15), ['godziny-konsultanta', 'weryfikacja-dwuetapowa', 'nie-przeszkadzac'], ['miasteczko', 'ladowisko'], ['miasto', 'biuro'], 'ostatnia-mila', [5, 6]),
  planet(4, 2, 'powiadomienia', mix(0.2, 0.6, 0.2), ['godziny-konsultanta', 'oplata-serwisowa', 'nie-przeszkadzac'], ['miasteczko'], ['centrum', 'miasto'], null, [5, 6]),
  planet(5, 2, 'powiadomienia', mix(0.15, 0.55, 0.3), ['weryfikacja-dwuetapowa', 'oplata-serwisowa', 'godziny-konsultanta'], ['miasteczko', 'wioska'], ['centrum', 'serwerownia', 'archiwum'], 'infolinia', [5, 6]),
  planet(6, 3, 'wygenerowane', mix(0.15, 0.25, 0.6), ['czas-wsteczny', 'parzystosc', 'nie-przeszkadzac'], ['ladowisko', 'wioska'], ['jaskinia', 'rownina'], null, [5, 6]),
  planet(7, 3, 'wygenerowane', mix(0.2, 0.2, 0.6), ['czas-wsteczny', 'grawitacja', 'oplata-serwisowa'], ['wioska', 'miasteczko'], ['wyzyna', 'rownina', 'jaskinia'], 'domniemanie', [5, 6]),
  planet(8, 3, 'wygenerowane', mix(0.15, 0.15, 0.7), ['czas-wsteczny', 'weryfikacja-dwuetapowa', 'parzystosc', 'ciasteczka'], ['miasteczko', 'ladowisko'], ['archiwum', 'biuro'], 'awaria', [6, 6]),
];

export function planetDef(index: number): PlanetDef {
  const p = PLANETS[Math.min(PLANETS.length - 1, Math.max(0, Math.floor(index)))];
  if (!p) throw new Error('no planets');
  return p;
}

export const isPlanetIndex = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < PLANET_COUNT;

/** Every clause any planet may print (the pool "zgloszenia dodatkowe" draw from). */
export const ALL_LAWS: readonly LawId[] = [...new Set(PLANETS.flatMap((p) => p.lawPool))];

/** The mission mix of a planet in the shape the spawn code reads (`RunState.mix`). */
export function mixForPlanet(index: number): MissionMix {
  const p = planetDef(index);
  return { dominant: p.dominant, weights: { ...p.mix } };
}

/** Item level base of a planet (ITEMS 5.1): 5 per planet, +1. The priority bonus and the page offset are added by the item code. */
export const ilvlBase = (index: number): number => 5 * Math.max(0, Math.floor(index)) + 1;

// ---------- scaling ----------

/** What a planet and a priority do to the enemies of one run. Neutral values change nothing. */
export interface EnemyScale {
  hp: number;
  dmg: number;
  /** Added to the page tier of Urzadzenia and Wygenerowane. */
  tierOffset: number;
  eliteMul: number;
}

export const NEUTRAL_SCALE: EnemyScale = { hp: 1, dmg: 1, tierOffset: 0, eliteMul: 1 };

/** Racja and damage grow with the planet, the tier with the act; the priority multiplies on top. */
export function enemyScaleFor(planetIdx: number, priority: PriorityId): EnemyScale {
  const p = planetDef(planetIdx);
  const pr = PRIORITIES[priority];
  return {
    hp: (1 + 0.12 * p.index) * pr.hp,
    dmg: (1 + 0.08 * p.index) * pr.dmg,
    tierOffset: p.act - 1 + pr.tierShift,
    eliteMul: pr.eliteMul,
  };
}

// ---------- tickets ----------

/**
 * campaign: the next planet of the sequence. final: the return ticket to planet 1 after planet 9 (the finale).
 * extra: a zgloszenie dodatkowe (random planet, random clause) after the case. travel: free travel to a closed planet.
 */
export type TicketKind = 'campaign' | 'final' | 'extra' | 'travel';

export interface TicketPlan {
  kind: TicketKind;
  /** 0-based planet index. */
  planet: number;
  priority: PriorityId;
  lawId: LawId;
}

/** The clause of a planet for a seed (a pure pick from the planet's pool). */
export function lawForPlanet(planetIdx: number, seed: number): LawId {
  const pool = planetDef(planetIdx).lawPool;
  return createRng(seed).fork('plan-law').pick(pool);
}

/** The enemy scale of a plan; neutral for a run without one (the older random tickets). */
export function planScale(plan: TicketPlan | undefined): EnemyScale {
  return plan ? enemyScaleFor(plan.planet, plan.priority) : NEUTRAL_SCALE;
}

export const xpMul = (plan: TicketPlan | undefined): number => (plan ? PRIORITIES[plan.priority].xp : 1);
export const starMul = (plan: TicketPlan | undefined): number => (plan ? PRIORITIES[plan.priority].stars : 1);
export const lootTierBonus = (plan: TicketPlan | undefined): number => (plan ? PRIORITIES[plan.priority].lootTier : 0);
export const ilvlBonus = (plan: TicketPlan | undefined): number => (plan ? PRIORITIES[plan.priority].ilvl : 0);

// ---------- per-character state ----------

export interface CampaignState {
  /** The planet of the next campaign ticket (0..8). */
  current: number;
  /** Planets whose ticket was closed, in order. */
  closed: number[];
  /** Planet 9 is closed and the return ticket to planet 1 is the next one (the finale flag). */
  finalTicket: boolean;
  /** The final ticket was closed: the Komisja opened case 48214; extras and free travel are open. */
  caseClosed: boolean;
  /** Zgloszenia dodatkowe closed. */
  extras: number;
  /** Title cards already shown to this character (ui/cards.ts); absent = none, so older saves load. */
  cards?: CardsSeen;
}

/** The opening page once; a chapter card once per planet; a rewritten card once per planet, kept as -1 - planet. */
export interface CardsSeen {
  opening: boolean;
  chapters: number[];
}

export const noCardsSeen = (): CardsSeen => ({ opening: false, chapters: [] });

/** Validate a stored seen record; anything unusable is "nothing seen". */
export function toCardsSeen(raw: unknown): CardsSeen {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return noCardsSeen();
  const r = raw as Record<string, unknown>;
  const chapters = Array.isArray(r['chapters']) ? r['chapters'].filter((n): n is number => Number.isInteger(n) && (n as number) >= -PLANET_COUNT && (n as number) < PLANET_COUNT) : [];
  return { opening: r['opening'] === true, chapters: [...new Set(chapters)] };
}

export function newCampaign(): CampaignState {
  return { current: 0, closed: [], finalTicket: false, caseClosed: false, extras: 0 };
}

const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : fallback;

/** Validate whatever was stored; a damaged record becomes the nearest sane one. Nothing here throws. */
export function toCampaign(raw: unknown): CampaignState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return newCampaign();
  const r = raw as Record<string, unknown>;
  const closed: number[] = [];
  if (Array.isArray(r['closed'])) for (const v of r['closed']) if (isPlanetIndex(v) && !closed.includes(v)) closed.push(v);
  const caseClosed = r['caseClosed'] === true;
  const finalTicket = !caseClosed && r['finalTicket'] === true;
  const current = clampInt(r['current'], 0, PLANET_COUNT - 1, closed.length === 0 ? 0 : Math.min(PLANET_COUNT - 1, closed.length));
  return {
    current: finalTicket || caseClosed ? 0 : current,
    closed,
    finalTicket,
    caseClosed,
    extras: clampInt(r['extras'], 0, 1e6, 0),
    ...(r['cards'] !== undefined ? { cards: toCardsSeen(r['cards']) } : {}),
  };
}

export const cloneCampaign = (c: CampaignState): CampaignState => ({
  ...c,
  closed: [...c.closed],
  ...(c.cards ? { cards: { opening: c.cards.opening, chapters: [...c.cards.chapters] } } : {}),
});

/** The plan a base of this campaign offers by default: the next campaign ticket, or after the case an extra one. */
export function defaultPlan(c: CampaignState, priority: PriorityId, seed: number): TicketPlan {
  return nextCampaignPlan(c, priority, seed) ?? extraPlan(c, priority, seed) ?? { kind: 'campaign', planet: 0, priority, lawId: lawForPlanet(0, seed) };
}

const TICKET_KINDS: readonly TicketKind[] = ['campaign', 'final', 'extra', 'travel'];

/** Validate a stored plan (the bookmark carries one); null when unusable. */
export function toPlan(raw: unknown, isLaw: (v: unknown) => v is LawId): TicketPlan | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const kind = r['kind'];
  if (typeof kind !== 'string' || !(TICKET_KINDS as readonly string[]).includes(kind)) return null;
  if (!isPlanetIndex(r['planet']) || !isPriorityId(r['priority']) || !isLaw(r['lawId'])) return null;
  return { kind: kind as TicketKind, planet: r['planet'], priority: r['priority'], lawId: r['lawId'] };
}

/** The next ticket of the main sequence, or null when the case is closed (then extras and travel are the way on). */
export function nextCampaignPlan(c: CampaignState, priority: PriorityId, seed: number): TicketPlan | null {
  if (c.caseClosed) return null;
  if (c.finalTicket) return { kind: 'final', planet: 0, priority, lawId: lawForPlanet(0, seed) };
  return { kind: 'campaign', planet: c.current, priority, lawId: lawForPlanet(c.current, seed) };
}

/** A zgloszenie dodatkowe: random planet, random clause, both pure functions of the seed. Null before the case is closed. */
export function extraPlan(c: CampaignState, priority: PriorityId, seed: number): TicketPlan | null {
  if (!c.caseClosed) return null;
  const r = createRng(seed).fork('extra');
  return { kind: 'extra', planet: r.int(0, PLANET_COUNT - 1), priority, lawId: r.pick(ALL_LAWS) };
}

/** Planets reachable from the desk for free: after the case, every closed planet (all nine), at the character's current level. */
export function travelList(c: CampaignState): number[] {
  return c.caseClosed ? [...c.closed].sort((a, b) => a - b) : [];
}

/** Free travel to a closed planet; its clause is drawn from the planet's pool. Null when the planet is not on the list. */
export function travelPlan(c: CampaignState, planetIdx: number, priority: PriorityId, seed: number): TicketPlan | null {
  if (!travelList(c).includes(planetIdx)) return null;
  return { kind: 'travel', planet: planetIdx, priority, lawId: lawForPlanet(planetIdx, seed) };
}

export interface CampaignOutcome {
  campaign: CampaignState;
  /** A campaign planet was closed and the sequence moved on (or the return ticket was issued). */
  advanced: { from: number; to: number; finale: boolean } | null;
  /** The final ticket was closed. */
  caseClosed: boolean;
}

/**
 * The ticket `plan` was closed. A campaign ticket for the current planet closes it and moves on; planet 9 issues the
 * return ticket to planet 1; the final ticket closes the case. Extras and travel change nothing but the extras count.
 * Never mutates its argument.
 */
export function closeTicket(c: CampaignState, plan: TicketPlan): CampaignOutcome {
  const next = cloneCampaign(c);
  if (plan.kind === 'campaign' && !c.caseClosed && !c.finalTicket && plan.planet === c.current) {
    if (!next.closed.includes(plan.planet)) next.closed.push(plan.planet);
    if (plan.planet >= PLANET_COUNT - 1) {
      next.finalTicket = true;
      next.current = 0;
      return { campaign: next, advanced: { from: plan.planet, to: 0, finale: true }, caseClosed: false };
    }
    next.current = plan.planet + 1;
    return { campaign: next, advanced: { from: plan.planet, to: next.current, finale: false }, caseClosed: false };
  }
  if (plan.kind === 'final' && c.finalTicket && !c.caseClosed) {
    next.finalTicket = false;
    next.caseClosed = true;
    return { campaign: next, advanced: null, caseClosed: true };
  }
  if ((plan.kind === 'extra' || plan.kind === 'travel') && c.caseClosed) {
    next.extras += plan.kind === 'extra' ? 1 : 0;
    return { campaign: next, advanced: null, caseClosed: false };
  }
  return { campaign: next, advanced: null, caseClosed: false };
}

// ---------- wiring (events) ----------

/** The part of a run state the campaign touches. */
export interface CampaignHost {
  plan?: TicketPlan;
  campaign?: CampaignState;
}

const settled = new WeakSet<object>();

/**
 * Settle a finished run: when its plan was completed ('ukonczono'), close it in the host's campaign and emit
 * `campaign:advanced` / `case:closed`. Idempotent per plan. Returns the outcome, or null when nothing applied.
 */
export function settleCampaign(host: CampaignHost, bus: Bus, outcome: string): CampaignOutcome | null {
  const plan = host.plan;
  if (outcome !== 'ukonczono' || !plan || settled.has(plan)) return null;
  settled.add(plan);
  const res = closeTicket(host.campaign ?? newCampaign(), plan);
  host.campaign = res.campaign;
  if (res.advanced) bus.emit('campaign:advanced', res.advanced);
  if (res.caseClosed) bus.emit('case:closed');
  return res;
}

/** Listen to `run:ended` and settle the run `getHost()` returns. Call once; registered before the save handler so the character is saved with the campaign. */
export function bindCampaign(bus: Bus, getHost: () => CampaignHost | null): () => void {
  return bus.on('run:ended', ({ outcome }) => {
    const host = getHost();
    if (host) settleCampaign(host, bus, outcome);
  });
}
