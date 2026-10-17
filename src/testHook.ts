import { dist } from './core/vec';
import type { Screen } from './core/events';
import type { Game } from './game';
import { currentTheme, setTheme, type Theme } from './render/stage';
import { addFootnote } from './ui/footnotes';
import type { Enemy } from './entities';
import type { Bus } from './core/events';
import { applyDamage } from './systems/combat';

export interface GameHook {
  /** Start a run from a seed (default 1) and show the run screen. */
  start(seed?: number): void;
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
  go(screen: Screen, seed?: number): void;
  bus: Bus;
}

const NEAR = 90;

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
    start: (seed = 1) => deps.go('run', seed),
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
