/** The pralka module: data, drawing, sounds, casts, quirk. */
import type { HeroModule } from '../module';
import { casts } from './skills';
import { def } from './def';
import { figure } from './figure';
import { quirk } from './quirk';
import { sounds } from './sounds';

export const hero: HeroModule = { def, figure, sounds, casts, quirk };
