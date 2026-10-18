/**
 * AKTUALIZACJA (DESIGN section 8): on level up three "nowosci" are offered from the hero's pool,
 * one may "wymagac uprawnien", one problem report per run rerolls the three.
 */
import { DAMAGE_TYPES, type DamageType } from '../combat/damage';
import { heroDef, type SkillIndex } from '../heroes/defs';
import type { HeroId } from '../heroes';
import { neutralMods, type Mods, type OfferEntry, type UpdateOffer } from '../heroes/state';
import { recomputeStats } from '../items/stats';
import { t } from '../i18n';
import type { Rng } from '../core/rng';
import type { RunState } from '../world/run';

export type Family = 'urzadzenia' | 'powiadomienia' | 'wygenerowane';
export const FAMILIES: readonly Family[] = ['urzadzenia', 'powiadomienia', 'wygenerowane'];

export interface UpgradeDef {
  id: string;
  kind: 'skill' | 'passive' | 'stat';
  /** Skills: the hero's skill index (0..4), not a pad. */
  slot?: SkillIndex;
  /** How many times it can be taken (skills: 3 ranks). */
  maxRank: number;
  /** Permission family needed ("wymaga uprawnien"). */
  requires?: Family;
  /** Additive change to Mods per rank taken (multipliers: 0.1 = +10%, cooldown: -0.08 = 8% faster). */
  mods?: Partial<Mods>;
  /** Which of the hero's numbered passive texts this is. */
  n?: number;
  /** Stat upgrades: resist type. */
  type?: DamageType;
}

const SKILL_FAMILY: readonly Family[] = ['urzadzenia', 'powiadomienia', 'wygenerowane'];

const skillEntries = (): UpgradeDef[] =>
  ([0, 1, 2, 3, 4] as const).map((slot) => ({
    id: `skill${slot + 1}`,
    kind: 'skill' as const,
    slot,
    maxRank: 3,
    // skills 1..3: the third rank is the one that wants a permission; skills 4..5: the first (requirementOf)
  }));

const PASSIVES: Record<HeroId, { mods: Partial<Mods>; requires?: Family }[]> = {
  pralka: [
    { mods: { cooldown: -0.08 } },
    { mods: { shield: 20 } },
    { mods: { dmg: 0.1 } },
    { mods: { regen: 0.6 } },
    { mods: { area: 0.12 } },
    { mods: { duration: 0.25, lifeOnKill: 2 }, requires: 'urzadzenia' },
  ],
  konsultant: [
    { mods: { dmg: 0.1 } },
    { mods: { cooldown: -0.08 } },
    { mods: { crit: 0.05 } },
    { mods: { duration: 0.2 } },
    { mods: { xp: 0.1 } },
    { mods: { dmg: 0.15, area: 0.1 }, requires: 'powiadomienia' },
  ],
  petlowiec: [
    { mods: { duration: 0.2 } },
    { mods: { dmg: 0.1 } },
    { mods: { crit: 0.05 } },
    { mods: { cooldown: -0.08 } },
    { mods: { regen: 0.5 } },
    { mods: { summonMax: 1 }, requires: 'wygenerowane' },
  ],
  kartograf: [
    { mods: { area: 0.12 } },
    { mods: { dmg: 0.1 } },
    { mods: { cooldown: -0.08 } },
    { mods: { speed: 0.1 } },
    { mods: { duration: 0.2 } },
    { mods: { crit: 0.06, dmg: 0.1 }, requires: 'urzadzenia' },
  ],
  nalesnik: [
    { mods: { cooldown: -0.08 } },
    { mods: { dmg: 0.1 } },
    { mods: { area: 0.12 } },
    { mods: { regen: 0.6 } },
    { mods: { duration: 0.2 } },
    { mods: { speed: 0.08, cooldown: -0.05 }, requires: 'powiadomienia' },
  ],
};

const STATS: UpgradeDef[] = [
  { id: 'racja', kind: 'stat', maxRank: 5 },
  { id: 'pewnosc', kind: 'stat', maxRank: 5 },
  { id: 'upor', kind: 'stat', maxRank: 5 },
  ...DAMAGE_TYPES.map((type) => ({ id: `resist_${type}`, kind: 'stat' as const, maxRank: 3, type })),
  { id: 'trial', kind: 'stat', maxRank: 3 },
  { id: 'gwiazdki', kind: 'stat', maxRank: 3, mods: { gwiazdki: 1 } },
];

/** Every entry the hero can ever be offered: 5 skills x 3 ranks, 6 passives, the stat upgrades. */
export function poolFor(heroId: HeroId): UpgradeDef[] {
  const passives = PASSIVES[heroId].map((p, i): UpgradeDef => {
    const def: UpgradeDef = { id: `passive${i + 1}`, kind: 'passive', maxRank: 1, mods: p.mods, n: i + 1 };
    if (p.requires) def.requires = p.requires;
    return def;
  });
  return [...skillEntries(), ...passives, ...STATS];
}

export function upgradeById(heroId: HeroId, id: string): UpgradeDef | undefined {
  return poolFor(heroId).find((u) => u.id === id);
}

const WEIGHT = { skill: 3, passive: 2, stat: 2 } as const;

/** The family a given entry at a given rank needs, if any. Skill rank 3 and each hero's last passive are gated. The 4th and 5th skill's first rank wants the family in its SkillDef (DESIGN 10.1). */
export function requirementOf(def: UpgradeDef, rank: number, heroId?: HeroId): Family | undefined {
  if (def.kind === 'skill') {
    const slot = def.slot ?? 0;
    if (slot >= 3) return rank <= 1 && heroId ? heroDef(heroId).skills[slot].requires : undefined;
    return rank >= 3 ? SKILL_FAMILY[slot] : undefined;
  }
  return def.requires;
}

export function hasPermission(s: RunState, family: Family | undefined): boolean {
  return family === undefined || s.player.permissions.includes(family);
}

function takenRank(s: RunState, id: string): number {
  return s.hero.upgrades[id] ?? 0;
}

/** Entries that can still be taken, each with the rank it would install. */
export function availableEntries(s: RunState): OfferEntry[] {
  const out: OfferEntry[] = [];
  for (const def of poolFor(s.player.heroId)) {
    const rank = takenRank(s, def.id) + 1;
    if (rank > def.maxRank) continue;
    out.push({ id: def.id, rank, locked: !hasPermission(s, requirementOf(def, rank, s.player.heroId)) });
  }
  return out;
}

function weightOf(heroId: HeroId, e: OfferEntry): number {
  const def = upgradeById(heroId, e.id);
  return def ? WEIGHT[def.kind] : 1;
}

function isGated(heroId: HeroId, e: OfferEntry): boolean {
  const def = upgradeById(heroId, e.id);
  return def ? requirementOf(def, e.rank, heroId) !== undefined : false;
}

/** Draw `count` entries, weighted, without repeats, at most one of them gated ("wymaga uprawnien"). */
export function drawEntries(heroId: HeroId, pool: readonly OfferEntry[], rng: Rng, count = 3): OfferEntry[] {
  const left = [...pool];
  const picked: OfferEntry[] = [];
  while (picked.length < count && left.length > 0) {
    const gated = picked.some((e) => isGated(heroId, e));
    const ok = left.filter((e) => !(gated && isGated(heroId, e)));
    if (ok.length === 0) break;
    const total = ok.reduce((a, e) => a + weightOf(heroId, e), 0);
    let roll = rng.range(0, total);
    let chosen = ok[ok.length - 1];
    for (const e of ok) {
      roll -= weightOf(heroId, e);
      if (roll < 0) {
        chosen = e;
        break;
      }
    }
    if (!chosen) break;
    picked.push(chosen);
    left.splice(left.indexOf(chosen), 1);
  }
  return picked;
}

/** Roll an offer for the player's current level. `salt` makes a reroll differ; `avoid` are ids to skip if possible. */
export function rollOffer(s: RunState, salt = 0, avoid: readonly string[] = []): UpdateOffer {
  const all = availableEntries(s);
  const fresh = all.filter((e) => !avoid.includes(e.id));
  const pool = fresh.length >= 3 ? fresh : all;
  const rng = s.rng.fork(`update:${s.player.level}:${salt}`);
  return { entries: drawEntries(s.player.heroId, pool, rng), level: s.player.level };
}

/** Open the form: roll the offer for this level and keep it on the run. */
export function openOffer(s: RunState): UpdateOffer {
  const offer = rollOffer(s, 0);
  s.hero.offer = offer;
  return offer;
}

/** "Zglos problem z aktualizacja": once per run, three new entries. Null if already used. */
export function reroll(s: RunState): UpdateOffer | null {
  if (s.hero.rerollUsed || !s.hero.offer) return null;
  s.hero.rerollUsed = true;
  const offer = rollOffer(s, 1, s.hero.offer.entries.map((e) => e.id));
  s.hero.offer = offer;
  return offer;
}

/** Sum the passives and gwiazdki upgrades into Mods. */
export function modsFromUpgrades(heroId: HeroId, upgrades: Record<string, number>): Mods {
  const mods = neutralMods();
  for (const [id, rank] of Object.entries(upgrades)) {
    const def = upgradeById(heroId, id);
    if (!def?.mods) continue;
    for (const k of Object.keys(def.mods) as (keyof Mods)[]) mods[k] += (def.mods[k] ?? 0) * rank;
  }
  return mods;
}

const STAT_STEP = { racja: 12, pewnosc: 10, upor: 8, resist: 8, trial: 0.5 } as const;

/** Install one upgrade on the run. Returns false if it cannot be taken (maxed or locked). */
export function applyUpgrade(s: RunState, id: string): boolean {
  const p = s.player;
  const def = upgradeById(p.heroId, id);
  if (!def) return false;
  const rank = takenRank(s, id) + 1;
  if (rank > def.maxRank || !hasPermission(s, requirementOf(def, rank, p.heroId))) return false;
  s.hero.upgrades[id] = rank;
  const h = s.hero;
  if (def.kind === 'skill' && def.slot !== undefined) h.ranks[def.slot] = rank;
  if (def.kind === 'stat') {
    const base = p.baseStats;
    if (id === 'racja') {
      base.hpMax += STAT_STEP.racja;
      h.bonus.racja += STAT_STEP.racja;
    } else if (id === 'pewnosc') {
      base.stats.pewnoscSiebie += STAT_STEP.pewnosc;
      h.bonus.pewnoscSiebie += STAT_STEP.pewnosc;
    } else if (id === 'upor') {
      base.stats.upor += STAT_STEP.upor;
      h.bonus.upor += STAT_STEP.upor;
    } else if (def.type) {
      base.stats.resist[def.type] = (base.stats.resist[def.type] ?? 0) + STAT_STEP.resist;
      h.bonus.resist[def.type] = (h.bonus.resist[def.type] ?? 0) + STAT_STEP.resist;
    } else if (id === 'trial') {
      p.trialSpeed += STAT_STEP.trial;
      h.bonus.trialSpeed += STAT_STEP.trial;
    }
  }
  h.mods = modsFromUpgrades(p.heroId, h.upgrades);
  p.speed = heroDef(p.heroId).speed * h.mods.speed;
  recomputeStats(p);
  return true;
}

/** Take entry `id` from the open offer. Locked entries and entries not on the offer are refused. */
export function confirmUpdate(s: RunState, id: string): boolean {
  const offer = s.hero.offer;
  const entry = offer?.entries.find((e) => e.id === id);
  if (!entry) return false;
  if (!applyUpgrade(s, id)) return false;
  s.hero.offer = null;
  return true;
}

/**
 * The skill (3 or 4) that an update just installed: its rank went from 0 to above 0 between the two `ranks` arrays.
 * Null for every other update. The form then asks which pad the new skill goes on (DESIGN 10.1).
 */
export function newSkillOf(before: readonly number[], after: readonly number[]): SkillIndex | null {
  for (const i of [3, 4] as const) if ((before[i] ?? 0) === 0 && (after[i] ?? 0) > 0) return i;
  return null;
}

// ---------- text for the form ----------

export interface EntryView {
  id: string;
  title: string;
  desc: string;
  tag: string;
  locked: boolean;
  /** "Wymaga uprawnien: urzadzenia" for gated entries (shown also when the permission is held). */
  requires: string | null;
}

const ROMAN = ['', 'I', 'II', 'III'] as const;

/** A skill rank in roman numerals; an empty string for rank 0. */
export const roman = (rank: number): string => ROMAN[rank] ?? String(rank);

export function entryView(s: RunState, entry: OfferEntry): EntryView {
  const heroId = s.player.heroId;
  const def = upgradeById(heroId, entry.id);
  const fam = def ? requirementOf(def, entry.rank, heroId) : undefined;
  const requires = fam ? t('forms.update.requires', { family: t(`forms.update.family.${fam}`) }) : null;
  const base = { id: entry.id, locked: !hasPermission(s, fam), requires };
  if (!def) return { ...base, title: entry.id, desc: '', tag: '' };
  if (def.kind === 'skill' && def.slot !== undefined) {
    const sk = heroDef(heroId).skills[def.slot];
    const fresh = def.slot >= 3 && entry.rank <= 1; // a new skill: its own name and description (DESIGN 10.1)
    return {
      ...base,
      title: fresh ? t('forms.update.newSkill', { skill: t(sk.nameKey) }) : t('forms.update.skillRank', { skill: t(sk.nameKey), rank: ROMAN[entry.rank] ?? String(entry.rank) }),
      desc: fresh ? t(sk.descKey) : t('forms.update.skillRankDesc'),
      tag: t('forms.update.tag.skill', { type: t(`heroes.types.${sk.type}`) }),
    };
  }
  if (def.kind === 'passive') {
    return {
      ...base,
      title: t(`forms.update.passive.${heroId}.${def.n ?? 1}.name`),
      desc: t(`forms.update.passive.${heroId}.${def.n ?? 1}.desc`),
      tag: t('forms.update.tag.passive'),
    };
  }
  return {
    ...base,
    title: t(`forms.update.stat.${def.id}.name`),
    desc: t(`forms.update.stat.${def.id}.desc`),
    tag: t('forms.update.tag.stat'),
  };
}
