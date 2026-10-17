import { dist } from './core/vec';
import type { Screen } from './core/events';
import type { Game } from './game';
import { currentTheme, setTheme, type Theme } from './render/stage';
import { addFootnote } from './ui/footnotes';
import type { Enemy } from './entities';
import type { Bus } from './core/events';
import { applyDamage } from './systems/combat';
import type { MetaState } from './save/save';
import type { RunOptions, RunState } from './world/run';
import { openKiosk } from './economy/kiosk';
import { fillDemoInventory, giveRandomItem } from './items/demo';
import type { Item, ItemTier, Slot } from './items';
import { mountSklep, type SklepHandle } from './ui/sklep';
import { createHeroHook, type HeroHook } from './heroes/hook';
import { createEnemyHook, type EnemyHook } from './enemies/hook';

export interface GameHook {
  /** Start a run from a seed (default 1) and show the run screen. */
  start(seed?: number, opts?: RunOptions): void;
  /** Run the simulation for `seconds` of game time at once (60 Hz steps). */
  advance(seconds: number): void;
  /** The live run (read-only use in shots and tests). */
  state(): RunState | null;
  /** Play the page turn to page `index` at once, as if the exit was reached. */
  turnTo(index: number): void;
  meta(): MetaState;
  setMeta(meta: MetaState): void;
  screen(): Screen;
  go(screen: Screen): void;
  /** Wound the nearest enemy without killing it (moves it near the player first if far away). */
  hitEnemy(): boolean;
  /** Kill the nearest enemy through the normal path (blot, strike, pickup, footnote). */
  killEnemy(): boolean;
  /** Take away `amount` racja from the player (lethal amounts kill). */
  hurtPlayer(amount: number): void;
  /** Put the player at world (x, y) and clear its walk target. */
  placePlayer(x: number, y: number): void;
  setTheme(theme: Theme): void;
  theme(): 'day' | 'night';
  footnote(text: string): void;
  /** Put a rolled item of `tier` (default zwykly) into the inventory; returns it, or null when there is no run or no room. */
  giveItem(tier?: ItemTier | 'unikatowy', slot?: Slot): Item | null;
  /** Replace the inventory with six fixed items (two worn, one niekompatybilny, a unique, a free version). */
  demoInventory(): void;
  /** Open the Załączniki sheet (same as the pad). */
  openInventory(): void;
  /** Open the base Sklep sheet over the current screen (gwiazdki are topped up to 40 if lower). */
  openSklep(): void;
  /** Tap the in-run kiosk: the sheet when the office is open, a bot footnote otherwise. */
  openKiosk(): string;
  /** Hero skills, updates, permissions and deaths (heroes/hook.ts). */
  hero: HeroHook;
  /** Families, bosses and statuses on demand (enemies/hook.ts). */
  enemies: EnemyHook;
  /** Plain-data snapshot for assertions. */
  snapshot(): { screen: Screen; time: number; hp: number; enemies: number; pickups: number; kills: number; x: number; y: number } | null;
}

declare global {
  interface Window {
    __game?: GameHook;
  }
}

export interface HookDeps {
  game: Game;
  getScreen(): Screen;
  go(screen: Screen, seed?: number, opts?: RunOptions): void;
  getMeta(): MetaState;
  setMeta(meta: MetaState): void;
  bus: Bus;
}

const NEAR = 90;

let skHandle: SklepHandle | null = null;

export function installTestHook(deps: HookDeps): void {
  const { game } = deps;

  /** Nearest enemy, pulled into view if needed so screenshots are deterministic. */
  function nearest(): Enemy | null {
    const s = game.state;
    if (!s) return null;
    let best: Enemy | null = null;
    for (const e of s.enemies) if (!best || dist(e, s.player) < dist(best, s.player)) best = e;
    if (best && dist(best, s.player) > 150) {
      best.x = s.player.x + NEAR;
      best.y = s.player.y - 20;
      best.home = { x: best.x, y: best.y };
    }
    return best;
  }

  window.__game = {
    start: (seed = 1, opts) => deps.go('run', seed, opts),
    advance(seconds) {
      const steps = Math.round(seconds * 60);
      for (let i = 0; i < steps; i++) game.update(1 / 60);
    },
    state: () => game.state,
    hero: createHeroHook(game, deps.bus),
    enemies: createEnemyHook(() => game.state, deps.bus),
    turnTo(index) {
      const s = game.state;
      if (!s || s.turning) return;
      s.turning = true;
      deps.bus.emit('page:turn', { from: s.pageIndex, to: index });
    },
    meta: () => deps.getMeta(),
    setMeta: (m) => deps.setMeta(m),
    screen: () => deps.getScreen(),
    go: (screen) => deps.go(screen),
    hitEnemy() {
      const e = nearest();
      const s = game.state;
      if (!e || !s) return false;
      applyDamage(s, deps.bus, e, 4, false);
      return true;
    },
    killEnemy() {
      const e = nearest();
      const s = game.state;
      if (!e || !s) return false;
      applyDamage(s, deps.bus, e, e.hp + 1, false);
      return true;
    },
    hurtPlayer(amount) {
      const s = game.state;
      if (s && s.status === 'running') applyDamage(s, deps.bus, s.player, amount, false);
    },
    placePlayer(x, y) {
      const s = game.state;
      if (!s) return;
      s.player.x = x;
      s.player.y = y;
      s.player.target = null;
    },
    setTheme,
    theme: currentTheme,
    footnote: addFootnote,
    giveItem(tier = 'zwykly', slot) {
      const st = game.state;
      if (!st) return null;
      return giveRandomItem(st.player, st.nextItemNumber++, tier, Math.max(1, st.player.level + st.pageIndex), slot);
    },
    demoInventory() {
      const st = game.state;
      if (st) {
        fillDemoInventory(st.player);
        st.nextItemNumber = 15;
      }
    },
    openInventory: () => deps.bus.emit('inventory'),
    openSklep() {
      const st = game.state;
      const root = document.getElementById('ui');
      if (!root) return;
      const player = st?.player ?? { gwiazdki: 40, inventory: [], level: 1 };
      if (player.gwiazdki < 40) player.gwiazdki = 40;
      skHandle?.unmount();
      skHandle = mountSklep(root, deps.getMeta(), player);
    },
    openKiosk: () => openKiosk(),
    snapshot() {
      const s = game.state;
      if (!s) return null;
      return {
        screen: deps.getScreen(),
        time: s.time,
        hp: s.player.hp,
        enemies: s.enemies.length,
        pickups: s.pickups.length,
        kills: s.kills,
        x: s.player.x,
        y: s.player.y,
      };
    },
  };
}
