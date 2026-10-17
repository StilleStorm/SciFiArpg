/** Test-hook functions for enemies (window.__game.enemies): shots and tests put families, bosses and statuses on the page. */
import { applyStatus, type StatusKind } from '../combat/status';
import type { Bus } from '../core/events';
import type { Enemy } from '../entities/types';
import { applyDamage } from '../systems/combat';
import type { DamageType } from '../combat/damage';
import { nextId, type RunState } from '../world/run';
import { placeBoss } from './bosses';
import { FAMILY_IDS, type EliteId, type FamilyId } from './families';
import { makeEnemy } from './make';

export interface EnemyHook {
  /** Put `n` enemies of a family in rows of three, 80-320 units above the player (all in view). Returns their ids. */
  spawnFamily(family: FamilyId, n?: number, opts?: { tier?: number; elite?: EliteId }): number[];
  /** Put the family's boss about 170 units above the player. */
  spawnBoss(family: FamilyId): number | null;
  /** Hit an enemy with an attack of a damage type (goes through claims, existence and statuses). */
  hit(id: number, type: DamageType, amount?: number): boolean;
  /** Remove every enemy at once. */
  clear(): void;
  /** Apply a status to every enemy (default 8 s). */
  applyStatus(kind: StatusKind, seconds?: number): void;
  /** Plain data about the enemies. */
  list(): { id: number; family: FamilyId; tier: number; x: number; y: number; hp: number; boss: boolean; elite: string | null; existence: number | null; claim: string | null; defect: string | null }[];
}

export function createEnemyHook(getState: () => RunState | null, bus: Bus): EnemyHook {
  return {
    hit(id, type, amount = 3) {
      const s = getState();
      const e = s?.enemies.find((x) => x.id === id);
      if (!s || !e) return false;
      applyDamage(s, bus, e, amount, false, type);
      return true;
    },
    spawnFamily(family, n = 1, opts = {}) {
      const s = getState();
      if (!s || !FAMILY_IDS.includes(family)) return [];
      const ids: number[] = [];
      for (let i = 0; i < n; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = s.player.x + (col - 1) * 100 + (row % 2) * 24;
        const y = s.player.y - 80 - row * 120;
        const e = makeEnemy(nextId(s), x, y, s.rngs.spawn.int(1, 1e6), family, opts);
        e.home = { x, y };
        s.enemies.push(e);
        ids.push(e.id);
      }
      return ids;
    },
    spawnBoss(family) {
      const s = getState();
      if (!s) return null;
      return placeBoss(s, family, s.player.x, s.player.y - 190).id;
    },
    clear() {
      const s = getState();
      if (s) s.enemies.length = 0;
    },
    applyStatus(kind, seconds = 8) {
      const s = getState();
      if (!s) return;
      for (const e of s.enemies) applyStatus(e, kind, seconds, s.player.id);
    },
    list() {
      const s = getState();
      if (!s) return [];
      return s.enemies.map((e: Enemy) => ({
        id: e.id,
        family: e.family,
        tier: e.tier,
        x: Math.round(e.x),
        y: Math.round(e.y),
        hp: e.hp,
        boss: e.boss === true,
        elite: e.elite?.affix ?? null,
        existence: e.existence ?? null,
        claim: e.claim?.textKey ?? null,
        defect: e.defect ?? null,
      }));
    },
  };
}

