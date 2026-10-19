/** The sounds of the hero: one recipe per skill (indexed by SkillIndex), keyed into audio/recipes.ts. */
import type { HeroSounds } from '../module';

export const sounds: HeroSounds = {
  skills: ['nalesOrbita', 'nalesGravity', 'nalesFlag', 'nalesTide', 'nalesMoon'],
  ultimate: 'nalesUlt',
  /** Played when the auto-attack starts (a flip with a slap). */
  autoStart: 'nalesSlap',
};
