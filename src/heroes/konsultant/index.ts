/** The konsultant module: data, drawing, sounds, casts, pad glyphs, passives. */
import type { HeroModule } from '../module';
import { casts } from './skills';
import { def } from './def';
import { figure } from './figure';
import { pads } from './pads';
import { paragraphs } from './paragraphs';
import { passives } from './passives';
import { sounds } from './sounds';
import { specs } from './specs';
import { ultimates } from './ultimates';

export const hero: HeroModule = { def, figure, sounds, casts, paragraphs, pads, passives, ultimates, specs };
