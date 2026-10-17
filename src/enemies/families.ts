/**
 * Family data: stats per tier, the resist/weakness table, claims, factory defects, elite affixes,
 * and the mission mix. Numbers live here so balance is one file. Text is always an i18n key.
 */
import type { Claim } from '../combat/claims';
import type { DamageType } from '../combat/damage';
import type { Rng } from '../core/rng';
import { genderForm, t, type Gender } from '../i18n';
import { FAMILY_IDS, type DefectId, type EliteId, type FamilyId } from './ids';

export * from './ids';

export interface TierStats {
  hp: number;
  speed: number;
  dmgMin: number;
  dmgMax: number;
  /** Attack rating (pewnosc siebie). */
  pewnoscSiebie: number;
  /** Defense rating (upor). */
  upor: number;
  critChance: number;
  /** Melee reach beyond the collision radii. */
  attackRange: number;
  attackCooldown: number;
  /** Distance at which it notices the player. */
  aggro: number;
}

export interface FamilyDef {
  id: FamilyId;
  /** i18n key of the family name. */
  nameKey: string;
  /** i18n key of the footnote shown on first meeting. */
  meetKey: string;
  /** What its attacks deal. */
  damageType: DamageType;
  /** Percent, negative = weakness (DESIGN 6). */
  resist: Partial<Record<DamageType, number>>;
  /** The type it is weak to (the clean play). */
  weakTo: DamageType;
  /** Stats by tier index (tier - 1); tiers beyond the table scale the last one. */
  tiers: readonly TierStats[];
}

const T = (hp: number, speed: number, dmgMin: number, dmgMax: number, pew: number, upor: number, crit: number, range: number, cd: number, aggro: number): TierStats => ({
  hp,
  speed,
  dmgMin,
  dmgMax,
  pewnoscSiebie: pew,
  upor,
  critChance: crit,
  attackRange: range,
  attackCooldown: cd,
  aggro,
});

export const FAMILY_DEFS: Record<FamilyId, FamilyDef> = {
  urzadzenia: {
    id: 'urzadzenia',
    nameKey: 'enemies.family.urzadzenia.name',
    meetKey: 'enemies.family.urzadzenia.meet',
    damageType: 'mechaniczny',
    resist: { regulaminowy: 50, egzystencjalny: -40 },
    weakTo: 'egzystencjalny',
    tiers: [T(36, 58, 3, 5, 62, 38, 0.05, 30, 1.3, 230)],
  },
  powiadomienia: {
    id: 'powiadomienia',
    nameKey: 'enemies.family.powiadomienia.name',
    meetKey: 'enemies.family.powiadomienia.meet',
    damageType: 'regulaminowy',
    resist: { mechaniczny: 50, regulaminowy: -40 },
    weakTo: 'regulaminowy',
    tiers: [
      T(14, 92, 1, 3, 50, 18, 0.04, 24, 1.1, 260),
      T(22, 100, 2, 4, 58, 22, 0.05, 26, 1.0, 270),
      T(32, 108, 3, 5, 66, 26, 0.06, 28, 0.95, 280),
      T(46, 116, 4, 7, 76, 30, 0.08, 30, 0.9, 290),
    ],
  },
  wygenerowane: {
    id: 'wygenerowane',
    nameKey: 'enemies.family.wygenerowane.name',
    meetKey: 'enemies.family.wygenerowane.meet',
    damageType: 'egzystencjalny',
    resist: { egzystencjalny: 50, mechaniczny: -40 },
    weakTo: 'mechaniczny',
    tiers: [T(32, 74, 3, 5, 66, 28, 0.08, 28, 1.2, 250)],
  },
};

/** Stats of a family at a tier. Urzadzenia and Wygenerowane scale with tier ("revision"), Powiadomienia use their table. */
export function tierStats(family: FamilyId, tier: number): TierStats {
  const def = FAMILY_DEFS[family];
  const i = Math.max(1, Math.round(tier)) - 1;
  const fixed = def.tiers[i];
  if (fixed) return fixed;
  const base = def.tiers[def.tiers.length - 1] ?? T(20, 60, 2, 4, 60, 30, 0.05, 28, 1.2, 240);
  const extra = i - (def.tiers.length - 1);
  const hp = 1 + 0.45 * extra;
  const dmg = 1 + 0.3 * extra;
  return { ...base, hp: Math.round(base.hp * hp), dmgMin: Math.round(base.dmgMin * dmg), dmgMax: Math.round(base.dmgMax * dmg), pewnoscSiebie: base.pewnoscSiebie + 6 * extra, upor: base.upor + 4 * extra };
}

// ---------- claims ----------

export interface ClaimDef {
  key: string;
  type: DamageType;
}
const C = (family: string, id: string, type: DamageType): ClaimDef => ({ key: `enemies.claim.${family}.${id}`, type });

export const CLAIMS: Record<FamilyId, readonly ClaimDef[]> = {
  urzadzenia: [
    C('urzadzenia', 'update', 'mechaniczny'),
    C('urzadzenia', 'offline', 'egzystencjalny'),
    C('urzadzenia', 'newVersion', 'regulaminowy'),
    C('urzadzenia', 'warranty', 'regulaminowy'),
    C('urzadzenia', 'unauthorized', 'mechaniczny'),
    C('urzadzenia', 'faultless', 'egzystencjalny'),
  ],
  // claims are the tier names (index = tier - 1)
  powiadomienia: [
    C('powiadomienia', 'reminder', 'regulaminowy'),
    C('powiadomienia', 'lastChance', 'regulaminowy'),
    C('powiadomienia', 'cart', 'regulaminowy'),
    C('powiadomienia', 'deleted', 'egzystencjalny'),
  ],
  wygenerowane: [
    C('wygenerowane', 'users', 'egzystencjalny'),
    C('wygenerowane', 'community', 'regulaminowy'),
    C('wygenerowane', 'resolution', 'mechaniczny'),
    C('wygenerowane', 'anatomy', 'mechaniczny'),
    C('wygenerowane', 'unknown', 'egzystencjalny'),
    C('wygenerowane', 'likes', 'regulaminowy'),
  ],
};

/** A claim for a new enemy; `avoid` is the key to skip (elite rotation). */
export function pickClaim(rng: Rng, family: FamilyId, tier: number, avoid?: string): Claim {
  const list = CLAIMS[family];
  if (family === 'powiadomienia') {
    const d = list[Math.min(list.length, Math.max(1, Math.round(tier))) - 1] ?? C('powiadomienia', 'reminder', 'regulaminowy');
    return { textKey: d.key, type: d.type };
  }
  const pool = list.filter((c) => c.key !== avoid);
  const d = rng.pick(pool.length > 0 ? pool : list);
  return { textKey: d.key, type: d.type };
}

// ---------- defects (Urzadzenia) ----------

export interface DefectDef {
  id: DefectId;
  /** i18n keys of the cause and the effect sentences in the footnote. */
  causeKey: string;
  effectKey: string;
  /** The defect is the weakness: this type gets an extra weakness on that enemy. */
  vuln: DamageType;
}
const D = (id: DefectId, vuln: DamageType): DefectDef => ({ id, causeKey: `enemies.defect.${id}.cause`, effectKey: `enemies.defect.${id}.effect`, vuln });

export const DEFECTS: Record<DefectId, DefectDef> = {
  spins: D('spins', 'mechaniczny'),
  limp: D('limp', 'mechaniczny'),
  thinks: D('thinks', 'egzystencjalny'),
  overheat: D('overheat', 'regulaminowy'),
  firmware: D('firmware', 'regulaminowy'),
  loud: D('loud', 'egzystencjalny'),
  standby: D('standby', 'mechaniczny'),
};
/** Percent of extra weakness the defect adds to its vulnerability. */
export const DEFECT_VULN = 25;

// ---------- elites ----------

export interface EliteDef {
  id: EliteId;
  /** i18n prefix; `<prefix>.m|f|n|pl` are the adjective forms, `<prefix>.effect` the footnote sentence. */
  prefix: string;
}
export const ELITES: Record<EliteId, EliteDef> = {
  zweryfikowany: { id: 'zweryfikowany', prefix: 'enemies.elite.zweryfikowany' },
  sponsorowany: { id: 'sponsorowany', prefix: 'enemies.elite.sponsorowany' },
  nieuchronny: { id: 'nieuchronny', prefix: 'enemies.elite.nieuchronny' },
  domniemany: { id: 'domniemany', prefix: 'enemies.elite.domniemany' },
};
export const ELITE_HP_MUL = 1.6;
export const ELITE_DMG_MUL = 1.25;
export const ELITE_SCALE = 1.15;
export const NIEUCHRONNY_HP_MUL = 1.5;
export const SPONSOR_SPEED_MUL = 1.4;
export const AURA_RADIUS = 150;
export const AURA_DMG_MUL = 1.25;
export const CLAIM_ROTATE_S = 8;
export const ESCALATE_S = 20;

const GENDERS: readonly Gender[] = ['m', 'f', 'n', 'pl'];
/** Grammatical gender of a body's noun (kept in the string table: it is a fact about Polish). */
export function bodyGender(bodyId: string): Gender {
  const g = t(`enemies.body.${bodyId}.gender`);
  return GENDERS.find((x) => x === g) ?? 'm';
}

/** The elite adjective in the gender of the body noun ("zweryfikowana" for a lodowka). */
export function eliteWord(elite: EliteId, bodyId: string): string {
  const p = ELITES[elite].prefix;
  return genderForm({ m: t(`${p}.m`), f: t(`${p}.f`), n: t(`${p}.n`), pl: t(`${p}.pl`) }, bodyGender(bodyId));
}

/** "lodowka, zweryfikowana" */
export function enemyName(bodyId: string, elite?: EliteId): string {
  const noun = t(`enemies.body.${bodyId}.noun`);
  return elite ? `${noun}, ${eliteWord(elite, bodyId)}` : noun;
}

// ---------- mission mix ----------

/** Which families a mission sends. The dominant one gets the biggest weight. */
export interface MissionMix {
  dominant: FamilyId;
  weights: Record<FamilyId, number>;
}

export function makeMix(dominant: FamilyId = 'urzadzenia'): MissionMix {
  const weights = { urzadzenia: 0.2, powiadomienia: 0.2, wygenerowane: 0.2 };
  weights[dominant] = 0.6;
  return { dominant, weights };
}

export function pickFamily(rng: Rng, mix: MissionMix | undefined): FamilyId {
  const m = mix ?? makeMix();
  let total = 0;
  for (const f of FAMILY_IDS) total += m.weights[f];
  let x = rng.next() * total;
  for (const f of FAMILY_IDS) {
    x -= m.weights[f];
    if (x < 0) return f;
  }
  return m.dominant;
}
