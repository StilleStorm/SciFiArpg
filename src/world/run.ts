import { createRng, type Rng } from '../core/rng';
import type { Enemy, Pickup, Player, Projectile, Summon, Zone } from '../entities';
import { applyHero, createHeroRun, heroDef, type HeroId, type HeroRun } from '../heroes';
import { createPlayer } from '../entities/factory';
import { generateRunPages, type Page } from './pages';
import { applyLaw, neutralLaw, type LawFlags, type LawId } from './laws';
import type { Tunnel } from './tunnel';
import { ticketForSeed, type TicketInfo } from './ticket';

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
}

/** Optional overrides for tests and screenshots; everything else comes from the seed. */
export interface RunOptions {
  /** Printed on the header; default is the first ticket number. */
  ticketNumber?: number;
  lawId?: LawId;
  pageCount?: number;
  /** Which hero to play; default Pralka. */
  heroId?: HeroId;
  /** Resume a bookmarked ticket: same seed, clause and page count, the page at that index, the clock restored (save/bookmark.ts). */
  resume?: Bookmark;
  /** The saved character to play: gear, purse, level, updates (save/character.ts), applied before the stats are computed. */
  character?: Character;
}

export function createRun(seed: number, opts: RunOptions = {}): RunState {
  const rng = createRng(seed);
  const ticket = ticketForSeed(seed, opts.ticketNumber ?? opts.resume?.ticketNumber);
  const lawId = opts.lawId ?? opts.resume?.lawId;
  const pageCount = opts.pageCount ?? opts.resume?.pageCount;
  if (lawId) ticket.lawId = lawId;
  if (pageCount) ticket.pageCount = pageCount;
  const pages = generateRunPages(rng, ticket.pageCount);
  const page = pages[0] ?? generateRunPages(rng, 1)[0];
  if (!page) throw new Error('no page');
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
    populate: true,
    kioskPending: false,
    victoryAt: null,
    hero: createHeroRun(opts.heroId ?? 'pralka'),
    summons: [],
    zones: [],
  };
  applyHero(state.player, heroDef(opts.heroId ?? 'pralka'));
  applyLaw(state, ticket.lawId);
  if (opts.character) applyCharacter(state, opts.character);
  if (opts.resume) applyBookmark(state, opts.resume);
  return state;
}

export function nextId(state: RunState): number {
  return state.nextId++;
}
