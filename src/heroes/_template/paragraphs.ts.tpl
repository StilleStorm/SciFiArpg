/** The paragraphs of the hero: five skills x § 1..3 (heroes/paragraphs.ts). TODO: real patches (at most four fields each) and the skill levels from SKILLS.md. */
import { defineParagraphs, type SkillParagraphs } from '../paragraphs';

/** Placeholder: § 2 a larger, longer skill; § 3 a stronger one with a price. */
const generic = (skill: string, level: number): SkillParagraphs =>
  defineParagraphs('__ID__', skill, level, { patch: { area: 1.3, dur: 1.3 } }, { patch: { dmg: 1.4, cd: 3 } });

export const paragraphs: Readonly<Record<string, SkillParagraphs>> = {
  __ID__1: generic('__ID__1', 1),
  __ID__2: generic('__ID__2', 1),
  __ID__3: generic('__ID__3', 1),
  __ID__4: generic('__ID__4', 5),
  __ID__5: generic('__ID__5', 7),
};
