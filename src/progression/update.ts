/**
 * AKTUALIZACJA (DESIGN section 8): on level up three "nowosci" are offered from the hero's pool,
 * one may "wymagac uprawnien", one problem report per run rerolls the three.
 */
import { DAMAGE_TYPES, type DamageType } from '../combat/damage';
import { heroDef, SKILL_INDICES, type SkillIndex } from '../heroes/defs';
import { isInstalled } from '../heroes/loadout';
import type { HeroId } from '../heroes';
import { heroById } from '../heroes/registry';
import { neutralMods, type Mods, type OfferEntry, type UpdateOffer } from '../heroes/state';
import { recomputeStats } from '../items/stats';
import { t } from '../i18n';
import type { Rng } from '../core/rng';
import type { RunState } from '../world/run';
import { isParagraphUnlocked, paragraphLevel, paragraphsOf, runParagraph, runProgress, setRunParagraph } from './paragraphs';

export type Family = 'urzadzenia' | 'powiadomienia' | 'wygenerowane';
export const FAMILIES: readonly Family[] = ['urzadzenia', 'powiadomienia', 'wygenerowane'];

export interface UpgradeDef {
  id: string;
  kind: 'skill' | 'passive' | 'stat' | 'paragraph';
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
  const passives = heroById(heroId).passives.map((p, i): UpgradeDef => {
    const def: UpgradeDef = { id: `passive${i + 1}`, kind: 'passive', maxRank: 1, mods: p.mods, n: i + 1 };
    if (p.requires) def.requires = p.requires;
    return def;
  });
  return [...skillEntries(), ...passives, ...STATS];
}

/**
 * Offer ids of a paragraph entry: `para:<skill index>:<n>`. They live on the offer only: picking one makes the paragraph the
 * active one (progression/paragraphs.ts setRunParagraph), nothing goes into `upgrades`, and the save keeps it as the active paragraph.
 */
export const paraId = (skill: SkillIndex, n: 2 | 3): string => `para:${skill}:${n}`;

/** Parse `para:<skill>:<n>` (skill 0..4, n 2 or 3); null for every other id. */
export function parseParagraphId(id: string): { skill: SkillIndex; n: 2 | 3 } | null {
  const m = /^para:([0-4]):([23])$/.exec(id);
  return m ? { skill: Number(m[1]) as SkillIndex, n: Number(m[2]) as 2 | 3 } : null;
}

/** Paragraph entries are not in the pool: the offer builds them. */
function paragraphDef(id: string): UpgradeDef | undefined {
  const p = parseParagraphId(id);
  return p ? { id, kind: 'paragraph', slot: p.skill, maxRank: 1 } : undefined;
}

export function upgradeById(heroId: HeroId, id: string): UpgradeDef | undefined {
  return poolFor(heroId).find((u) => u.id === id) ?? paragraphDef(id);
}

const WEIGHT = { skill: 3, passive: 2, stat: 2, paragraph: 3 } as const;

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
export function drawEntries(heroId: HeroId, pool: readonly OfferEntry[], rng: Rng, count = 3, already: readonly OfferEntry[] = []): OfferEntry[] {
  const left = [...pool];
  const picked: OfferEntry[] = [];
  while (picked.length < count && left.length > 0) {
    const gated = picked.some((e) => isGated(heroId, e)) || already.some((e) => isGated(heroId, e));
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

/** The entries a level-up leads with, by priority; `pickFeature` takes the first non-empty list (pure, tested). */
export interface FeatureCandidates {
  /** A skill not installed yet (4th / 5th) whose permission is held (a stamped one stays in the common pool). */
  newSkill: readonly OfferEntry[];
  /** Paragraphs that open at the level the form installs (paragraphEntries). */
  paragraph: readonly OfferEntry[];
}

export function pickFeature(c: FeatureCandidates): OfferEntry | null {
  return c.newSkill[0] ?? c.paragraph[0] ?? null;
}

/** The level a form installs: the oldest queued one (several queued forms open one after another). */
export const offerVersion = (s: RunState): number => s.player.level - Math.max(1, s.hero.pendingLevels) + 1;

/**
 * Paragraphs that open at the level this form installs (DESIGN 10.2: "the newly unlocked paragraph"), open to the character and
 * not already active; skill order. One the player passes over stays switchable in Konfiguracja and is not offered again.
 */
export function paragraphEntries(s: RunState, version = offerVersion(s)): OfferEntry[] {
  const heroId = s.player.heroId;
  const skills = heroDef(heroId).skills;
  const progress = runProgress(s);
  const out: OfferEntry[] = [];
  for (const n of [2, 3] as const) {
    for (const skill of SKILL_INDICES) {
      const id = skills[skill].id;
      if (!isInstalled(s, skill) || paragraphLevel(heroId, id, n) !== version) continue;
      if (isParagraphUnlocked(progress, id, n) && runParagraph(s, skill) !== n) out.push({ id: paraId(skill, n), rank: 1, locked: false });
    }
  }
  return out;
}

function featureOf(s: RunState): OfferEntry | null {
  const all = availableEntries(s);
  const fresh = all.filter((e) => (e.id === 'skill4' || e.id === 'skill5') && e.rank === 1 && !e.locked); // a skill that still wants its permission stays in the common pool
  return pickFeature({ newSkill: fresh, paragraph: paragraphEntries(s) });
}

const isFiller = (heroId: HeroId, e: OfferEntry): boolean => {
  const kind = upgradeById(heroId, e.id)?.kind;
  return kind === 'passive' || kind === 'stat';
};

/**
 * Compose the three choices (pure): the lead entry (the newly unlocked skill or paragraph) when there is one, then
 * two passive/stat entries; a missing lead or a short pool is topped up from whatever else is available.
 */
export function composeOffer(heroId: HeroId, feature: OfferEntry | null, pool: readonly OfferEntry[], rng: Rng, avoid: readonly string[] = []): OfferEntry[] {
  if (!feature) return drawEntries(heroId, pool, rng);
  const lead = [feature];
  const rest = pool.filter((e) => e.id !== feature.id);
  const fillers = rest.filter((e) => isFiller(heroId, e));
  const fresh = fillers.filter((e) => !avoid.includes(e.id));
  const two = drawEntries(heroId, fresh.length >= 2 ? fresh : fillers, rng, 2, feature.locked ? lead : []);
  const out = [...lead, ...two];
  if (out.length < 3) out.push(...drawEntries(heroId, rest.filter((e) => !out.some((o) => o.id === e.id)), rng, 3 - out.length, out));
  return out;
}

/** Roll an offer for the player's current level. `salt` makes a reroll differ; `avoid` are ids to skip if possible. */
export function rollOffer(s: RunState, salt = 0, avoid: readonly string[] = []): UpdateOffer {
  const all = availableEntries(s);
  const rng = s.rng.fork(`update:${s.player.level}:${salt}`);
  const feature = featureOf(s);
  if (feature) return { entries: composeOffer(s.player.heroId, feature, all, rng, avoid), level: s.player.level };
  const fresh = all.filter((e) => !avoid.includes(e.id));
  return { entries: drawEntries(s.player.heroId, fresh.length >= 3 ? fresh : all, rng), level: s.player.level };
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
  const para = parseParagraphId(id);
  if (para) {
    if (!setRunParagraph(s, heroDef(s.player.heroId).skills[para.skill].id, para.n)) return false; // the picked paragraph is the active one
  } else if (!applyUpgrade(s, id)) return false;
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
  if (def.kind === 'paragraph') {
    const p = parseParagraphId(def.id);
    if (!p) return { ...base, title: entry.id, desc: '', tag: '' };
    const sk = heroDef(heroId).skills[p.skill];
    const para = paragraphsOf(heroId, sk.id)[p.n - 1];
    return {
      ...base,
      title: t('forms.update.paragraph.title', { skill: t(sk.nameKey), n: p.n, name: para ? t(para.nameKey) : '' }),
      desc: para ? t(para.descKey) : '',
      tag: t('forms.update.tag.paragraph'),
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
