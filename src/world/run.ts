import type { SporState } from '../combat/spor';
import { createRng, type Rng } from '../core/rng';
import type { Enemy, Pickup, Player, Projectile, Summon, Zone } from '../entities';
import { applyHero, createHeroRun, DEFAULT_HERO_ID, heroDef, type HeroId, type HeroRun } from '../heroes';
import { createPlayer } from '../entities/factory';
import { createBaseState, generateBase, layoutForSeed, type BaseState } from './base';
import { generateRunPages, type Page } from './pages';
import { applyLaw, neutralLaw, type LawFlags, type LawId } from './laws';
import type { Tunnel } from './tunnel';
import { ticketForPlan, ticketForSeed, type TicketInfo } from './ticket';
import { applyPlanetGates } from './gate';
import { finalePage } from './finale';
import { mixForPlanet, planetDef, type CampaignState, type TicketPlan } from './campaign';
import type { QuestState } from './quests';
import type { ActiveBuff } from './contentKinds';

import type { MissionMix } from '../enemies/families';
import { applyBookmark, type Bookmark } from '../save/bookmark';
import { applyCharacter, type Character } from '../save/character';

export interface RunState {
  seed: number;
  rng: Rng;
  /** Independent streams so one system's rolls never shift another's. */
  rngs: { ai: Rng; combat: Rng; loot: Rng; spawn: Rng };
  /** Seconds of simulated time. */
  time: number;
  status: 'running' | 'dead' | 'paused';
  page: Page;
  pageIndex: number;
  pageCount: number;
  lawId: LawId | null;
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  pickups: Pickup[];
  nextId: number;
  nextItemNumber: number;
  kills: number;
  /** Seconds until the next margin note may be shown. */
  edgeCooldown: number;
  /** Seconds until the next trickle spawn (enemies/spawn.ts). */
  spawnTimer: number;
  /** Which enemy families this mission sends (enemies/families.ts); absent = Urzadzenia dominant. */
  mix?: MissionMix;
  /** All pages of the run (world/pages.ts); `page` is pages[pageIndex]. */
  pages: Page[];
  /** The ticket header: planet, regulamin, dominant family (world/ticket.ts). */
  ticket: TicketInfo;
  /** The regulamin's modifiers; neutral values when none is active (world/laws.ts documents each). */
  law: LawFlags;
  /** A sheet that waits for an answer; the simulation is frozen while it is open. */
  modal: 'cookies' | 'update' | 'code' | null;
  /** The page-turn sweep is running; the simulation is frozen. */
  turning: boolean;
  /** The current page still needs its enemies (set on entry, cleared by populate). */
  populate: boolean;
  /** The player tapped the kiosk and is walking there. */
  kioskPending: boolean;
  /** Run time at which the boss's death closes the run (null until the boss falls; -1 once reported). */
  victoryAt: number | null;
  /** Per-run hero state: cooldowns, update ranks, ring buffer, death bookkeeping (heroes/state.ts). */
  hero: HeroRun;
  /** Friendly figures: Petlowiec copies, Kartograf decoys (systems/hero.ts moves them). */
  summons: Summon[];
  /** Marked areas and hourglasses drawn on the page. */
  zones: Zone[];
  /** The open service tunnel, if any (world/tunnel.ts). Never saved: it lives inside one session. */
  tunnel?: Tunnel;
  /**
   * 'base': the walkable base page of the planet (world/base.ts), no enemies, no clock, no laws, no deaths; `page` is the
   * base page and `pageIndex` the run page its exit leads to. 'run': the run proper. The exit of the base turns the page and flips this.
   */
  phase: 'base' | 'run';
  /** The state of the base page; present only while `phase` is 'base'. */
  base?: BaseState;
  /** The boss argument (DESIGN 5.4, combat/spor.ts): the comment that is up, the x2 window; absent until a boss posts. */
  spor?: SporState;
  /** A boss argument was answered right in this run: the planet boss's best drop is one tier higher, "Komisja przychyliła się" (systems/loot.ts, ITEMS 6.2). */
  sporWon?: boolean;
  /** The planet, priority and clause of this ticket (world/campaign.ts); absent for the older random tickets, which scale nothing. */
  plan?: TicketPlan;
  /** The character's campaign (copied from the saved record by applyCharacter, written back by serializeCharacter). */
  campaign?: CampaignState;
  /** The side tickets the character holds (world/quests.ts; copied from the saved record, written back by serializeCharacter). */
  quests?: QuestState;
  /** The seal stamps on the player now (world/content.ts ticks them; run only, never saved). Absent = none. */
  buffs?: ActiveBuff[];
}

/** Optional overrides for tests and screenshots; everything else comes from the seed. */
export interface RunOptions {
  /** Printed on the header; default is the first ticket number. */
  ticketNumber?: number;
  lawId?: LawId;
  pageCount?: number;
  /** Which hero to play; default DEFAULT_HERO_ID. */
  heroId?: HeroId;
  /** Resume a bookmarked ticket: same seed, clause and page count, the page at that index, the clock restored (save/bookmark.ts). */
  resume?: Bookmark;
  /** The saved character to play: gear, purse, level, updates (save/character.ts), applied before the stats are computed. */
  character?: Character;
  /** 'base' starts in the walkable base page of the planet (the exit is always open; a bookmark points it at the bookmarked page); default 'run'. */
  phase?: 'base' | 'run';
  /** Planet, priority and clause from the campaign; the ticket is made from it (ticketForPlan) and the enemies scale with it. */
  plan?: TicketPlan;
}

export function createRun(seed: number, opts: RunOptions = {}): RunState {
  const rng = createRng(seed);
  const ticketNumber = opts.ticketNumber ?? opts.resume?.ticketNumber;
  const plan = opts.plan ?? opts.resume?.plan;
  const ticket = plan ? ticketForPlan(seed, plan, ticketNumber) : ticketForSeed(seed, ticketNumber);
  const lawId = opts.lawId ?? opts.resume?.lawId;
  const pageCount = opts.pageCount ?? opts.resume?.pageCount;
  if (lawId) ticket.lawId = lawId;
  if (pageCount) ticket.pageCount = pageCount;
  const final = plan?.kind === 'final'; // the finale is one page: planet 1's base, struck (world/finale.ts)
  if (final) ticket.pageCount = 1;
  const pages = final ? [finalePage(seed)] : generateRunPages(rng, ticket.pageCount, plan ? planetDef(plan.planet).locations : undefined, plan ? planetDef(plan.planet).locationSplit : undefined);
  if (plan) applyPlanetGates(pages, planetDef(plan.planet).gates);
  const runPage = pages[0] ?? generateRunPages(rng, 1)[0];
  if (!runPage) throw new Error('no page');
  const phase = opts.phase ?? 'run';
  const page = phase === 'base' ? generateBase(seed, plan?.planet) : runPage;
  const state: RunState = {
    seed,
    rng,
    rngs: { ai: rng.fork('ai'), combat: rng.fork('combat'), loot: rng.fork('loot'), spawn: rng.fork('spawn') },
    time: 0,
    status: 'running',
    page,
    pageIndex: 0,
    pageCount: ticket.pageCount,
    lawId: null,
    player: createPlayer(1, page.spawn.x, page.spawn.y),
    enemies: [],
    projectiles: [],
    pickups: [],
    nextId: 2,
    nextItemNumber: 1,
    kills: 0,
    edgeCooldown: 0,
    spawnTimer: 10,
    pages,
    ticket,
    law: neutralLaw(),
    modal: null,
    turning: false,
    populate: phase !== 'base',
    kioskPending: false,
    victoryAt: null,
    hero: createHeroRun(opts.heroId ?? DEFAULT_HERO_ID),
    summons: [],
    zones: [],
    phase,
    ...(plan ? { plan: { ...plan, lawId: ticket.lawId }, mix: mixForPlanet(plan.planet) } : {}),
  };
  if (phase === 'base') {
    state.base = createBaseState(layoutForSeed(seed, plan?.planet), opts.resume ?? null);
    if (opts.resume) state.pageIndex = Math.min(pages.length - 1, Math.max(0, opts.resume.pageIndex)); // the exit leads to the open quest
  }
  applyHero(state.player, heroDef(opts.heroId ?? DEFAULT_HERO_ID));
  applyLaw(state, ticket.lawId);
  if (opts.character) applyCharacter(state, opts.character);
  if (opts.resume && phase === 'run') applyBookmark(state, opts.resume);
  return state;
}

export function nextId(state: RunState): number {
  return state.nextId++;
}
