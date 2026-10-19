/**
 * Page content rules (PLAN 8): teczki opened by a tap, seals that stamp a timed buff, and the frame of page events
 * (a form to fill under fire, a lost delivery, an audit). Data and placement: world/contentKinds.ts, world/pages.ts;
 * drawings: render/obstacles.ts. Run phase only.
 *
 * The step calls `contentPre` around the whole simulated step (like `lawPre`: the buffs lay their numbers on the player
 * and the clause for one step and take them off again) and `tickContent` once per step. Taps arrive on the bus through
 * `bindContent`, bound once at boot by main.ts. Buffs live on `RunState.buffs` (`activeBuffs(s)` is the read API); the
 * transient tap/audit runtime stays in a WeakMap beside the run.
 */
import { meterGain } from '../combat/meter';
import type { Bus } from '../core/events';
import { dist } from '../core/vec';
import { createPickup, createPotwierdzeniePickup } from '../entities/factory';
import { spawnWave } from '../enemies/spawn';
import { t } from '../i18n';
import { rollItem } from '../items/generate';
import { dropGuaranteed, dropLevel, PRIORITY_STAR_MUL, rollDropTier, type TierWeights } from '../systems/loot';
import { redrawContent } from '../render/obstacles';
import {
  CONTENT,
  SEALS,
  type ActiveBuff,
  type EventId,
  type PageContent,
  type SealId,
  type Teczka,
  type Zdarzenie,
} from './contentKinds';
import { nextId, type RunState } from './run';

export * from './contentKinds';

// ---------- runtime beside the run ----------

interface Runtime {
  /** The folder the last tap chose (walks there, opens on arrival). */
  pending: number | null;
  /** Racja at the last step (the audit fails on any loss). */
  lastHp: number;
  /** `contentPre` has laid the buffs on this step. */
  wrapped: boolean;
}

const RT = new WeakMap<RunState, Runtime>();

function rtOf(s: RunState): Runtime {
  let rt = RT.get(s);
  if (!rt) {
    rt = { pending: null, lastHp: s.player.hp, wrapped: false };
    RT.set(s, rt);
  }
  return rt;
}

/** The stamps on the player now (the Karta osobowa prints them). Empty when none. */
export function activeBuffs(s: RunState): readonly ActiveBuff[] {
  return s.buffs ?? [];
}

/** The i18n keys of a seal's name, effect line and stamp. */
export const sealKeys = (id: SealId): { name: string; desc: string; stamp: string } => ({
  name: `world.seal.${id}.name`,
  desc: `world.seal.${id}.desc`,
  stamp: `world.seal.${id}.stamp`,
});

/** The content of the page the player stands on. */
export const contentOf = (s: RunState): PageContent[] => s.page.content ?? [];

// ---------- the buffs' numbers ----------

export interface BuffEffects {
  speedMul: number;
  crit: number;
  meterBonus: number;
  lootTier: number;
  regen: number;
}

/** What a set of stamps does together; neutral values for none. Pure. */
export function effectsOf(buffs: readonly ActiveBuff[]): BuffEffects {
  const fx: BuffEffects = { speedMul: 1, crit: 0, meterBonus: 0, lootTier: 0, regen: 0 };
  for (const b of buffs) {
    const d = SEALS[b.id];
    fx.speedMul *= d.speedMul ?? 1;
    fx.crit += d.crit ?? 0;
    fx.meterBonus += d.meterBonus ?? 0;
    fx.lootTier += d.lootTier ?? 0;
      fx.regen += d.regen ?? 0;
  }
  return fx;
}

const NOOP = (): void => undefined;

/**
 * Lay the buffs on the player and the clause for one step; returns the function that takes them off. Call it outside
 * `lawPre` and undo it after `undoLaw`. Costs nothing when no seal is stamped.
 */
export function contentPre(s: RunState): () => void {
  const buffs = s.buffs;
  if (!buffs || buffs.length === 0) return NOOP;
  const rt = rtOf(s);
  const fx = effectsOf(buffs);
  const p = s.player;
  const stats = p.stats;
  const speed0 = p.speed;
  const crit0 = stats.critChance;
  const meter0 = p.meter;
  const law = s.law;
  p.speed = speed0 * fx.speedMul;
  stats.critChance = crit0 + fx.crit;
  law.lootTierBonus += fx.lootTier;
  rt.wrapped = true;
  return () => {
    rt.wrapped = false;
    if (p.speed === speed0 * fx.speedMul) p.speed = speed0;
    if (p.stats === stats && stats.critChance === crit0 + fx.crit) stats.critChance = crit0;
    law.lootTierBonus -= fx.lootTier;
    if (fx.meterBonus > 0 && p.meter > meter0) meterGain(s, (p.meter - meter0) * fx.meterBonus);
  };
}

/** Put a seal's stamp on the player (a stamp already there is renewed). Emits the stamp, the note and `content:sealed`. */
export function grantSeal(s: RunState, bus: Bus, id: SealId, at?: { x: number; y: number }): ActiveBuff {
  const buffs = (s.buffs ??= []);
  const def = SEALS[id];
  let buff = buffs.find((b) => b.id === id);
  if (buff) {
    buff.remaining = def.seconds;
    buff.total = def.seconds;
  } else {
    buff = { id, remaining: def.seconds, total: def.seconds };
    buffs.push(buff);
  }
  const p = s.player;
  const x = at?.x ?? p.x;
  const y = at?.y ?? p.y;
  bus.emit('content:sealed', { seal: id, x, y });
  bus.emit('stamp', { text: t(sealKeys(id).stamp), x: p.x, y: p.y - 90, away: { x: p.x, y: p.y } });
  bus.emit('footnote', { text: t('world.seal.taken', { name: t(sealKeys(id).name), seconds: def.seconds }) });
  return buff;
}

// ---------- rewards ----------

/** Tier weights of a folder: between a common drop and an elite one; never a unique. */
export const TECZKA_WEIGHTS: TierWeights = [56, 33, 11, 0];
/** Chance of a gwiazdki pile and of a potwierdzenie in a folder. */
export const TECZKA_STAR_CHANCE = 0.7;
export const TECZKA_SLIP_CHANCE = 0.2;

const priorityOf = (s: RunState) => s.plan?.priority ?? 'normalny';

function around(s: RunState, x: number, y: number, min = 34, max = 58): { x: number; y: number } {
  const rng = s.rngs.loot;
  const a = rng.range(0, Math.PI * 2);
  const d = rng.range(min, max);
  return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
}

function payStars(s: RunState, x: number, y: number, base: number): number {
  const n = Math.max(1, Math.round(base * PRIORITY_STAR_MUL[priorityOf(s)]));
  const at = around(s, x, y);
  s.pickups.push(createPickup(nextId(s), at.x, at.y, 0, undefined, n));
  return n;
}

function paySlip(s: RunState, x: number, y: number): void {
  const at = around(s, x, y);
  s.pickups.push(createPotwierdzeniePickup(nextId(s), at.x, at.y));
}

/** What a folder holds: one item of the page's level, often a pile of gwiazdki, sometimes a slip. Returns the counts. */
export function teczkaLoot(s: RunState, z: Teczka): { items: number; gwiazdki: number; slips: number } {
  const rng = s.rngs.loot;
  const rt = rtOf(s);
  // inside a step the buffs are already on the clause; outside it (a test, a hook) they are added here
  const extra = rt.wrapped ? 0 : effectsOf(activeBuffs(s)).lootTier;
  const tier = rollDropTier(rng, TECZKA_WEIGHTS, priorityOf(s), s.law.lootTierBonus + extra);
  const item = rollItem(rng, { level: dropLevel(s), source: 'common', tier });
  const at = around(s, z.x, z.y);
  item.number = s.nextItemNumber++;
  s.pickups.push(createPickup(nextId(s), at.x, at.y, item.number, item));
  let gwiazdki = 0;
  if (rng.chance(TECZKA_STAR_CHANCE)) gwiazdki = payStars(s, z.x, z.y, rng.int(2, 6));
  let slips = 0;
  if (rng.chance(TECZKA_SLIP_CHANCE)) {
    paySlip(s, z.x, z.y);
    slips = 1;
  }
  return { items: 1, gwiazdki, slips };
}

/** Open a folder: it is emptied onto the paper. False when it was open already. */
export function openTeczka(s: RunState, bus: Bus, z: Teczka): boolean {
  if (z.opened) return false;
  z.opened = true;
  const rt = rtOf(s);
  if (rt.pending === z.id) rt.pending = null;
  teczkaLoot(s, z);
  bus.emit('content:opened', { kind: 'teczka', id: z.id, x: z.x, y: z.y });
  bus.emit('content:changed', { id: z.id });
  const variant = (z.seed % 3) + 1;
  bus.emit('footnote', { text: t(`world.teczka.open${variant}`, { n: z.id }) });
  return true;
}

// ---------- events ----------

function finish(s: RunState, bus: Bus, z: Zdarzenie, phase: 'done' | 'failed', note: string): void {
  z.phase = phase;
  const p = s.player;
  bus.emit('content:event', { event: z.event, id: z.id, phase, x: z.x, y: z.y });
  bus.emit('content:changed', { id: z.id });
  bus.emit('stamp', { text: t(`world.event.${z.event}.${phase}.stamp`), x: p.x, y: p.y - 90, away: { x: p.x, y: p.y } });
  bus.emit('footnote', { text: note });
}

function begin(bus: Bus, z: Zdarzenie): void {
  z.phase = 'active';
  bus.emit('content:event', { event: z.event, id: z.id, phase: 'active', x: z.x, y: z.y });
  bus.emit('content:changed', { id: z.id });
}

/** Enemies sent while a form is filled: 3 on the early pages, up to 5. */
export const formularzEnemies = (pageIndex: number): number => Math.min(5, 3 + Math.floor(pageIndex / 2));

function tickFormularz(s: RunState, bus: Bus, z: Zdarzenie, dt: number): void {
  const p = s.player;
  const near = dist(p, z) <= CONTENT.formR;
  if (z.phase === 'idle') {
    if (!near || p.suspended) return;
    begin(bus, z);
    // they come from the side of the page's middle, so that none is placed on the player who stands at the form
    const dx = s.page.w / 2 - z.x;
    const dy = s.page.h / 2 - z.y;
    const len = Math.hypot(dx, dy) || 1;
    const from = { x: z.x + (dx / len) * 240, y: z.y + (dy / len) * 240 };
    spawnWave(s, s.ticket.family, formularzEnemies(s.pageIndex), from, { minRadius: 40, maxRadius: 200, minPlayer: 150 });
    bus.emit('footnote', { text: t('world.event.formularz.start', { seconds: CONTENT.formNeed }) });
    return;
  }
  if (z.phase !== 'active' || !near) return;
  const before = Math.floor(z.progress);
  z.progress = Math.min(CONTENT.formNeed, z.progress + dt);
  if (Math.floor(z.progress) !== before) bus.emit('content:changed', { id: z.id });
  if (z.progress >= CONTENT.formNeed) {
    payStars(s, z.x, z.y, 12);
    dropGuaranteed(s, z.x, z.y, 'nietypowy');
    finish(s, bus, z, 'done', t('world.event.formularz.done.note'));
  }
}

function tickPrzesylka(s: RunState, bus: Bus, z: Zdarzenie, dt: number): void {
  const p = s.player;
  if (z.phase === 'idle') {
    if (dist(p, z) > CONTENT.parcelPick || p.suspended) return;
    z.progress = CONTENT.parcelSeconds;
    begin(bus, z);
    bus.emit('footnote', { text: t('world.event.przesylka.start', { seconds: CONTENT.parcelSeconds }) });
    return;
  }
  if (z.phase !== 'active' || !z.to) return;
  z.progress -= dt;
  if (dist(p, z.to) <= CONTENT.addresseeR) {
    payStars(s, z.to.x, z.to.y, 16);
    dropGuaranteed(s, z.to.x, z.to.y, 'nietypowy');
    finish(s, bus, z, 'done', t('world.event.przesylka.done.note'));
  } else if (z.progress <= 0) {
    finish(s, bus, z, 'failed', t('world.event.przesylka.failed.note'));
  }
}

/** The fee an audit that failed takes: up to 5 gwiazdki, never more than the purse holds. */
export const AUDIT_FEE = 5;

function tickAudyt(s: RunState, bus: Bus, z: Zdarzenie, dt: number): void {
  const p = s.player;
  const rt = rtOf(s);
  if (z.phase === 'idle') {
    if (dist(p, z) > CONTENT.auditStart || p.suspended) return;
    begin(bus, z);
    bus.emit('footnote', { text: t('world.event.audyt.start', { seconds: CONTENT.auditSeconds }) });
    return;
  }
  if (z.phase !== 'active') return;
  z.progress += dt;
  if (p.hp < rt.lastHp - 1e-6 || dist(p, z) > CONTENT.auditR) {
    const fee = Math.min(AUDIT_FEE, Math.max(0, Math.floor(p.gwiazdki)));
    p.gwiazdki -= fee;
    finish(s, bus, z, 'failed', t('world.event.audyt.failed.note', { count: fee }));
  } else if (z.progress >= CONTENT.auditSeconds) {
    payStars(s, z.x, z.y, 14);
    paySlip(s, z.x, z.y);
    finish(s, bus, z, 'done', t('world.event.audyt.done.note'));
  }
}

const EVENT_TICK: Record<EventId, (s: RunState, bus: Bus, z: Zdarzenie, dt: number) => void> = {
  formularz: tickFormularz,
  przesylka: tickPrzesylka,
  audyt: tickAudyt,
};

// ---------- the step ----------

/** The nearest unopened folder within the tap distance, if any. */
export function teczkaAt(s: RunState, x: number, y: number): Teczka | null {
  let best: Teczka | null = null;
  for (const c of contentOf(s)) {
    if (c.kind !== 'teczka' || c.opened) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d <= CONTENT.teczkaTap && (!best || d < Math.hypot(best.x - x, best.y - y))) best = c;
  }
  return best;
}

/** A tap at world (x, y): a folder there is chosen (the player is already walking to the tap), any other tap forgets the choice. */
export function tapContent(s: RunState, x: number, y: number): boolean {
  if (s.phase !== 'run') return false;
  const z = teczkaAt(s, x, y);
  rtOf(s).pending = z ? z.id : null;
  return z !== null;
}

/**
 * Listen for taps and for changes to redraw. Returns the unbind function. main.ts binds it once at boot; bind it once
 * per bus (a second binding would handle every tap twice).
 */
export function bindContent(bus: Bus, getState: () => RunState | null): () => void {
  const offs = [
    bus.on('player:tap', (e) => {
      const s = getState();
      if (s) tapContent(s, e.x, e.y);
    }),
    bus.on('content:changed', (e) => {
      const s = getState();
      const item = s ? contentOf(s).find((c) => c.id === e.id) : undefined;
      if (item) redrawContent(item);
    }),
  ];
  return () => offs.forEach((f) => f());
}

/** Per step in the run: tick the stamps and the racja regeneration of the seals, and the page's objects. */
export function tickContent(s: RunState, bus: Bus, dt: number): void {
  if (s.phase !== 'run') return;
  const p = s.player;
  const rt = rtOf(s);

  const buffs = s.buffs;
  if (buffs && buffs.length > 0) {
    const fx = effectsOf(buffs);
    if (fx.regen > 0 && p.hp > 0 && p.hp < p.hpMax) p.hp = Math.min(p.hpMax, p.hp + p.hpMax * fx.regen * dt);
    for (let i = buffs.length - 1; i >= 0; i--) {
      const b = buffs[i];
      if (!b) continue;
      b.remaining -= dt;
      if (b.remaining <= 0) {
        buffs.splice(i, 1);
        bus.emit('margin:note', { text: t('world.seal.expired', { name: t(sealKeys(b.id).name) }), x: p.x, y: p.y - p.r - 36 });
      }
    }
  }

  const steering = p.steer !== undefined && p.steer.mag > 0;
  for (const c of contentOf(s)) {
    if (c.kind === 'teczka') {
      if (c.opened) continue;
      const d = dist(p, c);
      if ((rt.pending === c.id && d <= CONTENT.teczkaReach) || (steering && d <= CONTENT.teczkaSteerReach)) openTeczka(s, bus, c);
    } else if (c.kind === 'pieczec') {
      if (c.used || p.suspended || dist(p, c) > CONTENT.pieczecReach + p.r) continue;
      c.used = true;
      grantSeal(s, bus, c.seal, c);
      bus.emit('content:changed', { id: c.id });
    } else if (c.phase !== 'done' && c.phase !== 'failed') {
      EVENT_TICK[c.event](s, bus, c, dt);
    }
  }
  rt.lastHp = p.hp;
}

// ---------- test hook (window.__game.content) ----------

export interface ContentHook {
  /** Plain data about the objects of the page the player is on. */
  list(): { id: number; kind: string; x: number; y: number; state: string; seal: string | null; event: string | null; progress: number }[];
  /** Lay an object `dist` units (default 130) to the right of the player and `dy` below, and draw it; returns its id. A seal takes `seal`. */
  put(kind: 'teczka' | 'pieczec' | EventId, opts?: { seal?: SealId; dist?: number; dy?: number }): number | null;
  /** Tap the folder `id`, as the finger would (the player walks there; it opens on arrival). */
  tap(id: number): boolean;
  /** Open the folder `id` now. */
  open(id: number): boolean;
  /** Stamp a seal on the player now. */
  seal(id: SealId): void;
  /** The stamps on the player: id, seconds left, total. */
  buffs(): { id: string; remaining: number; total: number }[];
}

export function createContentHook(getState: () => RunState | null, bus: Bus): ContentHook {
  const live = (): RunState | null => {
    const s = getState();
    return s && s.phase === 'run' ? s : null;
  };
  return {
    list: () =>
      (live() ? contentOf(live() as RunState) : []).map((c) => ({
        id: c.id,
        kind: c.kind,
        x: c.x,
        y: c.y,
        state: c.kind === 'teczka' ? (c.opened ? 'opened' : 'closed') : c.kind === 'pieczec' ? (c.used ? 'used' : 'ready') : c.phase,
        seal: c.kind === 'pieczec' ? c.seal : null,
        event: c.kind === 'zdarzenie' ? c.event : null,
        progress: c.kind === 'zdarzenie' ? c.progress : 0,
      })),
    put(kind, opts = {}) {
      const s = live();
      if (!s) return null;
      const list = (s.page.content ??= []);
      const id = s.pageIndex * 100 + 50 + list.length;
      const x = s.player.x + (opts.dist ?? 130);
      const y = s.player.y + (opts.dy ?? 0);
      const seed = 1000 + id;
      let item: PageContent;
      if (kind === 'teczka') item = { kind, id, x, y, seed, opened: false };
      else if (kind === 'pieczec') item = { kind, id, x, y, seed, seal: opts.seal ?? 'pilnosc', used: false };
      else {
        item = { kind: 'zdarzenie', id, x, y, seed, event: kind, phase: 'idle', progress: 0 };
        if (kind === 'przesylka') item.to = { x: Math.max(200, x - 600), y: Math.max(200, y - 300) };
      }
      list.push(item);
      bus.emit('content:changed', { id });
      return id;
    },
    tap(id) {
      const s = live();
      const c = s ? contentOf(s).find((k) => k.id === id) : undefined;
      if (!s || !c) return false;
      s.player.target = { x: c.x, y: c.y };
      bus.emit('player:tap', { x: c.x, y: c.y });
      return true;
    },
    open(id) {
      const s = live();
      const c = s ? contentOf(s).find((k) => k.id === id) : undefined;
      return s && c && c.kind === 'teczka' ? openTeczka(s, bus, c) : false;
    },
    seal(id) {
      const s = live();
      if (s) grantSeal(s, bus, id);
    },
    buffs: () => {
      const s = live();
      return s ? activeBuffs(s).map((b) => ({ id: b.id, remaining: b.remaining, total: b.total })) : [];
    },
  };
}
