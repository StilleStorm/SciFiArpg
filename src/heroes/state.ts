/** Per-run hero state (cooldowns, upgrades, ring buffer) and the hero-to-player setup. Plain data. */
import type { DamageType, Stats } from '../combat/damage';
import type { Item } from '../items';
import { recomputeStats } from '../items/stats';
import type { Player } from '../entities/types';
import type { Aim } from './aim';
import type { ParagraphNo, ParagraphPatch } from './paragraphs';
import { heroDef, type HeroDef, type SkillIndex } from './defs';
import type { HeroId } from './index';

/** Multipliers and additions that passives and ranks feed into the skills. 1 = neutral for multipliers. */
export interface Mods {
  /** Skill damage multiplier. */
  dmg: number;
  /** Cooldown multiplier (smaller is faster). */
  cooldown: number;
  /** Move speed multiplier. */
  speed: number;
  /** Area and range multiplier. */
  area: number;
  /** Duration multiplier (shield, summons, statuses). */
  duration: number;
  /** Racja per second. */
  regen: number;
  /** Racja per kill. */
  lifeOnKill: number;
  /** Extra shield racja. */
  shield: number;
  /** Extra simultaneous summons. */
  summonMax: number;
  /** Added crit chance (0..1). */
  crit: number;
  /** Reputacja multiplier. */
  xp: number;
  /** Extra gwiazdki per kill. */
  gwiazdki: number;
}

export const neutralMods = (): Mods => ({
  dmg: 1,
  cooldown: 1,
  speed: 1,
  area: 1,
  duration: 1,
  regen: 0,
  lifeOnKill: 0,
  shield: 0,
  summonMax: 0,
  crit: 0,
  xp: 1,
  gwiazdki: 0,
});

/** Permanent stat upgrades taken from updates; B2's equipment code should add these when it recomputes stats. */
export interface HeroBonus {
  racja: number;
  pewnoscSiebie: number;
  upor: number;
  resist: Partial<Record<DamageType, number>>;
  trialSpeed: number;
}

export const emptyBonus = (): HeroBonus => ({ racja: 0, pewnoscSiebie: 0, upor: 0, resist: {}, trialSpeed: 0 });

export interface RingSample {
  t: number;
  x: number;
  y: number;
  hp: number;
}

export interface Dash {
  dx: number;
  dy: number;
  /** Seconds left. */
  left: number;
  speed: number;
  drag: number | null;
  rank: number;
}

/** Nalesnik's Orbita: the roll along a line (the player is moved by heroes/system.ts). */
export interface Roll {
  dx: number;
  dy: number;
  /** Seconds left. */
  left: number;
  speed: number;
  /** Ids of the enemies already struck by this roll. */
  hit: number[];
  rank: number;
}

/** The enemy that circles Nalesnik after an Orbita: it eases onto the circle, then goes round at a fixed rate. */
export interface Orbit {
  id: number;
  angle: number;
  /** Distance when it was caught, and seconds since. */
  r0: number;
  age: number;
  /** Seconds left. */
  left: number;
}

/** Nalesnik's Grawitacja: everything within reach falls toward him while `left` lasts. */
export interface Gravity {
  left: number;
  radius: number;
  /** Ids of the enemies that reached the rim (each takes the rim damage once). */
  rim: number[];
}

/** Pralka's Wniosek o osobowosc: she reads aloud until `until`; `acc` gathers seconds towards the next tick of damage; `upor` is what she added. */
export interface Reading {
  until: number;
  acc: number;
  upor: number;
}

/** Konsultant's Numer sprawy: the case number stamped on enemy `id` until `until`; where it was last seen, for the handover. */
export interface CaseNumber {
  id: number;
  until: number;
  handovers: number;
  number: number;
  x: number;
  y: number;
}

/** Kartograf's Skala 1:1: the auto range was `from` and is `to` while it lasts. */
export interface FullScale {
  until: number;
  from: number;
  to: number;
}

/** Nalesnik's Plywy: the tide ring runs out; the ids of the enemies it has struck. */
export interface Tide {
  age: number;
  radius: number;
  max: number;
  hit: number[];
}

/** What a pad last cast, for Petlowiec's Juz to bylo: the skill and the aim as it was resolved (a concrete direction or point). */
export interface LastCast {
  skill: SkillIndex;
  aim: Aim;
}

export interface Redirect {
  id: number;
  until: number;
  next: number;
}

/** A hit that lands at `at` (run seconds) on whoever is within `r` of (x, y). */
export interface DeferredHit {
  at: number;
  x: number;
  y: number;
  r: number;
  type: DamageType;
  mult: number;
}

/** What the player was, frozen at death, to be left behind as a copy (outcome Petla). */
export interface CopySpec {
  heroId: HeroId;
  level: number;
  x: number;
  y: number;
  stats: Stats;
  damageType: DamageType;
  hpMax: number;
  speed: number;
  r: number;
  attackRange: number;
  attackCooldown: number;
  drop: Item | null;
}

export interface OfferEntry {
  id: string;
  /** The rank this entry would install (1..3), 1 for passives and stats. */
  rank: number;
  locked: boolean;
}

export interface UpdateOffer {
  entries: OfferEntry[];
  /** Level the offer was rolled for. */
  level: number;
}

export interface HeroRun {
  heroId: HeroId;
  /** Seconds left per skill (keyed by SkillIndex, not by pad), and the length of the cooldown just started. */
  cd: [number, number, number, number, number];
  cdTotal: [number, number, number, number, number];
  /** Skill ranks 0..3 (from updates); skills 3 and 4 are installed once their rank is above 0. */
  ranks: [number, number, number, number, number];
  /** Which skill each of the three pads fires (DESIGN 10.1; heroes/loadout.ts keeps them three different installed skills). */
  pads: [SkillIndex, SkillIndex, SkillIndex];
  /** Every taken update entry id -> rank. */
  upgrades: Record<string, number>;
  mods: Mods;
  bonus: HeroBonus;
  /** The last ~3 seconds of position and racja, for the skill Petla. */
  ring: RingSample[];
  ringTimer: number;
  /** Hits taken by the player (Pralka quirk: every 10th fires a skill). */
  hitsTaken: number;
  shieldUntil: number;
  buffUntil: number;
  /** Crit chance currently added by the Konsultant buff (removed when it ends). */
  buffCrit: number;
  dash: Dash | null;
  redirects: Redirect[];
  /** Nalesnik: the roll (Orbita), the satellite it caught, the pull (Grawitacja). */
  roll: Roll | null;
  orbit: Orbit | null;
  gravity: Gravity | null;
  /** The fourth and fifth skills (DESIGN 10.1): Pralka reads her application, Konsultant's case number, Kartograf's full scale, Nalesnik's tide and the upor of his moon. */
  reading: Reading | null;
  numer: CaseNumber | null;
  scale: FullScale | null;
  tide: Tide | null;
  moonUpor: number;
  /** Petlowiec: the last skill cast by a pad (not Juz to bylo, not a free cast) with its aim. */
  lastCast: LastCast | null;
  /** First-cast footnotes already printed, one bit per SkillIndex. */
  noted: number;
  /** Nalesnik's quirk: run time until which it is rounded, and from which it may round up again; upor added meanwhile. */
  roundUntil: number;
  roundReadyAt: number;
  roundUpor: number;
  /** Update form state. */
  rerollUsed: boolean;
  offer: UpdateOffer | null;
  pendingLevels: number;
  /** Seconds with no enemy near; the queued update opens at progression/queue.ts CALM_SECONDS. */
  calm: number;
  /** The player tapped the HUD or the page turned: open the queued update as soon as it may. */
  updateRequested: boolean;
  /** Death state. */
  deaths: number;
  /** Active paragraph per skill (by SkillIndex) and its patch; both absent while every skill is on paragraph 1 (heroes/paragraphs.ts). */
  para?: ParagraphNo[];
  patch?: (ParagraphPatch | undefined)[];
  /** Damage queued to land later (primitives/effects.ts deferredDamage, echo); absent until a skill queues one. */
  deferred?: DeferredHit[];
  /** Friendly copies that become hostile when their time is up (Petlowiec quirk). */
  ghosts: { id: number; copy: CopySpec }[];
  /** What a killed copy drops: enemy id -> item. */
  copyDrops: { enemyId: number; item: Item }[];
  /** Pickup ids that are appeal forms. */
  appeals: number[];
  /** Pickup id that carries the appeal after the next elite, if suspended and not yet dropped. */
  appealOwed: boolean;
  /** Kill count when the suspension began (fallback when enemy:died carries no tier). */
  suspendedAtKills: number;
  /** Run time of the last "wyciszony" margin note (so a mashed pad does not stack them). */
  silenceNoteAt: number;
}

export function createHeroRun(heroId: HeroId): HeroRun {
  return {
    heroId,
    cd: [0, 0, 0, 0, 0],
    cdTotal: [1, 1, 1, 1, 1],
    ranks: [0, 0, 0, 0, 0],
    pads: [0, 1, 2],
    upgrades: {},
    mods: neutralMods(),
    bonus: emptyBonus(),
    ring: [],
    ringTimer: 0,
    hitsTaken: 0,
    shieldUntil: 0,
    buffUntil: 0,
    buffCrit: 0,
    dash: null,
    redirects: [],
    roll: null,
    orbit: null,
    gravity: null,
    reading: null,
    numer: null,
    scale: null,
    tide: null,
    moonUpor: 0,
    lastCast: null,
    noted: 0,
    roundUntil: 0,
    roundReadyAt: 0,
    roundUpor: 0,
    rerollUsed: false,
    offer: null,
    pendingLevels: 0,
    calm: 0,
    updateRequested: false,
    deaths: 0,
    ghosts: [],
    copyDrops: [],
    appeals: [],
    appealOwed: false,
    suspendedAtKills: 0,
    silenceNoteAt: -99,
  };
}

/** Make the player this hero: base stats (gear is added by items/stats.ts), speed, quirk flags. */
export function applyHero(p: Player, def: HeroDef): void {
  p.heroId = def.id;
  p.speed = def.speed;
  p.r = def.r;
  p.baseStats = {
    hpMax: def.racja,
    stats: { ...def.baseStats, resist: { ...def.baseStats.resist } },
    damageType: def.auto.type,
    attackRange: def.auto.range,
    attackCooldown: def.auto.cooldown,
  };
  recomputeStats(p);
  p.hp = p.hpMax;
  p.attackTimer = 0;
  p.trialSpeed = def.traits?.trialSpeed ?? 1;
  p.seesDefects = def.traits?.seesDefects === true;
  p.revealsPage = def.traits?.revealsPage === true;
  if (def.traits?.skim) p.skim = true;
  else delete p.skim;
}

export function heroOf(p: Pick<Player, 'heroId'>): HeroDef {
  return heroDef(p.heroId);
}

/** Seconds of history the ring buffer keeps, and how often it samples. */
export const RING_SECONDS = 3.2;
export const RING_STEP = 0.1;

/** Append a sample and drop the ones older than RING_SECONDS. */
export function pushRing(ring: RingSample[], sample: RingSample, keep: number = RING_SECONDS): void {
  ring.push(sample);
  while (ring.length > 1 && sample.t - (ring[0]?.t ?? sample.t) > keep) ring.shift();
}

/** The sample closest to `seconds` ago (the oldest one if the history is shorter than that). */
export function ringBack(ring: readonly RingSample[], now: number, seconds: number): RingSample | null {
  if (ring.length === 0) return null;
  const want = now - seconds;
  let best = ring[0] ?? null;
  for (const s of ring) {
    if (!best || Math.abs(s.t - want) < Math.abs(best.t - want)) best = s;
  }
  return best;
}
