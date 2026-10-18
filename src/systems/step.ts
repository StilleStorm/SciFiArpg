import { tickStatuses } from '../combat/status';
import type { Bus } from '../core/events';
import { createGrid, type Enemy } from '../entities';
import { tickBase } from '../world/base';
import { trackEnemies } from '../world/enemyInfo';
import { lawPre, tickLaw } from '../world/laws';
import { tickPageTurn } from '../world/pageTurn';
import { tickTunnel } from '../world/tunnel';
import type { RunState } from '../world/run';
import { enemiesAttack, playerAttacks } from './combat';
import { trickleSpawn, updateEnemies } from './enemies';
import { movePlayer } from './movement';
import { collectPickups } from './pickups';
import { updateLoot } from './loot';
import { heroStep } from '../heroes/system';

/** The fixed update. Order matters: move, ai, combat, loot. One grid is rebuilt each step. */
export function createSim(bus: Bus) {
  const grid = createGrid<Enemy>(64);
  return {
    step(s: RunState, dt: number): void {
      if (s.status !== 'running') return;
      if (s.modal || s.turning) return; // a sheet waits for an answer, or the page is turning
      if (s.phase === 'base') {
        // The base page: the player walks, the stations and the exit are watched. No clock, no laws, no spawns, no fights.
        movePlayer(s, bus, dt);
        tickBase(s, bus, dt);
        tickTunnel(s, bus);
        return;
      }
      s.time += dt;
      trackEnemies(s.enemies);
      const undoLaw = lawPre(s);
      tickStatuses(s.player, dt);
      for (const e of s.enemies) tickStatuses(e, dt);
      movePlayer(s, bus, dt);
      grid.clear();
      for (const e of s.enemies) grid.insert(e);
      updateEnemies(s, grid, bus, dt);
      grid.clear();
      for (const e of s.enemies) grid.insert(e);
      if (!s.law.botTime) {
        // Godziny konsultanta: during bot hours nobody deals damage.
        playerAttacks(s, grid, bus, dt);
        enemiesAttack(s, bus, dt);
      }
      heroStep(s, bus, dt);
      collectPickups(s, bus);
      updateLoot(s, bus, dt);
      trickleSpawn(s, dt);
      undoLaw();
      tickLaw(s, bus, dt);
      tickPageTurn(s, bus);
      tickTunnel(s, bus);
    },
  };
}
