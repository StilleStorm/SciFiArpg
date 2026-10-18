import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import type { GameEvents } from '../core/events';
import { createRng } from '../core/rng';
import { placeBoss, tickBoss } from '../enemies/bosses';
import { BOSS_OF, FAMILY_IDS, type BossId } from '../enemies/families';
import { rtOf } from '../enemies/runtime';
import { t } from '../i18n';
import { applyDamage, killEnemy } from '../systems/combat';
import { createRun, type RunState } from '../world/run';
import { DAMAGE_TYPES } from './damage';
import {
  SPOR_PROMPTS,
  SPOR_TTL_S,
  SPOR_WINDOW_S,
  SPOR_WRONG_COST,
  answerSpor,
  postSpor,
  promptFor,
  sporMul,
  tickSpor,
} from './spor';

const BOSSES: BossId[] = ['prototyp', 'weryfikacja', 'hipoteza'];

function setup(family: (typeof FAMILY_IDS)[number] = 'urzadzenia') {
  const s: RunState = createRun(11);
  s.enemies.length = 0;
  const bus = createBus();
  const log: { name: keyof GameEvents; payload: unknown }[] = [];
  for (const name of ['spor:posted', 'spor:answered', 'spor:closed', 'footnote', 'stamp', 'player:hit'] as const) {
    bus.on(name, (payload) => log.push({ name, payload }));
  }
  const boss = placeBoss(s, family, 800, 500);
  return { s, bus, log, boss };
}
const count = (log: { name: string }[], name: string): number => log.filter((l) => l.name === name).length;

describe('promptFor', () => {
  it('marks the reply of the right type as correct, for every boss and phase', () => {
    for (const boss of BOSSES) {
      for (const phase of [1, 2] as const) {
        const entry = SPOR_PROMPTS[boss][phase - 1];
        for (let seed = 1; seed < 25; seed++) {
          const p = promptFor(boss, phase, createRng(seed));
          expect(p.commentKey).toBe(entry?.commentKey);
          expect(p.replies[p.correct].type).toBe(entry?.answer);
          expect(p.replies.map((r) => r.type).sort()).toEqual([...DAMAGE_TYPES].sort());
        }
      }
    }
  });
  it('shuffles with the rng: deterministic per seed, and the right reply lands in every slot', () => {
    expect(promptFor('prototyp', 1, createRng(5))).toEqual(promptFor('prototyp', 1, createRng(5)));
    const slots = new Set<number>();
    for (let seed = 1; seed < 60; seed++) slots.add(promptFor('hipoteza', 2, createRng(seed)).correct);
    expect([...slots].sort()).toEqual([0, 1, 2]);
  });
  it('has text for every key', () => {
    for (const boss of BOSSES) {
      for (const entry of SPOR_PROMPTS[boss]) {
        for (const key of [entry.commentKey, ...entry.replies.map((r) => r.textKey)]) expect(t(key)).not.toBe(key);
      }
    }
  });
});

describe('postSpor', () => {
  it('posts once per boss and phase', () => {
    const { s, bus, log, boss } = setup();
    expect(postSpor(s, bus, boss, 1)).toBe(true);
    expect(postSpor(s, bus, boss, 1)).toBe(false);
    expect(count(log, 'spor:posted')).toBe(1);
    expect(s.spor?.prompt).not.toBeNull();
    expect(s.spor?.ttl).toBe(SPOR_TTL_S);
    // phase 2 replaces the prompt that is still up (closing it), and posts once as well
    expect(postSpor(s, bus, boss, 2)).toBe(true);
    expect(postSpor(s, bus, boss, 2)).toBe(false);
    expect(count(log, 'spor:posted')).toBe(2);
    expect(log.filter((l) => l.name === 'spor:closed').map((l) => (l.payload as { reason: string }).reason)).toEqual(['expired']);
    // a late phase 1 after phase 2 is ignored
    expect(postSpor(s, bus, boss, 1)).toBe(false);
  });
  it('the boss posts phase 1 after 1.5 s and phase 2 on its phase change', () => {
    const { s, bus, log, boss } = setup();
    s.time = 1.4;
    tickBoss(s, boss, bus, 1 / 60);
    expect(count(log, 'spor:posted')).toBe(0);
    s.time = 1.6;
    tickBoss(s, boss, bus, 1 / 60);
    expect(count(log, 'spor:posted')).toBe(1);
    expect(rtOf(boss).sporAt).toBeUndefined();
    boss.hp = boss.hpMax / 2 - 1;
    tickBoss(s, boss, bus, 1 / 60);
    const posts = log.filter((l) => l.name === 'spor:posted').map((l) => (l.payload as { phase: number }).phase);
    expect(posts).toEqual([1, 2]);
    tickBoss(s, boss, bus, 1 / 60);
    expect(count(log, 'spor:posted')).toBe(2);
  });
  it('every boss has a comment on each of its phases', () => {
    for (const family of FAMILY_IDS) {
      const { s, bus, boss } = setup(family);
      postSpor(s, bus, boss, 1);
      expect(s.spor?.prompt?.commentKey).toContain(`.${BOSS_OF[family]}.`);
    }
  });
});

describe('answerSpor', () => {
  it('a wrong reply costs 10% of racja, prints one footnote and closes the prompt', () => {
    const { s, bus, log, boss } = setup();
    postSpor(s, bus, boss, 1);
    const prompt = s.spor?.prompt;
    if (!prompt) throw new Error('no prompt');
    const wrong = ([0, 1, 2] as const).find((i) => i !== prompt.correct) ?? 0;
    s.player.hp = s.player.hpMax;
    expect(answerSpor(s, bus, wrong)).toBe('wrong');
    expect(s.player.hp).toBe(s.player.hpMax - Math.round(s.player.hpMax * SPOR_WRONG_COST));
    expect(log.filter((l) => l.name === 'footnote').map((l) => (l.payload as { text: string }).text)).toEqual([t('combat.spor.offTopic')]);
    expect(s.spor?.prompt).toBeNull();
    expect(s.spor?.window).toBe(0);
    expect(log.filter((l) => l.name === 'spor:closed').map((l) => (l.payload as { reason: string }).reason)).toEqual(['answered']);
    expect(answerSpor(s, bus, wrong)).toBe('none');
  });
  it('a wrong reply never kills', () => {
    const { s, bus, boss } = setup();
    postSpor(s, bus, boss, 1);
    s.player.hp = 3;
    answerSpor(s, bus, s.spor?.prompt?.correct === 0 ? 1 : 0);
    expect(s.player.hp).toBe(1);
    expect(s.status).toBe('running');
  });
  it('the right reply opens the 5 s window and stamps', () => {
    const { s, bus, log, boss } = setup();
    postSpor(s, bus, boss, 1);
    const hp = s.player.hp;
    expect(answerSpor(s, bus, s.spor?.prompt?.correct ?? 0)).toBe('right');
    expect(s.spor?.window).toBe(SPOR_WINDOW_S);
    expect(s.player.hp).toBe(hp);
    expect(count(log, 'stamp')).toBe(1);
    expect((log.find((l) => l.name === 'spor:answered')?.payload as { right: boolean }).right).toBe(true);
    expect(count(log, 'footnote')).toBe(0);
  });
  it('does nothing without a prompt or when the run is not running', () => {
    const { s, bus, boss } = setup();
    expect(answerSpor(s, bus, 0)).toBe('none');
    postSpor(s, bus, boss, 1);
    s.status = 'paused';
    expect(answerSpor(s, bus, 0)).toBe('none');
  });
});

describe('tickSpor', () => {
  it('the prompt expires after 12 s with no penalty', () => {
    const { s, bus, log, boss } = setup();
    postSpor(s, bus, boss, 1);
    const hp = s.player.hp;
    for (let i = 0; i < SPOR_TTL_S * 60 - 2; i++) tickSpor(s, bus, 1 / 60);
    expect(s.spor?.prompt).not.toBeNull();
    for (let i = 0; i < 4; i++) tickSpor(s, bus, 1 / 60);
    expect(s.spor?.prompt).toBeNull();
    expect(log.filter((l) => l.name === 'spor:closed').map((l) => (l.payload as { reason: string }).reason)).toEqual(['expired']);
    expect(s.player.hp).toBe(hp);
    expect(count(log, 'footnote')).toBe(0);
  });
  it('the death of the boss closes the prompt with reason died', () => {
    const { s, bus, log, boss } = setup();
    postSpor(s, bus, boss, 1);
    killEnemy(s, bus, boss);
    tickSpor(s, bus, 1 / 60);
    expect(s.spor?.prompt).toBeNull();
    expect(log.filter((l) => l.name === 'spor:closed').map((l) => (l.payload as { reason: string }).reason)).toEqual(['died']);
  });
  it('the window runs out, and ends with the boss', () => {
    const { s, bus, boss } = setup();
    postSpor(s, bus, boss, 1);
    answerSpor(s, bus, s.spor?.prompt?.correct ?? 0);
    tickSpor(s, bus, 2);
    expect(s.spor?.window).toBeCloseTo(SPOR_WINDOW_S - 2);
    tickSpor(s, bus, 4);
    expect(s.spor?.window).toBe(0);
    postSpor(s, bus, boss, 2);
    answerSpor(s, bus, s.spor?.prompt?.correct ?? 0);
    killEnemy(s, bus, boss);
    tickSpor(s, bus, 1 / 60);
    expect(s.spor?.window).toBe(0);
  });
});

describe('sporMul', () => {
  it('is 2 only for that boss and only while the window is open', () => {
    const { s, bus, boss } = setup();
    expect(sporMul(s, boss.id)).toBe(1);
    postSpor(s, bus, boss, 1);
    expect(sporMul(s, boss.id)).toBe(1); // the prompt alone does nothing
    answerSpor(s, bus, s.spor?.prompt?.correct ?? 0);
    expect(sporMul(s, boss.id)).toBe(2);
    expect(sporMul(s, boss.id + 1)).toBe(1);
    expect(sporMul(s, s.player.id)).toBe(1);
    tickSpor(s, bus, SPOR_WINDOW_S + 0.1);
    expect(sporMul(s, boss.id)).toBe(1);
  });
  it('doubles the damage the boss takes (and stacks with a rebuttal crit), other enemies are unchanged', () => {
    const { s, bus, boss } = setup();
    boss.hp = boss.hpMax = 1000;
    boss.claim = undefined;
    postSpor(s, bus, boss, 1);
    applyDamage(s, bus, boss, 10, false, 'mechaniczny');
    expect(boss.hp).toBe(990);
    answerSpor(s, bus, s.spor?.prompt?.correct ?? 0);
    applyDamage(s, bus, boss, 10, false, 'mechaniczny');
    expect(boss.hp).toBe(970);
    boss.claim = { textKey: 'x', type: 'regulaminowy' };
    applyDamage(s, bus, boss, 10, false, 'regulaminowy');
    expect(boss.hp).toBe(970 - 40);
  });
});
