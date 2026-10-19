/** The petlowiec module: data, drawing, sounds, casts. */
import type { HeroModule } from '../module';
import { casts } from './skills';
import { def } from './def';
import { figure } from './figure';
import { sounds } from './sounds';

export const hero: HeroModule = { def, figure, sounds, casts };
