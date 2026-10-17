import { createRng, type Rng } from '../core/rng';
import type { Enemy, Pickup, Player, Projectile } from '../entities';
import { createPlayer } from '../entities/factory';
import { generatePage, type Page } from './pages';
import { applyLaw, type LawId } from './laws';

export interface RunState {
  seed: number;
  rng: Rng;
  /** Independent streams so one system's rolls never shift another's. */
  rngs: { ai: Rng; combat: Rng; loot: Rng; spawn: Rng };
  /** Seconds of simulated time. */
  time: number;
  status: 'running' | 'dead';
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
  /** Seconds until the next placeholder enemy trickles in. */
  spawnTimer: number;
}

export function createRun(seed: number): RunState {
  const rng = createRng(seed);
  const page = generatePage(rng);
  const state: RunState = {
    seed,
    rng,
    rngs: { ai: rng.fork('ai'), combat: rng.fork('combat'), loot: rng.fork('loot'), spawn: rng.fork('spawn') },
    time: 0,
    status: 'running',
    page,
    pageIndex: 0,
    pageCount: 1,
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
  };
  if (state.lawId) applyLaw(state, state.lawId);
  return state;
}

export function nextId(state: RunState): number {
  return state.nextId++;
}
