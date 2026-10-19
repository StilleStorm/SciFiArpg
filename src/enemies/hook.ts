/** Test-hook functions for enemies (window.__game.enemies): shots and tests put families, bosses and statuses on the page. */
import { answerSpor } from '../combat/spor';
import { applyStatus, type StatusKind } from '../combat/status';
import type { Bus } from '../core/events';
import type { Enemy } from '../entities/types';
import { applyDamage } from '../systems/combat';
import type { DamageType } from '../combat/damage';
import { nextId, type RunState } from '../world/run';
import { placeBoss } from './bosses';
import { ELITE_IDS, FAMILY_IDS, type EliteId, type FamilyId } from './families';
import { ownAffixes } from './elites';
import { makeEnemy } from './make';
import { spawnWave } from './spawn';

export interface EnemyHook {
  /** Put `n` enemies of a family in rows of three, 80-320 units above the player (all in view). Returns their ids. */
  spawnFamily(family: FamilyId, n?: number, opts?: { tier?: number; elite?: EliteId }): number[];
  /** A leader (random or given affix) with its pack of 2-4 minions, about 220 units above the player. Returns the ids, leader first. */
  spawnPack(family: FamilyId, affix?: EliteId): number[];
  /** A named elite (2-3 affixes, a recorded name), about 220 units above the player. Returns its id. */
  spawnNamed(family: FamilyId, affix?: EliteId): number | null;
  /** Put the family's boss about 170 units above the player. */
  spawnBoss(family: FamilyId): number | null;
  /** Hit an enemy with an attack of a damage type (goes through claims, existence and statuses). */
  hit(id: number, type: DamageType, amount?: number): boolean;
  /** Remove every enemy at once. */
  clear(): void;
  /** Apply a status to every enemy (default 8 s). */
  applyStatus(kind: StatusKind, seconds?: number): void;
  /** Plain data about the enemies. */
  list(): { id: number; family: FamilyId; tier: number; x: number; y: number; hp: number; boss: boolean; elite: string | null; existence: number | null; claim: string | null; defect: string | null; affixes: string[]; named: string | null; packOf: number | null }[];
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
    spawnPack(family, affix) {
      const s = getState();
      if (!s || !FAMILY_IDS.includes(family)) return [];
      const at = { x: s.player.x, y: s.player.y - 220 };
      const got = spawnWave(s, family, 1, at, { elite: affix ?? s.rngs.spawn.pick(ELITE_IDS), pack: true, makeNamed: false, minRadius: 0, maxRadius: 20, minPlayer: 100 });
      return got.map((e) => e.id);
    },
    spawnNamed(family, affix) {
      const s = getState();
      if (!s || !FAMILY_IDS.includes(family)) return null;
      const at = { x: s.player.x, y: s.player.y - 220 };
      const got = spawnWave(s, family, 1, at, { elite: affix ?? s.rngs.spawn.pick(ELITE_IDS), makeNamed: true, pack: false, minRadius: 0, maxRadius: 20, minPlayer: 100 });
      return got[0]?.id ?? null;
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
        affixes: [...ownAffixes(e)],
        named: e.rt?.named?.name ?? null,
        packOf: e.rt?.packOf ?? null,
      }));
    },
  };
}

/** The boss argument (combat/spor.ts) for the test hook: `window.__game.spor`. */
export interface SporHook {
  /** Pick reply `index` as the strip's button would. */
  answer(index: 0 | 1 | 2): 'right' | 'wrong' | 'none';
  /** The prompt and the window, or null before any boss posted. `open` = a comment is up; `window` = seconds of x2 left. */
  info(): {
    open: boolean;
    boss: number;
    phase: 1 | 2;
    ttl: number;
    window: number;
    correct: 0 | 1 | 2 | null;
    commentKey: string | null;
    replies: { textKey: string; type: DamageType }[];
  } | null;
}

export function createSporHook(getState: () => RunState | null, bus: Bus): SporHook {
  return {
    answer(index) {
      const s = getState();
      return s ? answerSpor(s, bus, index) : 'none';
    },
    info() {
      const sp = getState()?.spor;
      if (!sp) return null;
      return {
        open: sp.prompt !== null,
        boss: sp.bossId,
        phase: sp.phase,
        ttl: sp.ttl,
        window: sp.window,
        correct: sp.prompt?.correct ?? null,
        commentKey: sp.prompt?.commentKey ?? null,
        replies: sp.prompt ? sp.prompt.replies.map((r) => ({ textKey: r.textKey, type: r.type })) : [],
      };
    },
  };
}
