/**
 * People of the base pages (STORY 5, "base figures"): a figure drawn on the page, a tap, a short sheet, no dialogue trees.
 * The primitive is `NpcDef` (who, what role, three lines, how the figure looks) and `npcAt(planet)` (who stands in the base of a
 * planet). The clerk is the first of them, and a placeholder: S11 writes the names, roles and lines of the nine, S12 and on
 * register them per planet with `registerNpc`. The drawing is `render/npc.ts`; the sheet is `ui/npcSheet.ts`; the clerk stands
 * in the base as the station `urzednik` (world/base.ts), so a tap on it reaches main.ts like a tap on any other station.
 */
import { PLANET_COUNT } from './campaign';

export interface NpcDef {
  id: string;
  /** i18n keys: the name as printed on the nameplate, the role under it, and the lines the sheet reads out. */
  nameKey: string;
  roleKey: string;
  lineKeys: readonly string[];
  /** Seeds the hand-drawn irregularity and the little differences between clerks (glasses, a tie, the stack of forms). */
  look: number;
}

/** The placeholder clerk every base has until the planets bring their own. Texts: `screens.npc.referent.*`. */
export const PLACEHOLDER_CLERK: NpcDef = {
  id: 'referent',
  nameKey: 'screens.npc.referent.name',
  roleKey: 'screens.npc.referent.role',
  lineKeys: ['screens.npc.referent.line0', 'screens.npc.referent.line1', 'screens.npc.referent.line2'],
  look: 41,
};

const BY_PLANET = new Map<number, NpcDef>();

/** A planet module sets the clerk of its base (S12 and on). */
export function registerNpc(planet: number, def: NpcDef): void {
  if (Number.isInteger(planet) && planet >= 0 && planet < PLANET_COUNT) BY_PLANET.set(planet, def);
}

/** The clerk who stands in the base of a planet (0-based). */
export function npcAt(planet: number): NpcDef {
  return BY_PLANET.get(Math.min(PLANET_COUNT - 1, Math.max(0, Math.floor(planet)))) ?? PLACEHOLDER_CLERK;
}
