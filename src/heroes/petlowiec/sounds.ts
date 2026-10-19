/** The sounds of the hero: one recipe per skill (indexed by SkillIndex), keyed into audio/recipes.ts. */
import type { HeroSounds } from '../module';

export const sounds: HeroSounds = {
  skills: ['petlRemarks', 'petlSplice', 'petlRewind', 'petlDejaVu', 'petlLaunch'],
  ultimate: 'petlUlt',
};
