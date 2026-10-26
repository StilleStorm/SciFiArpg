/** The sounds of the hero: one recipe per skill (indexed by SkillIndex), keyed into audio/recipes.ts. TODO: the placeholder recipes between the SCAFFOLD markers in audio/recipes.ts are the ones named here; give each its own sound. */
import type { HeroSounds } from '../module';

export const sounds: HeroSounds = {
  skills: ['__ID__Skill1', '__ID__Skill2', '__ID__Skill3', '__ID__Skill4', '__ID__Skill5'],
  ultimate: '__ID__Ult',
  autoStart: '__ID__Auto',
};
