/** The five faces, in hero order. `anomalia/index.ts` registers them once. */
import type { AnomaliaFace } from '../index';
import { kierownik } from './kierownik';
import { obserwatorium } from './obserwatorium';
import { planeta } from './planeta';
import { serwisant } from './serwisant';
import { wezel } from './wezel';

export const ALL_FACES: readonly AnomaliaFace[] = [kierownik, serwisant, wezel, planeta, obserwatorium];
