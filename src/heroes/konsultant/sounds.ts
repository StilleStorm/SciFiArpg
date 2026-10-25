/** The sounds of the hero: one recipe per skill (indexed by SkillIndex), keyed into audio/recipes.ts, and one per ultimate id. */
import type { HeroSounds } from '../module';

export const sounds: HeroSounds = {
  skills: ['konsBeep', 'konsRedirect', 'konsHeadset', 'konsCase', 'konsHangup', 'konsTicket', 'konsForm', 'konsMusic', 'konsBreak', 'konsCallback'],
  ultimate: { przekazanie: 'konsUlt', koniecKolejki: 'konsUltQueue', ankieta: 'konsUltSurvey' },
};
