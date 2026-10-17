import type { Bus } from './core/events';
import type { Entity } from './entities';
import type { Input } from './input';
import { t } from './i18n';
import type { Camera } from './render/camera';
import { createViews, type Views } from './render/view';
import { placeholderBuilders } from './render/figures';
import { drawPage } from './render/obstacles';
import { tapMark } from './render/ink';
import type { Stage } from './render/stage';
import { ENEMY_COUNT, spawnEnemy } from './systems/enemies';
import { createSim } from './systems/step';
import { createRun, type RunState } from './world/run';

export interface Game {
  readonly state: RunState | null;
  readonly views: Views;
  start(seed: number): RunState;
  update(dt: number): void;
  render(dtSec: number): void;
  onTap(clientX: number, clientY: number): void;
}

/** Ties run state to the stage: simulation step, view sync, camera. Owns no rules. */
export function createGame(stage: Stage, bus: Bus, camera: Camera, input: Input): Game {
  const views = createViews(stage.world, placeholderBuilders);
  const sim = createSim(bus);
  const ents: Entity[] = [];
  let state: RunState | null = null;

  const game: Game = {
    get state() {
      return state;
    },
    views,
    start(seed) {
      const s = createRun(seed);
      state = s;
      views.clear();
      stage.fx.replaceChildren();
      drawPage(stage.page, s.page);
      for (let i = 0; i < ENEMY_COUNT; i++) spawnEnemy(s);
      camera.snap(s.player.x, s.player.y);
      camera.apply();
      input.setEnabled(true);
      bus.emit('run:started', { seed });
      bus.emit('stamp', { text: t('ui.run.stamp'), x: s.player.x, y: s.player.y - 120 });
      return s;
    },
    update(dt) {
      const s = state;
      if (!s || s.status !== 'running') return;
      const held = input.held();
      if (held) s.player.target = camera.screenToWorld(held.x, held.y);
      sim.step(s, dt);
      if (s.status !== 'running') input.setEnabled(false);
    },
    render(dtSec) {
      const s = state;
      if (!s) return;
      ents.length = 0;
      ents.push(s.player);
      for (const e of s.enemies) ents.push(e);
      for (const k of s.pickups) ents.push(k);
      for (const p of s.projectiles) ents.push(p);
      views.sync(ents, s.time * 1000);
      camera.follow(s.player.x, s.player.y, dtSec);
      camera.apply();
    },
    onTap(clientX, clientY) {
      const s = state;
      if (!s || s.status !== 'running') return;
      const w = camera.screenToWorld(clientX, clientY);
      s.player.target = w;
      tapMark(w.x, w.y);
    },
  };
  return game;
}
