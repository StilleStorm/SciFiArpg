/** Builders for the data of a hero (S1): `defineSkill` and `defineHero` fill the i18n keys from the hero id and the skill number. */
import type { HeroId } from './registry';
import type { AimMode, HeroDef, SkillDef } from './defs';
import type { DamageType } from '../combat/damage';
import type { FamilyId } from '../enemies/ids';

export function defineSkill(hero: HeroId, n: 1 | 2 | 3 | 4 | 5, id: string, type: DamageType, cooldown: number, aim: AimMode, requires?: FamilyId): SkillDef {
  const def: SkillDef = {
    id,
    nameKey: `heroes.${hero}.skill${n}.name`,
    padKey: `heroes.${hero}.skill${n}.pad`,
    descKey: `heroes.${hero}.skill${n}.desc`,
    type,
    cooldown,
    aim,
  };
  if (requires) def.requires = requires;
  return def;
}

export function defineHero(id: HeroId, d: Omit<HeroDef, 'id' | 'nameKey' | 'descKeys' | 'quirkKey'>): HeroDef {
  return {
    id,
    nameKey: `heroes.${id}.name`,
    descKeys: [`heroes.${id}.desc1`, `heroes.${id}.desc2`, `heroes.${id}.desc3`],
    quirkKey: `heroes.${id}.quirk`,
    ...d,
  };
}
