/** The four heroes (DESIGN section 10): numbers, auto-attack, three typed skills, one quirk. Data only. */
import type { DamageType, Stats } from '../combat/damage';
import type { HeroId } from './index';

/** How a skill is aimed (DESIGN 5.6): by itself, by a direction, or by a point. */
export type AimMode = 'auto' | 'kierunek' | 'wskazanie';

export interface SkillDef {
  /** Key into SKILLS in skills.ts. */
  id: string;
  nameKey: string;
  /** Word on the pad. */
  padKey: string;
  descKey: string;
  type: DamageType;
  /** Seconds. Skills cost nothing else (no mana). */
  cooldown: number;
  /** What a drag on the pad sets (heroes/aim.ts); a tap is always the auto cast. */
  aim: AimMode;
}

export interface HeroDef {
  id: HeroId;
  nameKey: string;
  /** Three sober lines for the profile. */
  descKeys: readonly [string, string, string];
  quirkKey: string;
  /** Racja at level 1 and per level gained. */
  racja: number;
  racjaPerLevel: number;
  speed: number;
  /** Collision radius. */
  r: number;
  baseStats: Stats;
  auto: {
    type: DamageType;
    range: number;
    cooldown: number;
    /** Thrown/shot: a projectile flies; otherwise the hit lands at once. */
    projectile: boolean;
    /** Projectile only: gains a pierce on a critical hit. */
    pierceOnCrit?: boolean;
  };
  skills: readonly [SkillDef, SkillDef, SkillDef];
}

const skill = (hero: HeroId, n: 1 | 2 | 3, id: string, type: DamageType, cooldown: number, aim: AimMode): SkillDef => ({
  id,
  nameKey: `heroes.${hero}.skill${n}.name`,
  padKey: `heroes.${hero}.skill${n}.pad`,
  descKey: `heroes.${hero}.skill${n}.desc`,
  type,
  cooldown,
  aim,
});

const hero = (
  id: HeroId,
  d: Omit<HeroDef, 'id' | 'nameKey' | 'descKeys' | 'quirkKey' | 'skills'> & { skills: HeroDef['skills'] },
): HeroDef => ({
  id,
  nameKey: `heroes.${id}.name`,
  descKeys: [`heroes.${id}.desc1`, `heroes.${id}.desc2`, `heroes.${id}.desc3`],
  quirkKey: `heroes.${id}.quirk`,
  ...d,
});

export const HEROES: readonly HeroDef[] = [
  hero('pralka', {
    racja: 120,
    racjaPerLevel: 12,
    speed: 112,
    r: 16,
    baseStats: { pewnoscSiebie: 100, upor: 70, dmgMin: 6, dmgMax: 11, critChance: 0.08, resist: { mechaniczny: 10 } },
    auto: { type: 'mechaniczny', range: 56, cooldown: 0.95, projectile: false },
    skills: [
      skill('pralka', 1, 'wirowanie', 'mechaniczny', 7, 'auto'),
      skill('pralka', 2, 'pranieWstepne', 'regulaminowy', 10, 'auto'),
      skill('pralka', 3, 'odwirowanie', 'mechaniczny', 9, 'kierunek'),
    ],
  }),
  hero('konsultant', {
    racja: 76,
    racjaPerLevel: 8,
    speed: 128,
    r: 13,
    baseStats: { pewnoscSiebie: 95, upor: 38, dmgMin: 4, dmgMax: 8, critChance: 0.1, resist: { regulaminowy: 10 } },
    auto: { type: 'regulaminowy', range: 190, cooldown: 0.75, projectile: true },
    skills: [
      skill('konsultant', 1, 'prosze', 'regulaminowy', 8, 'wskazanie'),
      skill('konsultant', 2, 'przekierowuje', 'egzystencjalny', 12, 'kierunek'),
      skill('konsultant', 3, 'pomoc', 'regulaminowy', 20, 'auto'),
    ],
  }),
  hero('petlowiec', {
    racja: 80,
    racjaPerLevel: 8,
    speed: 124,
    r: 13,
    baseStats: { pewnoscSiebie: 95, upor: 45, dmgMin: 5, dmgMax: 9, critChance: 0.1, resist: { egzystencjalny: 15 } },
    auto: { type: 'egzystencjalny', range: 130, cooldown: 0.8, projectile: true },
    skills: [
      skill('petlowiec', 1, 'przybycie', 'regulaminowy', 9, 'auto'),
      skill('petlowiec', 2, 'spor', 'egzystencjalny', 11, 'auto'),
      skill('petlowiec', 3, 'petla', 'mechaniczny', 16, 'auto'),
    ],
  }),
  hero('kartograf', {
    racja: 68,
    racjaPerLevel: 7,
    speed: 134,
    r: 13,
    baseStats: { pewnoscSiebie: 110, upor: 32, dmgMin: 5, dmgMax: 10, critChance: 0.12, resist: {} },
    auto: { type: 'mechaniczny', range: 260, cooldown: 1.05, projectile: true, pierceOnCrit: true },
    skills: [
      skill('kartograf', 1, 'triangulacja', 'mechaniczny', 6, 'kierunek'),
      skill('kartograf', 2, 'teren', 'egzystencjalny', 14, 'wskazanie'),
      skill('kartograf', 3, 'korekta', 'regulaminowy', 10, 'wskazanie'),
    ],
  }),
];

export const HERO_IDS: readonly HeroId[] = HEROES.map((h) => h.id);

export function heroDef(id: HeroId): HeroDef {
  const def = HEROES.find((h) => h.id === id) ?? HEROES[0];
  if (!def) throw new Error('no heroes defined');
  return def;
}
