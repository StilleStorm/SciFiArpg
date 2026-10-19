/** The sounds of the hero: one recipe per skill (indexed by SkillIndex), keyed into audio/recipes.ts. TODO: five own recipes and the ultimate's in audio/recipes.ts. */
import type { HeroSounds } from '../module';

export const sounds: HeroSounds = {
  skills: ['hit', 'hit', 'hit', 'hit', 'hit'],
  ultimate: 'stamp',
};
