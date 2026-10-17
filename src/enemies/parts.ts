/**
 * The part library, the one place the assembler looks things up. Drawn in the Mroz manner: line art,
 * hatching, small parts, no fills except hatch and ink dots. See partsBase.ts for the frames.
 */
import { BOSS_BODIES } from './partsBosses';
import { DEVICE_BODIES, DEVICE_DECOS, DEVICE_HEADS, DEVICE_LEGS } from './partsDevices';
import { GENERATED_BODIES, GENERATED_DECOS } from './partsGenerated';
import { NOTICE_BODIES, NOTICE_DECOS } from './partsNotices';
import type { BodyPart, DecoPart, HeadPart, LegPart } from './partsBase';
import type { FamilyId } from './ids';

export * from './partsBase';

export const BODIES: readonly BodyPart[] = [...DEVICE_BODIES, ...NOTICE_BODIES, ...GENERATED_BODIES, ...BOSS_BODIES];
export const LEGS: readonly LegPart[] = DEVICE_LEGS;
export const HEADS: readonly HeadPart[] = DEVICE_HEADS;
export const DECOS: readonly DecoPart[] = [...DEVICE_DECOS, ...NOTICE_DECOS, ...GENERATED_DECOS];

/** Bodies a family draws from when assembling at random (bosses excluded). */
export function bodiesOf(family: FamilyId): BodyPart[] {
  return BODIES.filter((b) => b.family === family && !b.boss);
}

export function decosOf(family: FamilyId): DecoPart[] {
  return DECOS.filter((d) => d.family === family);
}

export function bodyById(id: string): BodyPart | undefined {
  return BODIES.find((b) => b.id === id);
}
export function legById(id: string): LegPart | undefined {
  return LEGS.find((l) => l.id === id);
}
export function headById(id: string): HeadPart | undefined {
  return HEADS.find((h) => h.id === id);
}
export function decoById(id: string): DecoPart | undefined {
  return DECOS.find((d) => d.id === id);
}
