import type { Bus } from '../core/events';
import { createRng, type Rng } from '../core/rng';
import type { Enemy } from '../entities/types';
import { BOSS_OF, type BossId } from '../enemies/families';
import { t } from '../i18n';
import { planetDef } from '../world/campaign';
import { hasStory } from '../world/planets/storyKeys';
import { applyDamage } from '../systems/combat';
import type { RunState } from '../world/run';
import { DAMAGE_TYPES, type DamageType } from './damage';
import { meterGain, METER_SPOR } from './meter';

/**
 * Spor (boss arguments), DESIGN 5.4. At each boss phase the boss posts a comment; three replies appear as margin
 * buttons, one matches the comment. A wrong reply costs 10% racja and a footnote; the right one strikes the comment
 * through and opens a 5 s window of x2 damage against that boss. Skippable by just fighting.
 */
export interface SporReply {
  /** i18n key of the reply button text. */
  textKey: string;
  type: DamageType;
}

export interface SporPrompt {
  /** i18n key of the boss comment (1-2 lines). */
  commentKey: string;
  /** Exactly three replies. */
  replies: readonly [SporReply, SporReply, SporReply];
  /** Index into `replies` of the one that matches the comment. */
  correct: 0 | 1 | 2;
}

export interface SporState {
  /** The comment that is up now, or null. */
  prompt: SporPrompt | null;
  /** The boss the prompt (and the window) belongs to. */
  bossId: number;
  /** Phase of the prompt that is up, or of the last one posted. */
  phase: 1 | 2;
  /** Seconds the prompt has left. */
  ttl: number;
  /** Seconds left of the x2 against `bossId` (0 = closed). */
  window: number;
  /** `answered[bossId]` = the last phase that already posted: a boss posts once per phase. */
  answered: Record<number, 1 | 2>;
}

export type SporCloseReason = 'answered' | 'expired' | 'died';

export const SPOR_TTL_S = 12;
export const SPOR_WINDOW_S = 5;
/** A wrong reply costs this share of the maximum racja. */
export const SPOR_WRONG_COST = 0.1;
/** Seconds after the boss is on the page before the first comment. */
export const SPOR_FIRST_S = 1.5;
/** The multiplier on damage against the boss while the window is open. */
export const SPOR_MUL = 2;

/** One comment of a boss: its key, the type of the reply that answers it, and one reply per type (mechaniczny, regulaminowy, egzystencjalny). */
export interface SporEntry {
  commentKey: string;
  answer: DamageType;
  replies: readonly [SporReply, SporReply, SporReply];
}

const entry = (boss: BossId, phase: 1 | 2, answer: DamageType): SporEntry => {
  const base = `enemies.boss.${boss}.spor${phase}`;
  const reply = (type: DamageType): SporReply => ({ textKey: `${base}.reply.${type}`, type });
  const [a, b, c] = DAMAGE_TYPES;
  return { commentKey: `${base}.comment`, answer, replies: [reply(a ?? 'mechaniczny'), reply(b ?? 'regulaminowy'), reply(c ?? 'egzystencjalny')] };
};

/** Two comments per boss: phase 1 and phase 2. The keys live in enemies.json. */
export const SPOR_PROMPTS: Record<BossId, readonly [SporEntry, SporEntry]> = {
  prototyp: [entry('prototyp', 1, 'mechaniczny'), entry('prototyp', 2, 'regulaminowy')],
  weryfikacja: [entry('weryfikacja', 1, 'regulaminowy'), entry('weryfikacja', 2, 'egzystencjalny')],
  hipoteza: [entry('hipoteza', 1, 'egzystencjalny'), entry('hipoteza', 2, 'mechaniczny')],
};

/**
 * Which reply type answers the comment of each phase on a planet (0-based index), when the planet's boss argues in its own
 * words (`story.p<N>.boss.spor1|spor2.*`, STORY 8.x). A planet without an entry here, or whose keys are not written, uses the family table.
 */
export const STORY_ANSWERS: Readonly<Record<number, readonly [DamageType, DamageType]>> = {
  0: ['regulaminowy', 'mechaniczny'],
};

/** The planet's own comment of a phase, or null when the planet has none (then the family's applies). */
export function storyEntry(planet: number | undefined, boss: BossId, phase: 1 | 2): SporEntry | null {
  if (planet === undefined) return null;
  const answers = STORY_ANSWERS[planet];
  if (!answers || planetDef(planet).boss !== boss) return null;
  const base = `story.p${planet + 1}.boss.spor${phase}`;
  if (!hasStory(`p${planet + 1}.boss.spor${phase}.comment`)) return null;
  const reply = (type: DamageType): SporReply => ({ textKey: `${base}.reply.${type}`, type });
  const [a, b, c] = DAMAGE_TYPES;
  return { commentKey: `${base}.comment`, answer: answers[phase - 1] ?? 'mechaniczny', replies: [reply(a ?? 'mechaniczny'), reply(b ?? 'regulaminowy'), reply(c ?? 'egzystencjalny')] };
}

/**
 * The prompt of a boss and phase, the three replies shuffled with `rng`; `correct` points at the one that answers the comment.
 * With a `planet` that has its own comments (`storyEntry`) they replace the family's.
 */
export function promptFor(boss: BossId, phase: 1 | 2, rng: Rng, planet?: number): SporPrompt {
  const src = storyEntry(planet, boss, phase) ?? SPOR_PROMPTS[boss][phase - 1] ?? SPOR_PROMPTS[boss][0];
  const list = [...src.replies];
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const a = list[i];
    const b = list[j];
    if (a && b) {
      list[i] = b;
      list[j] = a;
    }
  }
  const [r0, r1, r2] = list;
  if (!r0 || !r1 || !r2) throw new Error('spor: three replies expected');
  const replies: [SporReply, SporReply, SporReply] = [r0, r1, r2];
  const at = replies.findIndex((r) => r.type === src.answer);
  const correct: 0 | 1 | 2 = at === 1 ? 1 : at === 2 ? 2 : 0;
  return { commentKey: src.commentKey, replies, correct };
}

const sporOf = (s: RunState): SporState => {
  if (!s.spor) s.spor = { prompt: null, bossId: 0, phase: 1, ttl: 0, window: 0, answered: {} };
  return s.spor;
};

function close(sp: SporState, bus: Bus, reason: SporCloseReason): void {
  if (!sp.prompt) return;
  sp.prompt = null;
  sp.ttl = 0;
  bus.emit('spor:closed', { id: sp.bossId, reason });
}

/**
 * The boss posts the comment of `phase`. Once per boss and phase: a phase that already posted (or an earlier one, after
 * a later one) is ignored. A prompt still up is replaced. Returns true when a comment was posted.
 */
export function postSpor(s: RunState, bus: Bus, boss: Enemy, phase: 1 | 2): boolean {
  const sp = sporOf(s);
  if ((sp.answered[boss.id] ?? 0) >= phase) return false;
  sp.answered[boss.id] = phase;
  // a stream of its own, so the shuffle never moves another system's rolls
  const prompt = promptFor(BOSS_OF[boss.family], phase, createRng(s.seed ^ Math.imul(boss.id, 0x9e3779b1)).fork(`spor${phase}`), s.plan?.planet);
  close(sp, bus, 'expired');
  sp.prompt = prompt;
  sp.bossId = boss.id;
  sp.phase = phase;
  sp.ttl = SPOR_TTL_S;
  bus.emit('spor:posted', { id: boss.id, phase, commentKey: prompt.commentKey, replies: prompt.replies.map((r) => r.textKey) });
  return true;
}

/**
 * The player picks reply `index`. 'none' = no prompt up (or the run is not running). Wrong: 10% of racja through applyDamage
 * (never the killing blow: a reply does not end a ticket) and a footnote. Right: the 5 s window opens and ODPOWIEDZIANO is stamped.
 */
export function answerSpor(s: RunState, bus: Bus, index: 0 | 1 | 2): 'right' | 'wrong' | 'none' {
  const sp = s.spor;
  if (!sp?.prompt || s.status !== 'running') return 'none';
  const boss = s.enemies.find((e) => e.id === sp.bossId);
  const reply = sp.prompt.replies[index];
  if (!boss || !reply) return 'none';
  const right = index === sp.prompt.correct;
  bus.emit('spor:answered', { id: boss.id, index, right });
  if (right) {
    sp.window = SPOR_WINDOW_S;
    meterGain(s, METER_SPOR); // a right reply fills half of the Argument meter
    bus.emit('stamp', { text: t('combat.spor.stamp'), x: boss.x, y: boss.y - 12 }); // on the body, so the struck comment above stays legible
  } else {
    const p = s.player;
    const cost = Math.min(Math.max(1, Math.round(p.hpMax * SPOR_WRONG_COST)), Math.max(0, p.hp - 1));
    if (cost > 0) applyDamage(s, bus, p, cost, false);
    bus.emit('footnote', { text: t('combat.spor.offTopic') });
  }
  close(sp, bus, 'answered');
  return right ? 'right' : 'wrong';
}

/** Per step (run phase): the prompt's time, the window's time, and both end with the boss. */
export function tickSpor(s: RunState, bus: Bus, dt: number): void {
  const sp = s.spor;
  if (!sp) return;
  const alive = s.enemies.some((e) => e.id === sp.bossId);
  if (sp.prompt) {
    if (!alive) close(sp, bus, 'died');
    else {
      sp.ttl -= dt;
      if (sp.ttl <= 0) close(sp, bus, 'expired');
    }
  }
  if (sp.window > 0) sp.window = alive ? Math.max(0, sp.window - dt) : 0;
}

/** The factor on damage against `defenderId`: 2 against the boss that was argued with, while its window is open. */
export function sporMul(s: Pick<RunState, 'spor'>, defenderId: number): 1 | 2 {
  const sp = s.spor;
  return sp !== undefined && sp.window > 0 && sp.bossId === defenderId ? SPOR_MUL : 1;
}
